/**
 * FFmpeg.wasm Service with Robust Fallback Strategy
 *
 * Loading Strategy:
 * 1. Try self-hosted files from /ffmpeg/ (fastest, most reliable)
 * 2. Fall back to jsdelivr CDN
 * 3. Fall back to unpkg CDN
 * 4. If all fail, return null (caller should use Web Audio API fallback)
 *
 * Based on Vext.sh's approach for maximum reliability
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'

class FFmpegService {
  constructor() {
    this.ffmpeg = null
    this.isLoaded = false
    this.loadProgress = 0
    this.progressCallback = null
    this.loadSource = null // Track which source was used: 'self-hosted', 'jsdelivr', 'unpkg', or null
  }

  /**
   * Load FFmpeg.wasm with multi-source fallback strategy
   * @param {Function} onProgress - Callback for progress updates (0-100)
   * @returns {Promise<boolean>} Success status
   */
  async load(onProgress = null) {
    if (this.isLoaded) {
      console.log('✅ FFmpeg already loaded from:', this.loadSource)
      return true
    }

    this.progressCallback = onProgress
    console.log('🔄 Loading FFmpeg.wasm...')

    // Try loading from different sources in order
    const sources = [
      { name: 'self-hosted', loader: () => this.loadFromSelfHosted() },
      { name: 'jsdelivr', loader: () => this.loadFromCDN('jsdelivr') },
      { name: 'unpkg', loader: () => this.loadFromCDN('unpkg') }
    ]

    for (const source of sources) {
      try {
        console.log(`Attempting to load FFmpeg from ${source.name}...`)
        await source.loader()
        this.isLoaded = true
        this.loadSource = source.name
        console.log(`✅ FFmpeg.wasm loaded successfully from ${source.name}`)

        if (this.progressCallback) {
          this.progressCallback(100, 'FFmpeg loaded successfully')
        }

        return true
      } catch (error) {
        console.warn(`⚠️ Failed to load FFmpeg from ${source.name}:`, error.message)
        // Continue to next source
      }
    }

    // All sources failed
    console.error('❌ Failed to load FFmpeg from all sources')
    this.isLoaded = false
    this.loadSource = null

    if (this.progressCallback) {
      this.progressCallback(0, 'FFmpeg load failed - will use basic audio decoding')
    }

    return false
  }

  /**
   * Load FFmpeg from self-hosted files in /ffmpeg/
   * @private
   */
  async loadFromSelfHosted() {
    const baseURL = window.location.origin + '/ffmpeg'

    this.ffmpeg = new FFmpeg()

    // Set up logging
    this.ffmpeg.on('log', ({ message }) => {
      if (!message.includes('Opening')) { // Reduce noise
        console.log('[FFmpeg]', message)
      }
    })

    // Set up progress tracking
    this.ffmpeg.on('progress', ({ progress, time }) => {
      this.loadProgress = Math.round(progress * 100)
      if (this.progressCallback) {
        this.progressCallback(this.loadProgress, `Loading: ${this.loadProgress}%`)
      }
    })

    // Load from self-hosted files using toBlobURL for cross-origin safety
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
    })
  }

  /**
   * Load FFmpeg from CDN (jsdelivr or unpkg)
   * @param {string} cdn - CDN name: 'jsdelivr' or 'unpkg'
   * @private
   */
  async loadFromCDN(cdn) {
    const version = '0.12.6'

    const cdnURLs = {
      jsdelivr: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${version}/dist/umd`,
      unpkg: `https://unpkg.com/@ffmpeg/core@${version}/dist/umd`
    }

    const baseURL = cdnURLs[cdn]
    if (!baseURL) {
      throw new Error(`Unknown CDN: ${cdn}`)
    }

    this.ffmpeg = new FFmpeg()

    // Set up logging
    this.ffmpeg.on('log', ({ message }) => {
      if (!message.includes('Opening')) {
        console.log('[FFmpeg]', message)
      }
    })

    // Set up progress tracking
    this.ffmpeg.on('progress', ({ progress, time }) => {
      this.loadProgress = Math.round(progress * 100)
      if (this.progressCallback) {
        this.progressCallback(this.loadProgress, `Loading from ${cdn}: ${this.loadProgress}%`)
      }
    })

    // Load from CDN using toBlobURL
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
    })
  }

  /**
   * Convert any audio file format to AudioBuffer
   * @param {File} file - Input audio file
   * @param {AudioContext} audioContext - Web Audio API context
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<AudioBuffer>} Decoded audio buffer
   */
  async fileToAudioBuffer(file, audioContext, onProgress = null) {
    if (!this.isLoaded) {
      throw new Error('FFmpeg not loaded. Call load() first or use Web Audio API fallback.')
    }

    try {
      if (onProgress) {
        onProgress(10, 'Reading file...')
      }

      // Read file as array buffer
      const fileData = await file.arrayBuffer()
      const inputFileName = 'input' + this.getFileExtension(file.name)
      const outputFileName = 'output.wav'

      if (onProgress) {
        onProgress(30, 'Converting audio format...')
      }

      // Write input file to FFmpeg virtual filesystem
      await this.ffmpeg.writeFile(inputFileName, new Uint8Array(fileData))

      // Convert to WAV for Web Audio API compatibility
      // Use -y to overwrite, -hide_banner for cleaner logs
      await this.ffmpeg.exec([
        '-y',
        '-hide_banner',
        '-i', inputFileName,
        '-acodec', 'pcm_f32le',  // 32-bit float PCM
        '-ar', '44100',          // Sample rate
        '-ac', '2',              // Force stereo (will upmix mono or downmix surround)
        outputFileName
      ])

      if (onProgress) {
        onProgress(70, 'Decoding audio...')
      }

      // Read output file
      const outputData = await this.ffmpeg.readFile(outputFileName)
      const outputBlob = new Blob([outputData.buffer], { type: 'audio/wav' })
      const outputArrayBuffer = await outputBlob.arrayBuffer()

      // Decode with Web Audio API
      const audioBuffer = await audioContext.decodeAudioData(outputArrayBuffer)

      // Clean up virtual filesystem
      try {
        await this.ffmpeg.deleteFile(inputFileName)
        await this.ffmpeg.deleteFile(outputFileName)
      } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError.message)
      }

      if (onProgress) {
        onProgress(100, 'Complete!')
      }

      console.log(`✅ Converted ${file.name} to AudioBuffer (${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels)`)
      return audioBuffer
    } catch (error) {
      console.error('❌ FFmpeg conversion failed:', error)
      throw new Error(`Audio conversion failed: ${error.message}`)
    }
  }

  /**
   * Export AudioBuffer to compressed audio format
   * @param {AudioBuffer} audioBuffer - Input audio buffer
   * @param {Object} options - Export options
   * @param {string} options.format - Output format: 'mp3', 'aac', 'opus', 'flac', 'wav'
   * @param {number} options.quality - Quality/bitrate (format-specific)
   * @param {string} options.filename - Output filename
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<{blob: Blob, filename: string}>}
   */
  async exportAudioBuffer(audioBuffer, options = {}, onProgress = null) {
    if (!this.isLoaded) {
      throw new Error('FFmpeg not loaded. Call load() first.')
    }

    const {
      format = 'mp3',
      quality = 192,
      filename = `export.${format}`
    } = options

    try {
      if (onProgress) {
        onProgress(10, `Preparing ${format.toUpperCase()} export...`)
      }

      // Convert AudioBuffer to WAV first (input for FFmpeg)
      const wavBlob = await this.audioBufferToWav(audioBuffer)
      const wavData = await wavBlob.arrayBuffer()

      const inputFileName = 'input.wav'
      const outputFileName = `output.${format}`

      if (onProgress) {
        onProgress(30, `Encoding to ${format.toUpperCase()}...`)
      }

      // Write input WAV to virtual filesystem
      await this.ffmpeg.writeFile(inputFileName, new Uint8Array(wavData))

      // Build FFmpeg command based on format
      const ffmpegArgs = this.buildExportCommand(format, quality, inputFileName, outputFileName)

      // Execute FFmpeg conversion
      await this.ffmpeg.exec(ffmpegArgs)

      if (onProgress) {
        onProgress(80, 'Finalizing export...')
      }

      // Read output file
      const outputData = await this.ffmpeg.readFile(outputFileName)
      const outputBlob = new Blob([outputData.buffer], {
        type: this.getMimeType(format)
      })

      // Clean up
      try {
        await this.ffmpeg.deleteFile(inputFileName)
        await this.ffmpeg.deleteFile(outputFileName)
      } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError.message)
      }

      if (onProgress) {
        onProgress(100, 'Export complete!')
      }

      const finalFilename = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`
      console.log(`✅ Exported as ${format.toUpperCase()} (${(outputBlob.size / 1024).toFixed(2)} KB)`)

      return {
        blob: outputBlob,
        filename: finalFilename
      }
    } catch (error) {
      console.error('❌ Export failed:', error)
      throw new Error(`Export failed: ${error.message}`)
    }
  }

  /**
   * Convert AudioBuffer to WAV blob (helper for FFmpeg input)
   * @param {AudioBuffer} audioBuffer
   * @returns {Promise<Blob>}
   */
  async audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length

    // Interleave channels
    const interleavedData = new Float32Array(length * numberOfChannels)
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        interleavedData[i * numberOfChannels + channel] = channelData[i]
      }
    }

    // Convert to 16-bit PCM
    const pcmData = new Int16Array(interleavedData.length)
    for (let i = 0; i < interleavedData.length; i++) {
      const sample = Math.max(-1, Math.min(1, interleavedData[i]))
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
    }

    // Create WAV file
    const wavBuffer = this.createWavFile(pcmData, numberOfChannels, sampleRate)
    return new Blob([wavBuffer], { type: 'audio/wav' })
  }

  /**
   * Create WAV file buffer
   * @private
   */
  createWavFile(pcmData, numberOfChannels, sampleRate) {
    const byteRate = sampleRate * numberOfChannels * 2 // 16-bit
    const blockAlign = numberOfChannels * 2
    const dataSize = pcmData.length * 2

    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    // RIFF header
    this.writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    this.writeString(view, 8, 'WAVE')

    // fmt chunk
    this.writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // fmt chunk size
    view.setUint16(20, 1, true) // PCM format
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true) // bits per sample

    // data chunk
    this.writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    // Write PCM data
    const dataView = new Int16Array(buffer, 44)
    dataView.set(pcmData)

    return buffer
  }

  /**
   * Write string to DataView
   * @private
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  /**
   * Build FFmpeg export command based on format
   * @private
   */
  buildExportCommand(format, quality, inputFile, outputFile) {
    const commands = {
      mp3: [
        '-y',
        '-hide_banner',
        '-i', inputFile,
        '-codec:a', 'libmp3lame',
        '-b:a', `${quality}k`,
        '-ar', '44100',
        outputFile
      ],
      aac: [
        '-y',
        '-hide_banner',
        '-i', inputFile,
        '-codec:a', 'aac',
        '-b:a', `${quality}k`,
        '-ar', '44100',
        outputFile
      ],
      opus: [
        '-y',
        '-hide_banner',
        '-i', inputFile,
        '-codec:a', 'libopus',
        '-b:a', `${quality}k`,
        '-ar', '48000',
        outputFile
      ],
      flac: [
        '-y',
        '-hide_banner',
        '-i', inputFile,
        '-codec:a', 'flac',
        '-compression_level', Math.min(12, Math.floor(quality / 10)).toString(),
        outputFile
      ],
      wav: [
        '-y',
        '-hide_banner',
        '-i', inputFile,
        '-codec:a', 'pcm_s16le',
        '-ar', '44100',
        outputFile
      ]
    }

    return commands[format] || commands.mp3
  }

  /**
   * Get MIME type for format
   * @private
   */
  getMimeType(format) {
    const mimeTypes = {
      mp3: 'audio/mpeg',
      aac: 'audio/aac',
      opus: 'audio/opus',
      flac: 'audio/flac',
      wav: 'audio/wav'
    }
    return mimeTypes[format] || 'audio/mpeg'
  }

  /**
   * Get file extension from filename
   * @private
   */
  getFileExtension(filename) {
    const match = filename.match(/\.[^.]+$/)
    return match ? match[0] : '.mp3'
  }

  /**
   * Check if FFmpeg is loaded and which source was used
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isLoaded: this.isLoaded,
      source: this.loadSource,
      progress: this.loadProgress
    }
  }

  /**
   * Unload FFmpeg (cleanup)
   */
  async unload() {
    if (this.ffmpeg && this.isLoaded) {
      // FFmpeg.wasm doesn't have explicit unload, but we can reset state
      this.isLoaded = false
      this.ffmpeg = null
      this.loadSource = null
      console.log('FFmpeg unloaded')
    }
  }
}

// Singleton instance
const ffmpegService = new FFmpegService()

export default ffmpegService
