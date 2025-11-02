/**
 * FFmpeg.wasm Service
 * Handles audio file I/O and format conversion using FFmpeg.wasm
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

class FFmpegService {
  constructor() {
    this.ffmpeg = null
    this.isLoaded = false
    this.loadProgress = 0
    this.progressCallback = null
  }

  /**
   * Load FFmpeg.wasm with progress callbacks
   * @param {Function} onProgress - Callback for progress updates (0-100)
   */
  async load(onProgress = null) {
    if (this.isLoaded) {
      console.log('FFmpeg already loaded')
      return true
    }

    try {
      this.progressCallback = onProgress
      console.log('Loading FFmpeg.wasm...')

      this.ffmpeg = new FFmpeg()

      // Set up logging
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message)
      })

      // Set up progress tracking
      this.ffmpeg.on('progress', ({ progress, time }) => {
        this.loadProgress = Math.round(progress * 100)
        if (this.progressCallback) {
          this.progressCallback(this.loadProgress, time)
        }
      })

      // Load FFmpeg core from CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      this.isLoaded = true
      console.log('✅ FFmpeg.wasm loaded successfully')
      return true
    } catch (error) {
      console.error('Failed to load FFmpeg.wasm:', error)
      throw new Error(`FFmpeg load failed: ${error.message}`)
    }
  }

  /**
   * Convert any audio file format to AudioBuffer
   * @param {File} file - Input audio file
   * @param {AudioContext} audioContext - Web Audio API context
   * @returns {Promise<AudioBuffer>} Decoded audio buffer
   */
  async fileToAudioBuffer(file, audioContext) {
    if (!this.isLoaded) {
      await this.load()
    }

    try {
      console.log(`Converting ${file.name} to AudioBuffer...`)

      // Read file as array buffer
      const fileData = await file.arrayBuffer()
      const inputFileName = 'input' + this.getFileExtension(file.name)
      const outputFileName = 'output.wav'

      // Write input file to FFmpeg virtual filesystem
      await this.ffmpeg.writeFile(inputFileName, new Uint8Array(fileData))

      // Convert to WAV for Web Audio API compatibility
      // Force mono/stereo output and standard sample rate
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-acodec', 'pcm_f32le',  // 32-bit float PCM
        '-ar', '44100',          // Sample rate
        '-ac', '2',              // Force stereo (will upmix mono or downmix surround)
        outputFileName
      ])

      // Read output file
      const outputData = await this.ffmpeg.readFile(outputFileName)
      const outputBlob = new Blob([outputData.buffer], { type: 'audio/wav' })
      const outputArrayBuffer = await outputBlob.arrayBuffer()

      // Decode with Web Audio API
      const audioBuffer = await audioContext.decodeAudioData(outputArrayBuffer)

      // Clean up virtual filesystem
      await this.ffmpeg.deleteFile(inputFileName)
      await this.ffmpeg.deleteFile(outputFileName)

      console.log(`✅ Converted ${file.name} to AudioBuffer (${audioBuffer.duration.toFixed(2)}s)`)
      return audioBuffer
    } catch (error) {
      console.error('Failed to convert file to AudioBuffer:', error)
      throw new Error(`File conversion failed: ${error.message}`)
    }
  }

  /**
   * Export AudioBuffer to compressed audio format
   * @param {AudioBuffer} audioBuffer - Input audio buffer
   * @param {Object} options - Export options
   * @param {string} options.format - Output format: 'mp3', 'aac', 'opus', 'flac', 'wav'
   * @param {number} options.quality - Quality/bitrate (format-specific)
   * @param {string} options.filename - Output filename
   * @returns {Promise<{blob: Blob, filename: string}>}
   */
  async exportAudioBuffer(audioBuffer, options = {}) {
    if (!this.isLoaded) {
      await this.load()
    }

    const {
      format = 'mp3',
      quality = 192,
      filename = `export.${format}`
    } = options

    try {
      console.log(`Exporting AudioBuffer as ${format.toUpperCase()} (quality: ${quality})...`)

      // Convert AudioBuffer to WAV first (input for FFmpeg)
      const wavBlob = await this.audioBufferToWav(audioBuffer)
      const wavData = await wavBlob.arrayBuffer()

      const inputFileName = 'input.wav'
      const outputFileName = `output.${format}`

      // Write input WAV to virtual filesystem
      await this.ffmpeg.writeFile(inputFileName, new Uint8Array(wavData))

      // Build FFmpeg command based on format
      const ffmpegArgs = this.buildExportCommand(format, quality, inputFileName, outputFileName)

      // Execute FFmpeg conversion
      await this.ffmpeg.exec(ffmpegArgs)

      // Read output file
      const outputData = await this.ffmpeg.readFile(outputFileName)
      const outputBlob = new Blob([outputData.buffer], {
        type: this.getMimeType(format)
      })

      // Clean up
      await this.ffmpeg.deleteFile(inputFileName)
      await this.ffmpeg.deleteFile(outputFileName)

      console.log(`✅ Exported as ${format.toUpperCase()} (${(outputBlob.size / 1024).toFixed(2)} KB)`)

      return {
        blob: outputBlob,
        filename: filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`
      }
    } catch (error) {
      console.error('Failed to export AudioBuffer:', error)
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
        '-i', inputFile,
        '-codec:a', 'libmp3lame',
        '-b:a', `${quality}k`,
        '-ar', '44100',
        outputFile
      ],
      aac: [
        '-i', inputFile,
        '-codec:a', 'aac',
        '-b:a', `${quality}k`,
        '-ar', '44100',
        outputFile
      ],
      opus: [
        '-i', inputFile,
        '-codec:a', 'libopus',
        '-b:a', `${quality}k`,
        '-ar', '48000',
        outputFile
      ],
      flac: [
        '-i', inputFile,
        '-codec:a', 'flac',
        '-compression_level', Math.min(12, Math.floor(quality / 10)).toString(),
        outputFile
      ],
      wav: [
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
   * Convert multi-channel to stereo (helper)
   * @param {AudioBuffer} audioBuffer
   * @param {AudioContext} audioContext
   * @returns {AudioBuffer} Stereo audio buffer
   */
  convertToStereo(audioBuffer, audioContext) {
    if (audioBuffer.numberOfChannels === 2) {
      return audioBuffer
    }

    const length = audioBuffer.length
    const sampleRate = audioBuffer.sampleRate
    const stereoBuffer = audioContext.createBuffer(2, length, sampleRate)

    if (audioBuffer.numberOfChannels === 1) {
      // Mono to stereo: duplicate channel
      const mono = audioBuffer.getChannelData(0)
      stereoBuffer.getChannelData(0).set(mono)
      stereoBuffer.getChannelData(1).set(mono)
    } else {
      // Multi-channel to stereo: downmix
      const left = stereoBuffer.getChannelData(0)
      const right = stereoBuffer.getChannelData(1)

      for (let i = 0; i < length; i++) {
        let leftSum = 0
        let rightSum = 0

        // Simple downmix: average channels
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const sample = audioBuffer.getChannelData(ch)[i]
          if (ch % 2 === 0) {
            leftSum += sample
          } else {
            rightSum += sample
          }
        }

        const leftChannels = Math.ceil(audioBuffer.numberOfChannels / 2)
        const rightChannels = Math.floor(audioBuffer.numberOfChannels / 2)

        left[i] = leftSum / leftChannels
        right[i] = rightSum / (rightChannels || 1)
      }
    }

    return stereoBuffer
  }

  /**
   * Convert stereo to mono (helper)
   * @param {AudioBuffer} audioBuffer
   * @param {AudioContext} audioContext
   * @returns {AudioBuffer} Mono audio buffer
   */
  convertToMono(audioBuffer, audioContext) {
    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer
    }

    const length = audioBuffer.length
    const sampleRate = audioBuffer.sampleRate
    const monoBuffer = audioContext.createBuffer(1, length, sampleRate)
    const monoData = monoBuffer.getChannelData(0)

    // Average all channels
    for (let i = 0; i < length; i++) {
      let sum = 0
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        sum += audioBuffer.getChannelData(ch)[i]
      }
      monoData[i] = sum / audioBuffer.numberOfChannels
    }

    return monoBuffer
  }

  /**
   * Unload FFmpeg (cleanup)
   */
  async unload() {
    if (this.ffmpeg && this.isLoaded) {
      // FFmpeg.wasm doesn't have explicit unload, but we can reset state
      this.isLoaded = false
      this.ffmpeg = null
      console.log('FFmpeg unloaded')
    }
  }
}

// Singleton instance
const ffmpegService = new FFmpegService()

export default ffmpegService
