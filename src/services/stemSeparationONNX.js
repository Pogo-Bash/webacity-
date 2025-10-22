/**
 * ONNX-based Stem Separation Service
 * Uses UVR MDX-NET models with ONNX Runtime Web
 * Uses TensorFlow.js for fast STFT/ISTFT processing
 */

import * as ort from 'onnxruntime-web'
import * as tf from '@tensorflow/tfjs'

export class ONNXStemSeparator {
  constructor() {
    this.vocalsSession = null
    this.instrumentalSession = null
    this.initialized = false
    this.sampleRate = 44100

    // MDX-NET model configuration
    this.config = {
      n_fft: 6144,
      hop_length: 1024,
      dim_f: 3072,
      chunk_size: 485100, // ~11 seconds at 44.1kHz
      overlap: 0.25
    }
  }

  /**
   * Initialize ONNX Runtime with WASM backend
   */
  async initialize(onProgress = null) {
    if (this.initialized) return true

    try {
      if (onProgress) {
        onProgress({ status: 'loading', message: 'Initializing ONNX Runtime...', progress: 10 })
      }

      // Configure ONNX Runtime with WASM (stable, no shader issues)
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4
      ort.env.wasm.simd = true
      ort.env.wasm.proxy = false

      // Initialize TensorFlow.js backend
      await tf.ready()
      await tf.setBackend('webgl')

      console.log(`✅ ONNX Runtime initialized with WASM backend`)
      console.log(`   ONNX Threads: ${ort.env.wasm.numThreads}`)
      console.log(`✅ TensorFlow.js backend: ${tf.getBackend()}`)

      if (onProgress) {
        onProgress({ status: 'ready', message: 'ONNX Runtime ready', progress: 100 })
      }

      this.initialized = true
      return true
    } catch (error) {
      console.error('❌ Failed to initialize ONNX Runtime:', error)
      throw new Error(`ONNX initialization failed: ${error.message}`)
    }
  }

  /**
   * Load ONNX model with WASM backend
   */
  async loadModel(modelUrl, modelType, onProgress = null) {
    try {
      if (onProgress) {
        onProgress({ status: 'loading', message: `Loading ${modelType} model...`, progress: 20 })
      }

      console.log(`📥 Loading ${modelType} model from: ${modelUrl}`)

      // Use WASM backend (no WebGPU shader issues)
      const options = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential'
      }

      const session = await ort.InferenceSession.create(modelUrl, options)
      console.log(`✅ ${modelType} model loaded successfully`)
      console.log(`   Inputs:`, session.inputNames)
      console.log(`   Outputs:`, session.outputNames)

      if (onProgress) {
        onProgress({ status: 'ready', message: `${modelType} model loaded`, progress: 100 })
      }

      return session
    } catch (error) {
      console.error(`❌ Failed to load ${modelType} model:`, error)
      throw new Error(`Model loading failed: ${error.message}`)
    }
  }

  /**
   * Load models from URLs
   */
  async loadModels(vocalsModelUrl, instrumentalModelUrl = null, onProgress = null) {
    try {
      if (!vocalsModelUrl) {
        throw new Error('Vocals model URL is required')
      }

      // Load vocals model
      this.vocalsSession = await this.loadModel(vocalsModelUrl, 'vocals', onProgress)

      // Instrumental model is optional (we can derive it)
      if (instrumentalModelUrl) {
        this.instrumentalSession = await this.loadModel(instrumentalModelUrl, 'instrumental', onProgress)
      }

      return true
    } catch (error) {
      throw new Error(`Failed to load models: ${error.message}`)
    }
  }

  /**
   * Convert AudioBuffer to mono Float32Array
   */
  audioBufferToMono(buffer) {
    const left = buffer.getChannelData(0)
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left

    const mono = new Float32Array(left.length)
    for (let i = 0; i < left.length; i++) {
      mono[i] = (left[i] + right[i]) / 2
    }

    return mono
  }

  /**
   * STFT using TensorFlow.js (fast GPU implementation)
   * Returns [magnitude, phase]
   */
  stft(audio) {
    return tf.tidy(() => {
      const { n_fft, hop_length } = this.config

      // Convert to tensor
      const audioTensor = tf.tensor1d(audio)

      // Compute STFT
      const stftTensor = tf.signal.stft(
        audioTensor,
        n_fft,
        hop_length,
        n_fft,
        tf.signal.hannWindow
      )

      // Split into magnitude and phase
      const magnitude = tf.abs(stftTensor)
      const phase = tf.atan2(tf.imag(stftTensor), tf.real(stftTensor))

      // Get data as arrays [freq, time]
      const magData = magnitude.arraySync()
      const phaseData = phase.arraySync()

      // Transpose to [time, freq] for easier processing
      const numFrames = magData[0].length
      const freqBins = magData.length

      const magTransposed = []
      const phaseTransposed = []

      for (let t = 0; t < numFrames; t++) {
        const magFrame = new Float32Array(freqBins)
        const phaseFrame = new Float32Array(freqBins)
        for (let f = 0; f < freqBins; f++) {
          magFrame[f] = magData[f][t]
          phaseFrame[f] = phaseData[f][t]
        }
        magTransposed.push(magFrame)
        phaseTransposed.push(phaseFrame)
      }

      return [magTransposed, phaseTransposed]
    })
  }

  /**
   * ISTFT using TensorFlow.js (fast GPU implementation)
   */
  istft(magnitude, phase, originalLength) {
    return tf.tidy(() => {
      const { n_fft, hop_length } = this.config

      const numFrames = magnitude.length
      const freqBins = magnitude[0].length

      // Transpose back to [freq, time]
      const magArray = []
      const phaseArray = []

      for (let f = 0; f < freqBins; f++) {
        const magFreq = []
        const phaseFreq = []
        for (let t = 0; t < numFrames; t++) {
          magFreq.push(magnitude[t][f])
          phaseFreq.push(phase[t][f])
        }
        magArray.push(magFreq)
        phaseArray.push(phaseFreq)
      }

      // Create complex tensor from magnitude and phase
      const magTensor = tf.tensor2d(magArray)
      const phaseTensor = tf.tensor2d(phaseArray)

      const realPart = tf.mul(magTensor, tf.cos(phaseTensor))
      const imagPart = tf.mul(magTensor, tf.sin(phaseTensor))

      const stftComplex = tf.complex(realPart, imagPart)

      // Inverse STFT
      const audioTensor = tf.signal.inverseStft(
        stftComplex,
        n_fft,
        hop_length,
        n_fft,
        tf.signal.hannWindow
      )

      // Get audio data
      const audioData = audioTensor.arraySync()

      // Trim to original length
      const result = new Float32Array(originalLength)
      for (let i = 0; i < Math.min(originalLength, audioData.length); i++) {
        result[i] = audioData[i]
      }

      return result
    })
  }

  /**
   * Process spectrogram through ONNX model
   */
  async processSpectrogram(magnitude) {
    try {
      const { dim_f } = this.config
      const numFrames = magnitude.length
      const freqBins = magnitude[0].length

      console.log(`   Processing spectrogram: ${freqBins} freq bins × ${numFrames} time frames`)

      // Prepare input tensor [batch, channels, freq, time]
      // Reshape to [1, 1, dim_f, numFrames]
      const inputData = new Float32Array(dim_f * numFrames)

      for (let t = 0; t < numFrames; t++) {
        for (let f = 0; f < Math.min(freqBins, dim_f); f++) {
          inputData[f * numFrames + t] = magnitude[t][f]
        }
      }

      const inputTensor = new ort.Tensor('float32', inputData, [1, 1, dim_f, numFrames])

      console.log(`   Input tensor shape: [1, 1, ${dim_f}, ${numFrames}]`)

      // Run model
      const feeds = { [this.vocalsSession.inputNames[0]]: inputTensor }
      const results = await this.vocalsSession.run(feeds)

      // Get output
      const outputTensor = results[this.vocalsSession.outputNames[0]]
      const outputData = outputTensor.data

      console.log(`   Output tensor shape:`, outputTensor.dims)
      console.log(`   Output data length:`, outputData.length)

      // Reshape back to [time][freq]
      const outputMagnitude = []
      for (let t = 0; t < numFrames; t++) {
        const frame = new Float32Array(freqBins)
        for (let f = 0; f < Math.min(freqBins, dim_f); f++) {
          frame[f] = outputData[f * numFrames + t]
        }
        outputMagnitude.push(frame)
      }

      return outputMagnitude
    } catch (error) {
      console.error('❌ Spectrogram processing failed:', error)
      throw error
    }
  }

  /**
   * Main separation function
   */
  async separate(audioBuffer, onProgress = null) {
    if (!this.initialized) {
      await this.initialize(onProgress)
    }

    if (!this.vocalsSession) {
      throw new Error('No model loaded. Call loadModels() first.')
    }

    try {
      const startTime = performance.now()
      console.log(`🎵 Separating ${audioBuffer.duration.toFixed(2)}s audio...`)

      if (onProgress) {
        onProgress({ status: 'preprocessing', message: 'Converting to mono...', progress: 10 })
      }

      // Convert to mono
      const mono = this.audioBufferToMono(audioBuffer)
      console.log(`   Mono audio: ${mono.length} samples`)

      if (onProgress) {
        onProgress({ status: 'processing', message: 'Computing spectrogram...', progress: 20 })
      }

      // STFT with TensorFlow.js (fast!)
      const [magnitude, phase] = this.stft(mono)
      console.log(`   Spectrogram computed: ${magnitude[0].length} freq bins × ${magnitude.length} frames`)

      if (onProgress) {
        onProgress({ status: 'processing', message: 'Running AI model...', progress: 40 })
      }

      // Process through ONNX model
      const vocalsMagnitude = await this.processSpectrogram(magnitude)

      if (onProgress) {
        onProgress({ status: 'processing', message: 'Reconstructing audio...', progress: 70 })
      }

      // ISTFT with TensorFlow.js (fast!)
      const vocals = this.istft(vocalsMagnitude, phase, mono.length)
      console.log(`   Vocals reconstructed: ${vocals.length} samples`)

      if (onProgress) {
        onProgress({ status: 'processing', message: 'Creating instrumental...', progress: 85 })
      }

      // Create instrumental by subtraction
      const instrumental = new Float32Array(mono.length)
      for (let i = 0; i < mono.length; i++) {
        instrumental[i] = mono[i] - vocals[i]
      }

      // Convert to AudioBuffers
      const vocalsBuffer = this.float32ToAudioBuffer(vocals, audioBuffer.sampleRate, audioBuffer.numberOfChannels)
      const instrumentalBuffer = this.float32ToAudioBuffer(instrumental, audioBuffer.sampleRate, audioBuffer.numberOfChannels)

      const processingTime = ((performance.now() - startTime) / 1000).toFixed(1)
      console.log(`✅ Stem separation complete in ${processingTime}s!`)

      if (onProgress) {
        onProgress({ status: 'complete', message: 'Separation complete!', progress: 100 })
      }

      return { vocals: vocalsBuffer, instrumental: instrumentalBuffer }
    } catch (error) {
      console.error('❌ Separation failed:', error)
      throw error
    }
  }

  /**
   * Convert Float32Array to AudioBuffer
   */
  float32ToAudioBuffer(data, sampleRate, numChannels = 2) {
    const audioContext = new AudioContext({ sampleRate })
    const buffer = audioContext.createBuffer(numChannels, data.length, sampleRate)

    for (let ch = 0; ch < numChannels; ch++) {
      buffer.copyToChannel(data, ch)
    }

    return buffer
  }

  /**
   * Cleanup
   */
  async dispose() {
    try {
      if (this.vocalsSession) {
        await this.vocalsSession.release()
        this.vocalsSession = null
      }
      if (this.instrumentalSession) {
        await this.instrumentalSession.release()
        this.instrumentalSession = null
      }
      this.initialized = false
      console.log('✅ ONNX stem separator disposed')
    } catch (error) {
      console.error('❌ Disposal error:', error)
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      vocalsModelLoaded: !!this.vocalsSession,
      backend: 'WASM + TensorFlow.js WebGL',
      onnxVersion: ort.env.versions.onnxruntime
    }
  }
}

// Export singleton
export const onnxStemSeparator = new ONNXStemSeparator()
