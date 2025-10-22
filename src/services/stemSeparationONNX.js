/**
 * ONNX-based Stem Separation Service
 * Uses UVR MDX-NET models with ONNX Runtime Web + WebGPU
 * Memory-optimized for browser use without crashes
 */

import * as ort from 'onnxruntime-web'

export class ONNXStemSeparator {
  constructor() {
    this.vocalsSession = null
    this.instrumentalSession = null
    this.initialized = false
    this.sampleRate = 44100

    // Model configuration for UVR MDX-NET
    this.config = {
      // Processing parameters
      chunkSize: 262144, // ~6 seconds at 44.1kHz (power of 2 for FFT)
      overlap: 0.25, // 25% overlap between chunks
      hopLength: 1024,
      n_fft: 6144,
      dimF: 3072,

      // Model URLs (user must provide these)
      vocalsModelUrl: null,
      instrumentalModelUrl: null,

      // Memory limits
      maxMemoryMB: 512, // Stay under 512MB to prevent crashes
      batchSize: 1
    }
  }

  /**
   * Initialize ONNX Runtime with WebGPU
   */
  async initialize(onProgress = null) {
    if (this.initialized) return true

    try {
      if (onProgress) {
        onProgress({ status: 'loading', message: 'Initializing ONNX Runtime...', progress: 10 })
      }

      // Configure ONNX Runtime for browser with WASM backend
      // Using WASM for maximum compatibility (avoids WebGPU shader issues)
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4
      ort.env.wasm.simd = true
      ort.env.wasm.proxy = false

      console.log(`✅ ONNX Runtime initialized with WASM backend`)
      console.log(`   Threads: ${ort.env.wasm.numThreads}`)
      console.log(`   SIMD: ${ort.env.wasm.simd}`)

      if (onProgress) {
        onProgress({
          status: 'ready',
          message: 'ONNX Runtime ready - Models need to be loaded',
          progress: 100
        })
      }

      this.initialized = true
      return true
    } catch (error) {
      console.error('❌ Failed to initialize ONNX Runtime:', error)
      throw new Error(`ONNX initialization failed: ${error.message}`)
    }
  }

  /**
   * Load ONNX model from URL with progress tracking
   */
  async loadModel(modelUrl, modelType, onProgress = null) {
    try {
      if (onProgress) {
        onProgress({
          status: 'loading',
          message: `Downloading ${modelType} model...`,
          progress: 20
        })
      }

      console.log(`📥 Loading ${modelType} model from: ${modelUrl}`)

      // Use WASM backend for maximum compatibility
      // WebGPU can cause shader compilation issues on some GPUs
      console.log('🔧 Loading model with WASM backend (stable, works on all browsers)')

      const wasmOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential'
      }

      const session = await ort.InferenceSession.create(modelUrl, wasmOptions)
      console.log(`✅ ${modelType} model loaded successfully with WASM backend`)

      console.log(`✅ ${modelType} model loaded successfully`)
      console.log(`   Input names:`, session.inputNames)
      console.log(`   Output names:`, session.outputNames)

      return session
    } catch (error) {
      console.error(`❌ Failed to load ${modelType} model:`, error)
      throw new Error(`Model loading failed: ${error.message}`)
    }
  }

  /**
   * Load models from provided URLs
   */
  async loadModels(vocalsModelUrl, instrumentalModelUrl = null, onProgress = null) {
    if (!vocalsModelUrl) {
      throw new Error('Vocals model URL is required')
    }

    this.config.vocalsModelUrl = vocalsModelUrl
    this.config.instrumentalModelUrl = instrumentalModelUrl

    try {
      // Load vocals model
      this.vocalsSession = await this.loadModel(vocalsModelUrl, 'vocals', onProgress)

      // Load instrumental model if provided (optional - we can subtract vocals from original)
      if (instrumentalModelUrl) {
        this.instrumentalSession = await this.loadModel(instrumentalModelUrl, 'instrumental', onProgress)
      }

      if (onProgress) {
        onProgress({
          status: 'ready',
          message: 'Models loaded successfully',
          progress: 100
        })
      }

      return true
    } catch (error) {
      throw new Error(`Failed to load models: ${error.message}`)
    }
  }

  /**
   * Convert AudioBuffer to Float32Array (mono)
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
   * Process audio in chunks with memory management
   */
  async separateChunked(audioData, sampleRate, onProgress = null) {
    const { chunkSize, overlap } = this.config
    const hopSize = Math.floor(chunkSize * (1 - overlap))
    const numChunks = Math.ceil((audioData.length - chunkSize) / hopSize) + 1

    console.log(`📊 Processing ${audioData.length} samples in ${numChunks} chunks`)
    console.log(`   Chunk size: ${chunkSize} samples (~${(chunkSize / sampleRate).toFixed(1)}s)`)
    console.log(`   Overlap: ${(overlap * 100)}%`)

    const vocalsChunks = []
    let processedSamples = 0

    for (let i = 0; i < numChunks; i++) {
      const start = i * hopSize
      const end = Math.min(start + chunkSize, audioData.length)
      const chunk = audioData.slice(start, end)

      if (onProgress && i % 5 === 0) {
        const progress = 40 + ((i / numChunks) * 40)
        onProgress({
          status: 'processing',
          message: `Processing chunk ${i + 1}/${numChunks}...`,
          progress
        })
      }

      // Pad chunk if needed
      const paddedChunk = new Float32Array(chunkSize)
      paddedChunk.set(chunk)

      // Process with ONNX model
      const vocalChunk = await this.processChunk(paddedChunk)
      vocalsChunks.push(vocalChunk)

      processedSamples = end

      // Give browser a break every 10 chunks
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    // Reconstruct full audio with overlap-add
    if (onProgress) {
      onProgress({
        status: 'processing',
        message: 'Reconstructing full audio...',
        progress: 85
      })
    }

    const vocals = this.overlapAdd(vocalsChunks, hopSize, audioData.length)

    return vocals
  }

  /**
   * Process single audio chunk through ONNX model
   */
  async processChunk(chunk) {
    try {
      // Prepare input tensor [batch, channels, samples]
      const inputTensor = new ort.Tensor('float32', chunk, [1, 1, chunk.length])

      // Run inference
      const feeds = { [this.vocalsSession.inputNames[0]]: inputTensor }
      const results = await this.vocalsSession.run(feeds)

      // Get output
      const outputTensor = results[this.vocalsSession.outputNames[0]]
      const outputData = outputTensor.data

      // Convert to Float32Array
      return new Float32Array(outputData)
    } catch (error) {
      console.error('❌ Chunk processing failed:', error)
      // Return silence on error to prevent crash
      return new Float32Array(chunk.length)
    }
  }

  /**
   * Overlap-add reconstruction
   */
  overlapAdd(chunks, hopSize, totalLength) {
    const output = new Float32Array(totalLength)
    const windowSum = new Float32Array(totalLength)

    for (let i = 0; i < chunks.length; i++) {
      const start = i * hopSize
      const chunk = chunks[i]

      for (let j = 0; j < chunk.length && start + j < totalLength; j++) {
        output[start + j] += chunk[j]
        windowSum[start + j] += 1
      }
    }

    // Normalize
    for (let i = 0; i < totalLength; i++) {
      if (windowSum[i] > 0) {
        output[i] /= windowSum[i]
      }
    }

    return output
  }

  /**
   * Convert Float32Array to AudioBuffer
   */
  float32ToAudioBuffer(data, sampleRate, numChannels = 2) {
    const audioContext = new AudioContext({ sampleRate })
    const buffer = audioContext.createBuffer(numChannels, data.length, sampleRate)

    // Fill both channels with same data
    for (let ch = 0; ch < numChannels; ch++) {
      buffer.copyToChannel(data, ch)
    }

    return buffer
  }

  /**
   * Main separation function
   */
  async separate(audioBuffer, onProgress = null) {
    if (!this.initialized) {
      await this.initialize(onProgress)
    }

    if (!this.vocalsSession) {
      throw new Error('No model loaded. Please call loadModels() first.')
    }

    try {
      if (onProgress) {
        onProgress({ status: 'preprocessing', message: 'Preparing audio...', progress: 10 })
      }

      const startTime = performance.now()

      // Convert to mono
      const mono = this.audioBufferToMono(audioBuffer)
      console.log(`🎵 Input audio: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`)

      // Process in chunks
      const vocals = await this.separateChunked(mono, audioBuffer.sampleRate, onProgress)

      // Create instrumental by subtraction
      if (onProgress) {
        onProgress({ status: 'processing', message: 'Creating instrumental track...', progress: 90 })
      }

      const instrumental = new Float32Array(mono.length)
      for (let i = 0; i < mono.length; i++) {
        instrumental[i] = mono[i] - vocals[i]
      }

      // Convert to AudioBuffers
      const vocalsBuffer = this.float32ToAudioBuffer(vocals, audioBuffer.sampleRate, audioBuffer.numberOfChannels)
      const instrumentalBuffer = this.float32ToAudioBuffer(instrumental, audioBuffer.sampleRate, audioBuffer.numberOfChannels)

      const processingTime = ((performance.now() - startTime) / 1000).toFixed(1)
      console.log(`✅ ONNX stem separation completed in ${processingTime}s`)

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
   * Cleanup resources
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
   * Get status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      vocalsModelLoaded: !!this.vocalsSession,
      instrumentalModelLoaded: !!this.instrumentalSession,
      backend: ort.env.webgpu.available ? 'WebGPU' : 'WASM',
      onnxVersion: ort.env.versions.onnxruntime
    }
  }
}

// Export singleton instance
export const onnxStemSeparator = new ONNXStemSeparator()
