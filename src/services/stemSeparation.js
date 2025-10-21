/**
 * Stem Separation Service
 * Uses ONNX Runtime Web to perform AI-based audio stem separation in the browser
 */

import * as ort from 'onnxruntime-web'

export class StemSeparator {
  constructor() {
    this.session = null
    this.modelPath = '/models/demucs-2stem.onnx'
    this.sampleRate = 44100
    this.initialized = false
  }

  /**
   * Initialize the ONNX session and load the model
   */
  async initialize(onProgress = null) {
    if (this.initialized) return true

    try {
      // Configure ONNX Runtime for optimal browser performance
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4
      ort.env.wasm.simd = true
      ort.env.wasm.wasmPaths = '/wasm/'

      if (onProgress) {
        onProgress({ status: 'loading', message: 'Loading AI model...', progress: 10 })
      }

      // Load the ONNX model
      // Try multiple execution providers in order of preference
      const providers = []

      // Check for WebGPU support (fastest)
      if ('gpu' in navigator) {
        providers.push('webgpu')
      }

      // Fallback to WASM (slower but universally supported)
      providers.push('wasm')

      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: providers,
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true
      })

      if (onProgress) {
        onProgress({ status: 'ready', message: 'Model loaded successfully', progress: 100 })
      }

      this.initialized = true
      console.log('✅ Stem separation model loaded successfully')
      console.log('   Using providers:', providers)
      console.log('   Model inputs:', this.session.inputNames)
      console.log('   Model outputs:', this.session.outputNames)

      return true
    } catch (error) {
      console.error('❌ Failed to initialize stem separator:', error)

      if (error.message.includes('404')) {
        throw new Error('Model file not found. Please add an ONNX model to public/models/')
      }

      throw error
    }
  }

  /**
   * Separate audio into stems
   * @param {AudioBuffer} audioBuffer - Input audio buffer
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<{vocals: AudioBuffer, instrumental: AudioBuffer}>}
   */
  async separate(audioBuffer, onProgress = null) {
    if (!this.initialized) {
      await this.initialize(onProgress)
    }

    try {
      if (onProgress) {
        onProgress({ status: 'preprocessing', message: 'Preparing audio...', progress: 15 })
      }

      // Step 1: Prepare input tensor
      const inputTensor = await this.prepareInput(audioBuffer)

      if (onProgress) {
        onProgress({ status: 'processing', message: 'Separating stems (this may take 30-60 seconds)...', progress: 30 })
      }

      // Step 2: Run inference
      const startTime = performance.now()
      const feeds = { [this.session.inputNames[0]]: inputTensor }
      const results = await this.session.run(feeds)
      const inferenceTime = ((performance.now() - startTime) / 1000).toFixed(1)

      console.log(`✅ Inference completed in ${inferenceTime}s`)

      if (onProgress) {
        onProgress({ status: 'postprocessing', message: 'Creating stem audio buffers...', progress: 80 })
      }

      // Step 3: Process outputs into AudioBuffers
      const stems = await this.processOutput(results, audioBuffer)

      if (onProgress) {
        onProgress({ status: 'complete', message: 'Stem separation complete!', progress: 100 })
      }

      return stems
    } catch (error) {
      console.error('❌ Failed to separate stems:', error)
      throw error
    }
  }

  /**
   * Prepare audio buffer for model input
   * @param {AudioBuffer} buffer - Input audio buffer
   * @returns {ort.Tensor}
   */
  async prepareInput(buffer) {
    // Resample if needed
    let audioData = buffer
    if (buffer.sampleRate !== this.sampleRate) {
      audioData = await this.resampleBuffer(buffer, this.sampleRate)
    }

    // Get audio data (stereo or convert mono to stereo)
    const leftChannel = audioData.getChannelData(0)
    const rightChannel = audioData.numberOfChannels > 1
      ? audioData.getChannelData(1)
      : audioData.getChannelData(0)

    // Interleave stereo channels: [L, R, L, R, ...]
    const length = leftChannel.length
    const interleavedData = new Float32Array(length * 2)

    for (let i = 0; i < length; i++) {
      interleavedData[i * 2] = leftChannel[i]
      interleavedData[i * 2 + 1] = rightChannel[i]
    }

    // Normalize audio to [-1, 1] range
    this.normalizeAudio(interleavedData)

    // Create tensor with shape [1, 2, samples]
    // Batch size: 1, Channels: 2, Samples: length
    const reshapedData = new Float32Array(2 * length)
    for (let i = 0; i < length; i++) {
      reshapedData[i] = interleavedData[i * 2]           // Left channel
      reshapedData[length + i] = interleavedData[i * 2 + 1]  // Right channel
    }

    return new ort.Tensor('float32', reshapedData, [1, 2, length])
  }

  /**
   * Process model output into AudioBuffers
   * @param {Object} results - ONNX inference results
   * @param {AudioBuffer} originalBuffer - Original audio buffer for reference
   * @returns {Object} - {vocals: AudioBuffer, instrumental: AudioBuffer}
   */
  async processOutput(results, originalBuffer) {
    const outputNames = this.session.outputNames

    // Extract output tensors
    // Assuming outputs are: vocals and instrumental (or similar)
    const vocalsData = results[outputNames[0]].data
    const instrumentalData = results[outputNames[1]].data

    // Get tensor shape: [1, 2, samples]
    const shape = results[outputNames[0]].dims
    const numSamples = shape[2]

    // Create AudioBuffers
    const vocalsBuffer = this.createAudioBuffer(vocalsData, numSamples, this.sampleRate)
    const instrumentalBuffer = this.createAudioBuffer(instrumentalData, numSamples, this.sampleRate)

    return {
      vocals: vocalsBuffer,
      instrumental: instrumentalBuffer
    }
  }

  /**
   * Create an AudioBuffer from tensor data
   * @param {Float32Array} tensorData - Flattened tensor data [left_channel..., right_channel...]
   * @param {number} numSamples - Number of samples per channel
   * @param {number} sampleRate - Sample rate
   * @returns {AudioBuffer}
   */
  createAudioBuffer(tensorData, numSamples, sampleRate) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate })
    const buffer = audioContext.createBuffer(2, numSamples, sampleRate)

    // Extract left and right channels from tensor
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    for (let i = 0; i < numSamples; i++) {
      leftChannel[i] = tensorData[i]
      rightChannel[i] = tensorData[numSamples + i]
    }

    // Denormalize and clamp
    this.denormalizeAudio(leftChannel)
    this.denormalizeAudio(rightChannel)

    return buffer
  }

  /**
   * Resample audio buffer to target sample rate
   * @param {AudioBuffer} buffer - Input buffer
   * @param {number} targetRate - Target sample rate
   * @returns {Promise<AudioBuffer>}
   */
  async resampleBuffer(buffer, targetRate) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: targetRate })
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      Math.ceil(buffer.duration * targetRate),
      targetRate
    )

    const source = offlineContext.createBufferSource()
    source.buffer = buffer
    source.connect(offlineContext.destination)
    source.start(0)

    return await offlineContext.startRendering()
  }

  /**
   * Normalize audio to [-1, 1] range
   * @param {Float32Array} data - Audio data
   */
  normalizeAudio(data) {
    let max = 0
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > max) max = abs
    }

    if (max > 0) {
      for (let i = 0; i < data.length; i++) {
        data[i] /= max
      }
    }
  }

  /**
   * Denormalize and clamp audio to safe range
   * @param {Float32Array} data - Audio data
   */
  denormalizeAudio(data) {
    for (let i = 0; i < data.length; i++) {
      // Clamp to [-1, 1]
      data[i] = Math.max(-1, Math.min(1, data[i]))
    }
  }

  /**
   * Check if model file exists
   * @returns {Promise<boolean>}
   */
  async checkModelExists() {
    try {
      const response = await fetch(this.modelPath, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get model info
   */
  getModelInfo() {
    if (!this.session) return null

    return {
      inputNames: this.session.inputNames,
      outputNames: this.session.outputNames,
      sampleRate: this.sampleRate,
      initialized: this.initialized
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.session) {
      // ONNX Runtime Web doesn't have explicit dispose yet
      this.session = null
      this.initialized = false
    }
  }
}

// Export singleton instance
export const stemSeparator = new StemSeparator()
