/**
 * ONNX-based Stem Separation Service
 * Uses UVR MDX-NET models with ONNX Runtime Web
 * MDX-NET models expect spectrogram input, not raw audio
 */

import * as ort from 'onnxruntime-web'

export class ONNXStemSeparator {
  constructor() {
    this.vocalsSession = null
    this.instrumentalSession = null
    this.initialized = false
    this.sampleRate = 44100
    this.window = null

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

      console.log(`✅ ONNX Runtime initialized with WASM backend`)
      console.log(`   Threads: ${ort.env.wasm.numThreads}`)

      // Pre-compute Hann window for STFT
      const { n_fft } = this.config
      this.window = new Float32Array(n_fft)
      for (let i = 0; i < n_fft; i++) {
        this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n_fft - 1)))
      }

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
   * Simple FFT implementation (real input -> complex output)
   * Returns [real[], imag[]]
   */
  fft(signal, outputSize) {
    const N = signal.length
    const real = new Float32Array(outputSize)
    const imag = new Float32Array(outputSize)

    // DFT (slow but works, can be replaced with proper FFT)
    for (let k = 0; k < outputSize; k++) {
      let sumReal = 0
      let sumImag = 0
      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N
        sumReal += signal[n] * Math.cos(angle)
        sumImag += signal[n] * Math.sin(angle)
      }
      real[k] = sumReal
      imag[k] = sumImag
    }

    return [real, imag]
  }

  /**
   * Inverse FFT (complex input -> real output)
   */
  ifft(real, imag) {
    const N = real.length
    const signal = new Float32Array(N)

    // IDFT
    for (let n = 0; n < N; n++) {
      let sum = 0
      for (let k = 0; k < N; k++) {
        const angle = (2 * Math.PI * k * n) / N
        sum += real[k] * Math.cos(angle) - imag[k] * Math.sin(angle)
      }
      signal[n] = sum / N
    }

    return signal
  }

  /**
   * STFT: Convert audio to spectrogram
   * Returns [magnitude, phase] where magnitude[freq][time]
   */
  stft(audio) {
    const { n_fft, hop_length } = this.config
    const numFrames = Math.floor((audio.length - n_fft) / hop_length) + 1
    const freqBins = Math.floor(n_fft / 2) + 1

    const magnitude = []
    const phase = []

    for (let t = 0; t < numFrames; t++) {
      const start = t * hop_length
      const frame = new Float32Array(n_fft)

      // Apply window
      for (let i = 0; i < n_fft && start + i < audio.length; i++) {
        frame[i] = audio[start + i] * this.window[i]
      }

      // FFT
      const [real, imag] = this.fft(frame, freqBins)

      // Convert to magnitude and phase
      const frameMag = new Float32Array(freqBins)
      const framePhase = new Float32Array(freqBins)

      for (let f = 0; f < freqBins; f++) {
        frameMag[f] = Math.sqrt(real[f] * real[f] + imag[f] * imag[f])
        framePhase[f] = Math.atan2(imag[f], real[f])
      }

      magnitude.push(frameMag)
      phase.push(framePhase)
    }

    return [magnitude, phase]
  }

  /**
   * ISTFT: Convert spectrogram back to audio
   */
  istft(magnitude, phase, originalLength) {
    const { n_fft, hop_length } = this.config
    const numFrames = magnitude.length
    const audioLength = (numFrames - 1) * hop_length + n_fft

    const audio = new Float32Array(Math.max(audioLength, originalLength))
    const window_sum = new Float32Array(audio.length)

    for (let t = 0; t < numFrames; t++) {
      const start = t * hop_length
      const freqBins = magnitude[t].length

      // Convert magnitude/phase to complex
      const real = new Float32Array(freqBins)
      const imag = new Float32Array(freqBins)

      for (let f = 0; f < freqBins; f++) {
        real[f] = magnitude[t][f] * Math.cos(phase[t][f])
        imag[f] = magnitude[t][f] * Math.sin(phase[t][f])
      }

      // IFFT
      const frame = this.ifft(real, imag)

      // Overlap-add with window
      for (let i = 0; i < n_fft && start + i < audio.length; i++) {
        audio[start + i] += frame[i] * this.window[i]
        window_sum[start + i] += this.window[i] * this.window[i]
      }
    }

    // Normalize
    for (let i = 0; i < audio.length; i++) {
      if (window_sum[i] > 1e-8) {
        audio[i] /= window_sum[i]
      }
    }

    return audio.slice(0, originalLength)
  }

  /**
   * Process audio chunk through ONNX model
   * Input: magnitude spectrogram
   * Output: magnitude spectrogram
   */
  async processSpectrogram(magnitude) {
    try {
      const { dim_f } = this.config
      const numFrames = magnitude.length
      const freqBins = magnitude[0].length

      // Prepare input tensor [batch, channels, freq, time]
      // Reshape to [1, 1, dim_f, numFrames]
      const inputData = new Float32Array(dim_f * numFrames)

      for (let t = 0; t < numFrames; t++) {
        for (let f = 0; f < Math.min(freqBins, dim_f); f++) {
          inputData[f * numFrames + t] = magnitude[t][f]
        }
      }

      const inputTensor = new ort.Tensor('float32', inputData, [1, 1, dim_f, numFrames])

      // Run model
      const feeds = { [this.vocalsSession.inputNames[0]]: inputTensor }
      const results = await this.vocalsSession.run(feeds)

      // Get output
      const outputTensor = results[this.vocalsSession.outputNames[0]]
      const outputData = outputTensor.data

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
      console.log(`🎵 Separating ${audioBuffer.duration.toFixed(2)}s audio...`)

      if (onProgress) {
        onProgress({ status: 'preprocessing', message: 'Converting to mono...', progress: 10 })
      }

      // Convert to mono
      const mono = this.audioBufferToMono(audioBuffer)

      if (onProgress) {
        onProgress({ status: 'processing', message: 'Computing spectrogram...', progress: 20 })
      }

      // STFT
      const [magnitude, phase] = this.stft(mono)
      console.log(`   Spectrogram: ${magnitude[0].length} freq bins × ${magnitude.length} time frames`)

      if (onProgress) {
        onProgress({ status: 'processing', message: 'Running AI model...', progress: 40 })
      }

      // Process through model
      const vocalsMagnitude = await this.processSpectrogram(magnitude)

      if (onProgress) {
        onProgress({ status: 'processing', message: 'Reconstructing audio...', progress: 70 })
      }

      // ISTFT with original phase
      const vocals = this.istft(vocalsMagnitude, phase, mono.length)

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

      if (onProgress) {
        onProgress({ status: 'complete', message: 'Separation complete!', progress: 100 })
      }

      console.log(`✅ Stem separation complete!`)

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
      backend: 'WASM',
      onnxVersion: ort.env.versions.onnxruntime
    }
  }
}

// Export singleton
export const onnxStemSeparator = new ONNXStemSeparator()
