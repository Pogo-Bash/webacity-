/**
 * Stem Separation Service
 * Uses Web Audio API filters for demo, with TensorFlow.js infrastructure ready
 */

import * as tf from '@tensorflow/tfjs'

export class StemSeparator {
  constructor() {
    this.model = null
    this.sampleRate = 44100
    this.initialized = false
    this.useAIModel = false // Set to true when TF.js model is available
  }

  /**
   * Initialize TensorFlow.js backend
   */
  async initialize(onProgress = null) {
    if (this.initialized) return true

    try {
      if (onProgress) {
        onProgress({ status: 'loading', message: 'Initializing TensorFlow.js...', progress: 10 })
      }

      // Set backend preference (WebGL > WASM > CPU)
      await tf.ready()
      console.log('✅ TensorFlow.js backend:', tf.getBackend())
      console.log('   WebGL support:', tf.ENV.getBool('WEBGL_VERSION') > 0)

      if (onProgress) {
        onProgress({ status: 'loading', message: 'Loading separation model...', progress: 30 })
      }

      // TODO: Load pre-trained TensorFlow.js model
      // this.model = await tf.loadGraphModel('/models/stem-separation/model.json')
      // this.useAIModel = true

      if (onProgress) {
        onProgress({ status: 'ready', message: 'Stem separator ready (using audio filters demo)', progress: 100 })
      }

      this.initialized = true
      console.log('✅ Stem separator initialized')
      console.log('   Mode:', this.useAIModel ? 'AI Model' : 'Audio Filters Demo')

      return true
    } catch (error) {
      console.error('❌ Failed to initialize stem separator:', error)
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

      if (this.useAIModel && this.model) {
        // Use AI model for separation
        return await this.separateWithAI(audioBuffer, onProgress)
      } else {
        // Use frequency-based filtering as demo
        return await this.separateWithFilters(audioBuffer, onProgress)
      }
    } catch (error) {
      console.error('❌ Failed to separate stems:', error)
      throw error
    }
  }

  /**
   * Separate using TensorFlow.js AI model
   * @param {AudioBuffer} buffer - Input audio buffer
   * @param {Function} onProgress - Progress callback
   */
  async separateWithAI(buffer, onProgress) {
    if (onProgress) {
      onProgress({ status: 'processing', message: 'AI processing stems...', progress: 40 })
    }

    // TODO: Implement TensorFlow.js inference
    // 1. Convert AudioBuffer to tensor
    // 2. Run model inference
    // 3. Convert tensors back to AudioBuffers

    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : leftChannel

    // Placeholder for tensor conversion
    const audioTensor = tf.tensor2d([
      Array.from(leftChannel),
      Array.from(rightChannel)
    ])

    console.log('Audio tensor shape:', audioTensor.shape)

    // Clean up tensor
    audioTensor.dispose()

    // For now, fall back to filter-based separation
    return await this.separateWithFilters(buffer, onProgress)
  }

  /**
   * Separate using Web Audio API filters (demo mode)
   * @param {AudioBuffer} buffer - Input audio buffer
   * @param {Function} onProgress - Progress callback
   */
  async separateWithFilters(buffer, onProgress) {
    if (onProgress) {
      onProgress({ status: 'processing', message: 'Separating stems (filter-based demo)...', progress: 40 })
    }

    const startTime = performance.now()

    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    // === VOCALS STEM (High-pass filter + mid-frequency emphasis) ===
    const vocalsSource = offlineContext.createBufferSource()
    vocalsSource.buffer = buffer

    // High-pass filter to remove bass/drums
    const highPass = offlineContext.createBiquadFilter()
    highPass.type = 'highpass'
    highPass.frequency.value = 200 // Remove frequencies below 200Hz
    highPass.Q.value = 0.7

    // Band-pass for vocal range (300Hz - 3kHz)
    const bandPass = offlineContext.createBiquadFilter()
    bandPass.type = 'bandpass'
    bandPass.frequency.value = 1500 // Center of vocal range
    bandPass.Q.value = 1.5

    // Boost vocal frequencies
    const vocalsGain = offlineContext.createGain()
    vocalsGain.gain.value = 1.5

    vocalsSource.connect(highPass)
    highPass.connect(bandPass)
    bandPass.connect(vocalsGain)
    vocalsGain.connect(offlineContext.destination)
    vocalsSource.start(0)

    if (onProgress) {
      onProgress({ status: 'processing', message: 'Processing vocals...', progress: 60 })
    }

    const vocalsBuffer = await offlineContext.startRendering()

    // === INSTRUMENTAL STEM (Subtract vocals approximation) ===
    const instrumentalContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    // Create instrumental by emphasizing low frequencies and wide stereo
    const instSource = instrumentalContext.createBufferSource()
    instSource.buffer = buffer

    // Low-pass to emphasize bass/instruments
    const lowPass = instrumentalContext.createBiquadFilter()
    lowPass.type = 'lowpass'
    lowPass.frequency.value = 8000 // Keep everything below 8kHz
    lowPass.Q.value = 0.7

    // Slight bass boost
    const bassBoost = instrumentalContext.createBiquadFilter()
    bassBoost.type = 'lowshelf'
    bassBoost.frequency.value = 250
    bassBoost.gain.value = 3

    // Reduce mid frequencies (where vocals are)
    const midCut = instrumentalContext.createBiquadFilter()
    midCut.type = 'peaking'
    midCut.frequency.value = 1500
    midCut.Q.value = 1.5
    midCut.gain.value = -6 // Reduce vocal range

    const instGain = instrumentalContext.createGain()
    instGain.gain.value = 0.9

    instSource.connect(lowPass)
    lowPass.connect(bassBoost)
    bassBoost.connect(midCut)
    midCut.connect(instGain)
    instGain.connect(instrumentalContext.destination)
    instSource.start(0)

    if (onProgress) {
      onProgress({ status: 'processing', message: 'Processing instrumental...', progress: 80 })
    }

    const instrumentalBuffer = await instrumentalContext.startRendering()

    const processingTime = ((performance.now() - startTime) / 1000).toFixed(1)
    console.log(`✅ Stem separation completed in ${processingTime}s (filter-based demo)`)

    if (onProgress) {
      onProgress({ status: 'complete', message: 'Separation complete!', progress: 100 })
    }

    return {
      vocals: vocalsBuffer,
      instrumental: instrumentalBuffer
    }
  }

  /**
   * Load a TensorFlow.js model from URL
   * @param {string} modelUrl - URL to model.json
   */
  async loadModel(modelUrl) {
    try {
      console.log('Loading TensorFlow.js model from:', modelUrl)
      this.model = await tf.loadGraphModel(modelUrl)
      this.useAIModel = true
      console.log('✅ Model loaded successfully')
      console.log('   Inputs:', this.model.inputs.map(i => i.name))
      console.log('   Outputs:', this.model.outputs.map(o => o.name))
      return true
    } catch (error) {
      console.error('❌ Failed to load model:', error)
      throw error
    }
  }

  /**
   * Check TensorFlow.js status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      backend: tf.getBackend(),
      mode: this.useAIModel ? 'AI Model' : 'Audio Filters Demo',
      modelLoaded: this.model !== null,
      tfVersion: tf.version.tfjs
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.model) {
      this.model.dispose()
      this.model = null
    }
    this.useAIModel = false
    this.initialized = false
  }
}

// Export singleton instance
export const stemSeparator = new StemSeparator()
