import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import AudioEngine from '../audio/AudioEngine'
import WasmBridge from '../audio/WasmBridge'
import AudioRecorder from '../audio/AudioRecorder'
import AudioGenerators from '../audio/AudioGenerators'
import AdvancedEffects from '../audio/AdvancedEffects'
import AudioAnalyzer from '../audio/AudioAnalyzer'
import ffmpegService from '../services/ffmpegService'
import { useHistoryStore } from './historyStore'
import { DeleteClipCommand, MoveClipCommand, CutClipCommand, PasteClipCommand } from '../utils/commands'

export const useAudioStore = defineStore('audio', {
  state: () => ({
    engine: null,
    wasmBridge: null,
    recorder: null,
    generators: null,
    advancedEffects: null,
    analyzer: null,
    tracks: [],
    selectedTrackId: null,
    selectedClipId: null, // Currently selected clip for copy/paste operations
    selection: null, // { trackId, startTime, endTime }
    clipboard: null, // { buffer, duration, startTime } for clips
    snippets: [], // { id, name, buffer, duration, waveformData }
    isPlaying: false,
    isRecording: false,
    recordingLevel: 0,
    currentTime: 0,
    duration: 0,
    zoom: 1,
    masterVolume: 1,
    projectName: 'Untitled Project',
    sampleRate: 44100,
    isInitialized: false,
    viewMode: 'waveform', // 'waveform' or 'spectrogram'
    timelineSnapInterval: 1, // Timeline snap/grid interval in seconds (1-30)
    exportFormat: 'mp3', // Export format: 'mp3', 'aac', 'opus', 'flac', 'wav'
    exportQuality: 192, // Export quality/bitrate
    ffmpegLoading: false,
    ffmpegLoadProgress: 0
  }),

  getters: {
    selectedTrack: (state) => {
      return state.tracks.find(t => t.id === state.selectedTrackId)
    },

    selectedClip: (state) => {
      if (!state.selectedClipId) return null
      for (const track of state.tracks) {
        const clip = track.clips.find(c => c.id === state.selectedClipId)
        if (clip) return { clip, trackId: track.id }
      }
      return null
    },

    trackCount: (state) => state.tracks.length,

    hasAudio: (state) => state.tracks.some(t => t.clips && t.clips.length > 0),

    longestTrackDuration: (state) => {
      let max = 0
      for (const track of state.tracks) {
        for (const clip of track.clips || []) {
          const end = clip.startTime + clip.duration
          if (end > max) max = end
        }
      }
      return max
    },

    hasSelection: (state) => state.selection !== null,

    canCut: (state) => state.selectedClipId !== null,

    canCopy: (state) => state.selectedClipId !== null,

    canPaste: (state) => state.clipboard !== null && state.selectedTrackId !== null,

    canDelete: (state) => state.selectedClipId !== null
  },

  actions: {
    /**
     * Initialize audio engine
     */
    async init() {
      if (this.isInitialized) return

      try {
        this.engine = new AudioEngine()
        await this.engine.init()

        this.wasmBridge = new WasmBridge()
        await this.wasmBridge.load()

        this.sampleRate = this.engine.sampleRate

        // Initialize new modules
        this.recorder = new AudioRecorder(this.engine.audioContext)
        this.generators = new AudioGenerators(this.engine.audioContext, this.sampleRate)
        this.advancedEffects = new AdvancedEffects(this.sampleRate)
        this.analyzer = new AudioAnalyzer(this.engine.audioContext, this.sampleRate)

        this.isInitialized = true

        console.log('Audio store initialized with all modules')
      } catch (error) {
        console.error('Failed to initialize audio store:', error)
        throw error
      }
    },

    /**
     * Create a new project (reset everything)
     */
    newProject() {
      // Confirm if there are tracks
      if (this.tracks.length > 0) {
        const confirmed = confirm('Create new project? All unsaved changes will be lost.')
        if (!confirmed) return false
      }

      // Stop playback
      if (this.isPlaying) {
        this.stop()
      }

      // Stop recording
      if (this.isRecording) {
        this.recorder.stop()
        this.isRecording = false
      }

      // Clear all tracks
      this.tracks.forEach(track => {
        if (this.engine) {
          this.engine.removeTrack(track.id)
        }
      })

      // Reset state
      this.tracks = []
      this.selectedTrackId = null
      this.selectedClipId = null
      this.selection = null
      this.clipboard = null
      this.currentTime = 0
      this.duration = 0
      this.zoom = 1
      this.masterVolume = 1
      this.projectName = 'Untitled Project'

      // Clear history
      const historyStore = useHistoryStore()
      historyStore.clear()

      console.log('✅ New project created')
      return true
    },

    /**
     * Create a new track
     */
    addTrack(name = null) {
      const id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const trackName = name || `Track ${this.tracks.length + 1}`

      const engineTrack = this.engine.createTrack(id, trackName)

      const track = {
        id,
        name: trackName,
        buffer: null,
        duration: 0,
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
        selected: false, // For slice selection
        waveformData: null,
        color: this.getRandomTrackColor(),
        clips: [] // Array of audio clips: { id, buffer, startTime, duration, waveformData, color }
      }

      this.tracks.push(track)
      this.selectedTrackId = id

      return track
    },

    /**
     * Remove a track
     */
    removeTrack(trackId) {
      const index = this.tracks.findIndex(t => t.id === trackId)
      if (index !== -1) {
        // Remove from engine first to stop playback
        if (this.engine) {
          this.engine.removeTrack(trackId)
        }

        // Remove from store
        this.tracks.splice(index, 1)

        // Update selected track
        if (this.selectedTrackId === trackId) {
          this.selectedTrackId = this.tracks.length > 0 ? this.tracks[0].id : null
        }

        // Clear selection if it was on this track
        if (this.selection && this.selection.trackId === trackId) {
          this.clearSelection()
        }

        // Update duration
        this.updateDuration()
      }
    },

    /**
     * Load audio file into a track with FFmpeg (tries FFmpeg first, falls back to Web Audio API)
     */
    async loadAudioFile(file, trackId = null) {
      await this.init()

      let buffer = null
      let usedFallback = false

      try {
        console.log(`📂 Loading audio file: ${file.name}`)

        // Try FFmpeg first for universal format support
        if (!ffmpegService.isLoaded) {
          this.ffmpegLoading = true
          console.log('🔄 Loading FFmpeg.wasm...')

          const loaded = await ffmpegService.load((progress, message) => {
            this.ffmpegLoadProgress = progress
            console.log(`FFmpeg: ${message}`)
          })

          this.ffmpegLoading = false

          if (!loaded) {
            console.warn('⚠️ FFmpeg failed to load, will use Web Audio API (limited format support)')
          }
        }

        // Try FFmpeg conversion
        if (ffmpegService.isLoaded) {
          try {
            console.log('🎵 Converting audio file with FFmpeg...')
            buffer = await ffmpegService.fileToAudioBuffer(
              file,
              this.engine.audioContext,
              (progress, message) => {
                console.log(`Conversion: ${message} (${progress}%)`)
              }
            )
            console.log(`✅ FFmpeg conversion successful (source: ${ffmpegService.loadSource})`)
          } catch (ffmpegError) {
            console.warn('⚠️ FFmpeg conversion failed, falling back to Web Audio API:', ffmpegError.message)
            usedFallback = true
          }
        } else {
          usedFallback = true
        }

        // Fallback to Web Audio API if FFmpeg failed
        if (!buffer && usedFallback) {
          console.log('🔄 Using Web Audio API to decode file (supports: WAV, MP3, OGG, M4A)')
          try {
            buffer = await this.engine.loadAudioFile(file)
            console.log('✅ Web Audio API decoding successful')
          } catch (webAudioError) {
            throw new Error(`Both FFmpeg and Web Audio API failed. File format may not be supported. Error: ${webAudioError.message}`)
          }
        }

        // Create track and add clip
        let targetTrackId = trackId
        if (!targetTrackId) {
          const track = this.addTrack(file.name)
          targetTrackId = track.id
        }

        // Add as a clip to the track
        this.addClipToTrack(targetTrackId, buffer, 0, file.name)

        const method = usedFallback ? 'Web Audio API' : 'FFmpeg'
        console.log(`✅ Successfully loaded ${file.name} using ${method}`)
        return targetTrackId
      } catch (error) {
        console.error('❌ Failed to load audio file:', error)
        throw error
      }
    },

    /**
     * Generate waveform visualization data
     */
    generateWaveformData(buffer, samples = 1000) {
      const channelData = buffer.getChannelData(0)
      const blockSize = Math.floor(channelData.length / samples)
      const waveformData = []

      for (let i = 0; i < samples; i++) {
        const start = i * blockSize
        const end = start + blockSize
        let min = 1
        let max = -1

        for (let j = start; j < end && j < channelData.length; j++) {
          const value = channelData[j]
          if (value < min) min = value
          if (value > max) max = value
        }

        waveformData.push({ min, max })
      }

      return waveformData
    },

    /**
     * Play audio by scheduling each clip on its track as a BufferSource.
     * Avoids ever pre-mixing clips into a single track buffer.
     */
    play() {
      if (!this.engine || !this.hasAudio) return

      this.engine.resume()
      // Small lookahead so the first scheduled source has time to be ready.
      const contextStartTime = this.engine.audioContext.currentTime + 0.1

      for (const track of this.tracks) {
        if (track.muted) continue
        this.engine.playTrackClips(track.id, track.clips, this.currentTime, contextStartTime)
      }

      this.engine.isPlaying = true
      this.isPlaying = true
    },

    /**
     * Pause audio
     */
    pause() {
      if (!this.engine) return

      this.engine.pause()
      this.isPlaying = false
    },

    /**
     * Stop audio
     */
    stop() {
      if (!this.engine) return

      this.engine.stop()
      this.isPlaying = false
      this.currentTime = 0
    },

    /**
     * Seek to time
     */
    seek(time) {
      const wasPlaying = this.isPlaying
      if (wasPlaying) {
        this.stop()
      }

      this.currentTime = Math.max(0, Math.min(time, this.duration))

      if (wasPlaying) {
        this.play()
      }
    },

    /**
     * Set track volume
     */
    setTrackVolume(trackId, volume) {
      const track = this.tracks.find(t => t.id === trackId)
      if (track) {
        track.volume = volume
        this.engine?.setTrackVolume(trackId, volume)
      }
    },

    /**
     * Set track pan
     */
    setTrackPan(trackId, pan) {
      const track = this.tracks.find(t => t.id === trackId)
      if (track) {
        track.pan = pan
        this.engine?.setTrackPan(trackId, pan)
      }
    },

    /**
     * Toggle track mute
     */
    toggleMute(trackId) {
      const track = this.tracks.find(t => t.id === trackId)
      if (track) {
        track.muted = !track.muted
        this.engine?.toggleMute(trackId)
      }
    },

    /**
     * Set master volume
     */
    setMasterVolume(volume) {
      this.masterVolume = volume
      this.engine?.setMasterVolume(volume)
    },

    /**
     * Export track as WAV
     */
    exportTrack(trackId) {
      const blob = this.engine.exportToWav(trackId)
      if (!blob) return null

      const track = this.tracks.find(t => t.id === trackId)
      const filename = `${track?.name || 'audio'}.wav`

      return { blob, filename }
    },

    /**
     * Export entire project (mix all tracks) with format and quality options
     */
    async exportProject(format = null, quality = null) {
      if (!this.hasAudio) {
        console.error('❌ No audio to export')
        return null
      }

      const exportFormat = format || this.exportFormat
      const exportQuality = quality || this.exportQuality

      try {
        console.log(`📤 Exporting project as ${exportFormat.toUpperCase()} (quality: ${exportQuality})...`)

        // Render all clips into a single buffer via an OfflineAudioContext.
        // During editing nothing mixes - this happens only on export.
        const mixedBuffer = await this.computeMixedBuffer()
        if (!mixedBuffer) {
          console.error('❌ Failed to get mixed buffer')
          return null
        }

        let blob, filename

        // Try FFmpeg for compressed formats, fallback to WAV
        if (exportFormat !== 'wav') {
          // Load FFmpeg if not already loaded
          if (!ffmpegService.isLoaded) {
            this.ffmpegLoading = true
            console.log('🔄 Loading FFmpeg for export...')

            const loaded = await ffmpegService.load((progress, message) => {
              this.ffmpegLoadProgress = progress
              console.log(`FFmpeg: ${message}`)
            })

            this.ffmpegLoading = false

            if (!loaded) {
              console.warn(`⚠️ FFmpeg failed to load. Falling back to WAV export.`)
              blob = this.engine.bufferToWav(mixedBuffer)
              filename = `${this.projectName || 'project'}.wav`
            }
          }

          // Try FFmpeg export
          if (ffmpegService.isLoaded && !blob) {
            try {
              console.log(`🎵 Exporting to ${exportFormat.toUpperCase()}...`)
              const result = await ffmpegService.exportAudioBuffer(
                mixedBuffer,
                {
                  format: exportFormat,
                  quality: exportQuality,
                  filename: `${this.projectName || 'project'}.${exportFormat}`
                },
                (progress, message) => {
                  console.log(`Export: ${message} (${progress}%)`)
                }
              )
              blob = result.blob
              filename = result.filename
              console.log(`✅ FFmpeg export successful (source: ${ffmpegService.loadSource})`)
            } catch (ffmpegError) {
              console.warn('⚠️ FFmpeg export failed, falling back to WAV:', ffmpegError.message)
              blob = this.engine.bufferToWav(mixedBuffer)
              filename = `${this.projectName || 'project'}.wav`
            }
          }
        } else {
          // Direct WAV export (no FFmpeg needed)
          console.log('🎵 Exporting to WAV...')
          blob = this.engine.bufferToWav(mixedBuffer)
          filename = `${this.projectName || 'project'}.wav`
        }

        if (!blob) {
          console.error('❌ Export failed - no blob created')
          return null
        }

        // Create download link
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        const sizeKB = (blob.size / 1024).toFixed(2)
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(2)
        const sizeStr = blob.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`

        console.log(`✅ Exported project: ${filename} (${sizeStr})`)
        return true
      } catch (error) {
        console.error('❌ Failed to export project:', error)
        throw error
      }
    },

    /**
     * Render all clips from all tracks into a single AudioBuffer via an
     * OfflineAudioContext. Used for export; never stored in memory during
     * editing.
     */
    async computeMixedBuffer() {
      if (!this.engine || !this.hasAudio) return null

      const trackSpecs = this.tracks.map(t => ({
        id: t.id,
        clips: t.clips,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted
      }))

      return await this.engine.renderTracksOffline(trackSpecs, this.masterVolume)
    },

    /**
     * Set export format
     */
    setExportFormat(format) {
      const validFormats = ['mp3', 'aac', 'opus', 'flac', 'wav']
      if (validFormats.includes(format)) {
        this.exportFormat = format
        console.log(`Export format set to: ${format.toUpperCase()}`)
      }
    },

    /**
     * Set export quality
     */
    setExportQuality(quality) {
      this.exportQuality = quality
      console.log(`Export quality set to: ${quality}`)
    },

    /**
     * Update each track's duration from its clips and the project duration
     * from the longest track.
     */
    updateDuration() {
      for (const track of this.tracks) {
        let end = 0
        for (const clip of track.clips) {
          const clipEnd = clip.startTime + clip.duration
          if (clipEnd > end) end = clipEnd
        }
        track.duration = end
      }
      this.duration = this.longestTrackDuration
    },

    /**
     * Get random track color
     */
    getRandomTrackColor() {
      const colors = [
        '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
        '#10b981', '#06b6d4', '#6366f1', '#ef4444'
      ]
      return colors[Math.floor(Math.random() * colors.length)]
    },

    /**
     * Remove all gaps between clips
     * Moves clips so they're all consecutive with no empty space
     */
    removeGaps() {
      let gapsRemoved = 0

      this.tracks.forEach(track => {
        if (track.clips.length === 0) return

        // Sort clips by start time
        track.clips.sort((a, b) => a.startTime - b.startTime)

        // Move each clip to start right after the previous one
        let currentTime = 0
        track.clips.forEach(clip => {
          if (clip.startTime !== currentTime) {
            gapsRemoved++
          }
          clip.startTime = currentTime
          currentTime += clip.duration
        })

        // Force reactivity
        track.clips = [...track.clips]
      })

      // Update total duration
      this.updateDuration()

      console.log(`✅ Removed gaps: ${gapsRemoved} clips repositioned`)
      return gapsRemoved
    },

    /**
     * Set selection
     */
    setSelection(trackId, startTime, endTime) {
      if (startTime > endTime) {
        [startTime, endTime] = [endTime, startTime]
      }
      this.selection = { trackId, startTime, endTime }
    },

    /**
     * Clear selection
     */
    clearSelection() {
      this.selection = null
    },

    /**
     * Find clip by ID across all tracks (helper for commands)
     */
    findClipById(clipId) {
      for (const track of this.tracks) {
        const clipIndex = track.clips.findIndex(c => c.id === clipId)
        if (clipIndex !== -1) {
          return {
            clip: track.clips[clipIndex],
            trackId: track.id,
            clipIndex
          }
        }
      }
      return null
    },

    /**
     * Copy selected clip to clipboard
     */
    copyClip() {
      if (!this.selectedClipId) return false

      const clipData = this.selectedClip
      if (!clipData) return false

      const { clip, trackId } = clipData

      // Copy clip data to clipboard
      this.clipboard = {
        buffer: markRaw(clip.buffer),
        duration: clip.duration,
        startTime: 0 // Will be pasted at cursor position
      }

      console.log(`Copied clip "${clip.name}" to clipboard`)
      return true
    },

    /**
     * Cut selected clip (copy + delete)
     */
    cutClip() {
      if (!this.selectedClipId) return false

      const clipData = this.selectedClip
      if (!clipData) return false

      const historyStore = useHistoryStore()
      const command = new CutClipCommand(this, this.selectedClipId)
      historyStore.execute(command)

      this.selectedClipId = null
      return true
    },

    /**
     * Paste clipboard as new clip at current time on selected track
     */
    pasteClip() {
      if (!this.clipboard || !this.selectedTrackId) return false

      const historyStore = useHistoryStore()
      const position = this.currentTime

      const command = new PasteClipCommand(this, this.selectedTrackId, position)
      historyStore.execute(command)

      console.log(`Pasted clip at ${position.toFixed(2)}s`)
      return true
    },

    /**
     * Delete selected clip (FIXED: now passes trackId correctly)
     */
    deleteClip() {
      if (!this.selectedClipId) return false

      const clipData = this.selectedClip
      if (!clipData) return false

      const { trackId } = clipData

      const historyStore = useHistoryStore()
      const command = new DeleteClipCommand(this, trackId, this.selectedClipId)
      historyStore.execute(command)

      this.selectedClipId = null
      return true
    },

    /**
     * Copy selection to clipboard (LEGACY - for backward compatibility)
     */
    copySelection() {
      if (!this.selection) return false

      const track = this.tracks.find(t => t.id === this.selection.trackId)
      if (!track) return false
      if (!track.buffer) this.updateTrackBufferFromClips(this.selection.trackId)
      if (!track.buffer) return false

      const { startTime, endTime } = this.selection
      const startSample = Math.floor(startTime * this.sampleRate)
      const endSample = Math.floor(endTime * this.sampleRate)
      const length = endSample - startSample

      // Create new buffer with selected audio
      const clipBuffer = this.engine.audioContext.createBuffer(
        track.buffer.numberOfChannels,
        length,
        this.sampleRate
      )

      for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
        const channelData = track.buffer.getChannelData(ch)
        const clipData = clipBuffer.getChannelData(ch)
        clipData.set(channelData.slice(startSample, endSample))
      }

      this.clipboard = {
        buffer: markRaw(clipBuffer),
        duration: endTime - startTime
      }

      return true
    },

    /**
     * Cut selection (copy + delete) (LEGACY)
     */
    cutSelection() {
      if (!this.copySelection()) return false
      return this.deleteSelection(this.selection.trackId, this.selection)
    },

    /**
     * Delete selection (LEGACY)
     */
    deleteSelection(trackId, selection) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track || !selection) return false
      if (!track.buffer) this.updateTrackBufferFromClips(trackId)
      if (!track.buffer) return false

      const { startTime, endTime } = selection
      const startSample = Math.floor(startTime * this.sampleRate)
      const endSample = Math.floor(endTime * this.sampleRate)

      const originalLength = track.buffer.length
      const newLength = originalLength - (endSample - startSample)

      // Create new buffer without the deleted section
      const newBuffer = this.engine.audioContext.createBuffer(
        track.buffer.numberOfChannels,
        newLength,
        this.sampleRate
      )

      for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
        const originalData = track.buffer.getChannelData(ch)
        const newData = newBuffer.getChannelData(ch)

        // Copy before selection
        newData.set(originalData.slice(0, startSample), 0)
        // Copy after selection
        newData.set(originalData.slice(endSample), startSample)
      }

      track.buffer = markRaw(newBuffer)
      track.duration = newBuffer.duration
      this.engine.setTrackBuffer(trackId, newBuffer)
      track.waveformData = markRaw(this.generateWaveformData(newBuffer))
      this.updateDuration()
      this.clearSelection()

      return true
    },

    /**
     * Paste clipboard at current position as a new clip.
     * Previously this spliced the clipboard into a single track buffer; with
     * the clip-based engine we simply add a clip at the target time.
     */
    pasteAtPosition(trackId, clipboardBuffer, position) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track || !clipboardBuffer) return false

      this.addClipToTrack(trackId, clipboardBuffer, position, 'Pasted')
      return true
    },

    /**
     * Apply effect to selected clip (supports ALL channels, not just stereo)
     */
    async applyEffectToClip(effectName, params) {
      console.log('🎵 Applying effect to clip:', effectName, params)

      if (!this.selectedClipId) {
        console.log('❌ No clip selected for effect')
        return false
      }

      const clipData = this.selectedClip
      if (!clipData) {
        console.log('❌ No clip data found')
        return false
      }

      console.log('✅ Found clip:', clipData.clip.name)

      const { clip, trackId } = clipData
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return false

      try {
        // Create new buffer with same properties
        const newBuffer = this.engine.audioContext.createBuffer(
          clip.buffer.numberOfChannels,
          clip.buffer.length,
          clip.buffer.sampleRate
        )

        // Process ALL channels (not just stereo)
        for (let ch = 0; ch < clip.buffer.numberOfChannels; ch++) {
          const channelData = clip.buffer.getChannelData(ch)
          let processedData

          // Apply effect using WASM bridge or advancedEffects
          switch (effectName) {
            case 'amplify':
              processedData = this.wasmBridge.amplify(channelData, params.factor)
              break
            case 'normalize':
              processedData = this.wasmBridge.normalize(channelData, params.targetPeak)
              break
            case 'fadeIn':
              processedData = this.wasmBridge.fadeIn(channelData, params.samples)
              break
            case 'fadeOut':
              processedData = this.wasmBridge.fadeOut(channelData, params.samples)
              break
            case 'reverse':
              processedData = this.wasmBridge.reverse(channelData)
              break
            case 'lowPass':
              processedData = this.wasmBridge.lowPassFilter(channelData, params.cutoff)
              break
            case 'highPass':
              processedData = this.wasmBridge.highPassFilter(channelData, params.cutoff)
              break
            case 'compress':
              processedData = this.wasmBridge.compress(
                channelData,
                params.threshold,
                params.ratio,
                params.attack,
                params.release
              )
              break
            case 'reverb':
              processedData = this.advancedEffects.reverb(
                channelData,
                params.roomSize,
                params.damping,
                params.wetLevel,
                params.dryLevel
              )
              break
            case 'equalizer':
              processedData = this.advancedEffects.equalizer(channelData, params.bands)
              break
            case 'pitch':
              processedData = this.advancedEffects.changePitch(channelData, params.semitones)
              break
            default:
              console.warn('Unknown effect:', effectName)
              return false
          }

          // Copy processed data to new buffer channel
          newBuffer.getChannelData(ch).set(processedData)
        }

        // Find the clip index in the track
        const clipIndex = track.clips.findIndex(c => c.id === this.selectedClipId)
        if (clipIndex === -1) {
          console.error('Clip index not found!')
          return false
        }

        console.log('Found clip at index:', clipIndex)

        // Create a new clip object with updated buffer and waveform (to trigger Vue reactivity)
        const updatedClip = {
          ...clip,
          buffer: markRaw(newBuffer),
          waveformData: markRaw(this.generateWaveformData(newBuffer))
        }

        console.log('Created updated clip with new waveform data')

        // Replace the clip in the array (this triggers Vue reactivity)
        track.clips.splice(clipIndex, 1, updatedClip)

        console.log('Updated clips array')
        this.updateDuration()

        console.log(`Applied ${effectName} to clip "${clip.name}" - effect complete`)
        return true
      } catch (error) {
        console.error('Failed to apply effect to clip:', error)
        throw error
      }
    },

    /**
     * Apply effect to track (with selection support)
     */
    async applyEffectToTrack(trackId, effectName, params, selection = null) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return
      if (!track.buffer) this.updateTrackBufferFromClips(trackId)
      if (!track.buffer) return

      try {
        let channelData = track.buffer.getChannelData(0)
        let startSample = 0
        let endSample = channelData.length

        // If selection, only process selected region
        if (selection) {
          startSample = Math.floor(selection.startTime * this.sampleRate)
          endSample = Math.floor(selection.endTime * this.sampleRate)
        }

        const selectedData = channelData.slice(startSample, endSample)
        let processedData

        // Apply effect using WASM bridge or advancedEffects
        switch (effectName) {
          case 'amplify':
            processedData = this.wasmBridge.amplify(selectedData, params.factor)
            break
          case 'normalize':
            processedData = this.wasmBridge.normalize(selectedData, params.targetPeak)
            break
          case 'fadeIn':
            processedData = this.wasmBridge.fadeIn(selectedData, params.samples)
            break
          case 'fadeOut':
            processedData = this.wasmBridge.fadeOut(selectedData, params.samples)
            break
          case 'reverse':
            processedData = this.wasmBridge.reverse(selectedData)
            break
          case 'lowPass':
            processedData = this.wasmBridge.lowPassFilter(selectedData, params.cutoff)
            break
          case 'highPass':
            processedData = this.wasmBridge.highPassFilter(selectedData, params.cutoff)
            break
          case 'compress':
            processedData = this.wasmBridge.compress(
              selectedData,
              params.threshold,
              params.ratio,
              params.attack,
              params.release
            )
            break
          case 'reverb':
            processedData = this.advancedEffects.reverb(
              selectedData,
              params.roomSize,
              params.damping,
              params.wetLevel,
              params.dryLevel
            )
            break
          case 'equalizer':
            processedData = this.advancedEffects.equalizer(selectedData, params.bands)
            break
          case 'pitch':
            processedData = this.advancedEffects.changePitch(selectedData, params.semitones)
            break
          default:
            console.warn('Unknown effect:', effectName)
            return
        }

        // Create new buffer with processed data
        const newBuffer = this.engine.audioContext.createBuffer(
          track.buffer.numberOfChannels,
          track.buffer.length,
          track.buffer.sampleRate
        )

        // Copy processed data to new buffer
        const newChannelData = newBuffer.getChannelData(0)
        newChannelData.set(track.buffer.getChannelData(0))
        newChannelData.set(processedData, startSample)

        // If stereo, copy/process other channels
        for (let i = 1; i < track.buffer.numberOfChannels; i++) {
          newBuffer.getChannelData(i).set(track.buffer.getChannelData(i))
        }

        // Update track
        track.buffer = markRaw(newBuffer)
        this.engine.setTrackBuffer(trackId, newBuffer)
        track.waveformData = markRaw(this.generateWaveformData(newBuffer))

        console.log(`Applied ${effectName} to track ${trackId}${selection ? ' (selection)' : ''}`)
      } catch (error) {
        console.error('Failed to apply effect:', error)
        throw error
      }
    },

    /**
     * Start recording from microphone
     */
    async startRecording() {
      await this.init()
      try {
        await this.recorder.startRecording()
        this.isRecording = true

        // Monitor recording level
        this.recorder.setupLevelMonitoring((level) => {
          this.recordingLevel = level
        })

        console.log('Recording started')
      } catch (error) {
        console.error('Failed to start recording:', error)
        throw error
      }
    },

    /**
     * Stop recording and create track
     */
    async stopRecording() {
      if (!this.isRecording) return null

      try {
        const audioBuffer = await this.recorder.stopRecording()
        this.isRecording = false
        this.recordingLevel = 0

        // Create new track with recorded audio
        const track = this.addTrack('Recording')
        this.addClipToTrack(track.id, audioBuffer, 0, 'Recording')

        console.log('Recording stopped, track created')
        return track.id
      } catch (error) {
        console.error('Failed to stop recording:', error)
        throw error
      }
    },

    /**
     * Generate tone and add as track
     */
    generateTone(frequency, duration, waveform = 'sine', amplitude = 0.5) {
      let buffer

      switch (waveform) {
        case 'sine':
          buffer = this.generators.generateTone(frequency, duration, amplitude)
          break
        case 'square':
          buffer = this.generators.generateSquareWave(frequency, duration, amplitude)
          break
        case 'sawtooth':
          buffer = this.generators.generateSawtoothWave(frequency, duration, amplitude)
          break
        default:
          buffer = this.generators.generateTone(frequency, duration, amplitude)
      }

      const track = this.addTrack(`${waveform} ${frequency}Hz`)
      this.addClipToTrack(track.id, buffer, 0, `${waveform} ${frequency}Hz`)

      return track.id
    },

    /**
     * Generate noise and add as track
     */
    generateNoise(duration, noiseType = 'white', amplitude = 0.3) {
      let buffer

      switch (noiseType) {
        case 'white':
          buffer = this.generators.generateWhiteNoise(duration, amplitude)
          break
        case 'pink':
          buffer = this.generators.generatePinkNoise(duration, amplitude)
          break
        case 'brown':
          buffer = this.generators.generateBrownNoise(duration, amplitude)
          break
        default:
          buffer = this.generators.generateWhiteNoise(duration, amplitude)
      }

      const track = this.addTrack(`${noiseType} noise`)
      this.addClipToTrack(track.id, buffer, 0, `${noiseType} noise`)

      return track.id
    },

    /**
     * Generate silence and add as track
     */
    generateSilence(duration) {
      const buffer = this.generators.generateSilence(duration)

      const track = this.addTrack('Silence')
      this.addClipToTrack(track.id, buffer, 0, 'Silence')

      return track.id
    },

    /**
     * Generate chirp and add as track
     */
    generateChirp(startFreq, endFreq, duration, amplitude = 0.5) {
      const buffer = this.generators.generateChirp(startFreq, endFreq, duration, amplitude)

      const track = this.addTrack(`Chirp ${startFreq}-${endFreq}Hz`)
      this.addClipToTrack(track.id, buffer, 0, `Chirp ${startFreq}-${endFreq}Hz`)

      return track.id
    },

    /**
     * Analyze track - get beats, tempo, spectrum
     */
    analyzeTrack(trackId) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return null
      // track.buffer isn't maintained during editing anymore - build it now
      // on demand from the track's clips.
      if (!track.buffer) this.updateTrackBufferFromClips(trackId)
      if (!track.buffer) return null

      const tempo = this.analyzer.estimateTempo(track.buffer)
      const peaks = this.analyzer.findPeaks(track.buffer)
      const rms = this.analyzer.calculateRMS(track.buffer)
      const peak = this.analyzer.calculatePeak(track.buffer)
      const silenceRegions = this.analyzer.detectSilence(track.buffer)

      return {
        tempo,
        peaks,
        rms,
        peak,
        silenceRegions,
        duration: track.duration
      }
    },

    /**
     * Generate spectrogram for track
     */
    generateSpectrogram(trackId) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return null
      if (!track.buffer) this.updateTrackBufferFromClips(trackId)
      if (!track.buffer) return null

      return this.analyzer.generateSpectrogram(track.buffer)
    },

    /**
     * Create snippet from selection
     */
    createSnippetFromSelection(name = null) {
      if (!this.selection) return null

      const track = this.tracks.find(t => t.id === this.selection.trackId)
      if (!track) return null
      if (!track.buffer) this.updateTrackBufferFromClips(this.selection.trackId)
      if (!track.buffer) return null

      const { startTime, endTime } = this.selection
      const duration = endTime - startTime

      // Extract the audio region
      const sampleRate = track.buffer.sampleRate
      const startSample = Math.floor(startTime * sampleRate)
      const endSample = Math.floor(endTime * sampleRate)
      const length = endSample - startSample

      // Create new buffer for snippet
      const snippetBuffer = this.engine.audioContext.createBuffer(
        track.buffer.numberOfChannels,
        length,
        sampleRate
      )

      // Copy audio data
      for (let channel = 0; channel < track.buffer.numberOfChannels; channel++) {
        const sourceData = track.buffer.getChannelData(channel)
        const snippetData = snippetBuffer.getChannelData(channel)
        for (let i = 0; i < length; i++) {
          snippetData[i] = sourceData[startSample + i]
        }
      }

      // Create snippet object
      const snippetId = `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const snippetName = name || `Snippet ${this.snippets.length + 1}`

      const snippet = {
        id: snippetId,
        name: snippetName,
        buffer: markRaw(snippetBuffer),
        duration,
        waveformData: markRaw(this.generateWaveformData(snippetBuffer))
      }

      this.snippets.push(snippet)
      return snippet
    },

    /**
     * Place snippet into track at position (creates a new clip)
     */
    placeSnippet(snippetId, trackId, position = 0) {
      const snippet = this.snippets.find(s => s.id === snippetId)
      if (!snippet) {
        console.error('Snippet not found:', snippetId)
        return false
      }

      // Add snippet as a clip to the track
      const clip = this.addClipToTrack(trackId, snippet.buffer, position, snippet.name)

      if (clip) {
        console.log('Placed snippet as clip at position', position)
        return true
      }

      return false
    },

    /**
     * Remove snippet
     */
    removeSnippet(snippetId) {
      const index = this.snippets.findIndex(s => s.id === snippetId)
      if (index !== -1) {
        this.snippets.splice(index, 1)
        return true
      }
      return false
    },

    /**
     * Add clip to track
     */
    addClipToTrack(trackId, buffer, startTime = 0, name = null) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return null

      const clipId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const clip = {
        id: clipId,
        name: name || `Clip ${track.clips.length + 1}`,
        buffer: markRaw(buffer),
        startTime,
        duration: buffer.duration,
        waveformData: markRaw(this.generateWaveformData(buffer)),
        color: track.color
      }

      track.clips.push(clip)
      this.updateDuration()

      return clip
    },

    /**
     * Move clip to different track or position
     */
    moveClip(clipId, fromTrackId, toTrackId, newStartTime) {
      const fromTrack = this.tracks.find(t => t.id === fromTrackId)
      if (!fromTrack) return false

      const clipIndex = fromTrack.clips.findIndex(c => c.id === clipId)
      if (clipIndex === -1) return false

      const clip = fromTrack.clips[clipIndex]
      const oldStartTime = clip.startTime

      // Snap to grid if enabled
      if (this.timelineSnapInterval > 0) {
        newStartTime = Math.round(newStartTime / this.timelineSnapInterval) * this.timelineSnapInterval
      }

      const historyStore = useHistoryStore()
      const command = new MoveClipCommand(
        this,
        clipId,
        fromTrackId,
        toTrackId,
        oldStartTime,
        Math.max(0, newStartTime)
      )
      historyStore.execute(command)

      return true
    },

    /**
     * Remove clip from track (with Vue reactivity fix)
     */
    removeClip(trackId, clipId) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return false

      const index = track.clips.findIndex(c => c.id === clipId)
      if (index === -1) return false

      // Remove clip
      track.clips.splice(index, 1)

      this.updateDuration()

      console.log(`Removed clip ${clipId} from track ${trackId}`)
      return true
    },

    /**
     * Update track buffer from all clips (mix them together)
     */
    updateTrackBufferFromClips(trackId) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return

      // If no clips, clear track
      if (track.clips.length === 0) {
        track.buffer = null
        track.duration = 0
        track.waveformData = null
        this.engine.setTrackBuffer(trackId, null)
        return
      }

      // Calculate total duration needed
      const maxEndTime = Math.max(...track.clips.map(c => c.startTime + c.duration))
      const sampleRate = track.clips[0].buffer.sampleRate
      const totalSamples = Math.ceil(maxEndTime * sampleRate)

      // Create mixed buffer
      const numChannels = Math.max(...track.clips.map(c => c.buffer.numberOfChannels))
      const mixedBuffer = this.engine.audioContext.createBuffer(
        numChannels,
        totalSamples,
        sampleRate
      )

      // Initialize with silence
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = mixedBuffer.getChannelData(ch)
        channelData.fill(0)
      }

      // Mix in each clip
      for (const clip of track.clips) {
        const startSample = Math.floor(clip.startTime * sampleRate)

        for (let ch = 0; ch < numChannels; ch++) {
          const mixedData = mixedBuffer.getChannelData(ch)
          const clipChannelIndex = Math.min(ch, clip.buffer.numberOfChannels - 1)
          const clipData = clip.buffer.getChannelData(clipChannelIndex)

          for (let i = 0; i < clipData.length; i++) {
            const destIndex = startSample + i
            if (destIndex < totalSamples) {
              // Mix audio (simple addition with clamping)
              mixedData[destIndex] = Math.max(-1, Math.min(1, mixedData[destIndex] + clipData[i]))
            }
          }
        }
      }

      // Update track
      track.buffer = markRaw(mixedBuffer)
      track.duration = maxEndTime
      track.waveformData = markRaw(this.generateWaveformData(mixedBuffer))
      this.engine.setTrackBuffer(trackId, mixedBuffer)
    },

    /**
     * Get clips that overlap at a given time
     */
    getOverlappingClips(trackId, time) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return []

      return track.clips.filter(clip => {
        return time >= clip.startTime && time < clip.startTime + clip.duration
      })
    },

    /**
     * Split clip at a specific time
     */
    splitClipAtTime(trackId, clipId, splitTime) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track) return false

      const clipIndex = track.clips.findIndex(c => c.id === clipId)
      if (clipIndex === -1) return false

      const clip = track.clips[clipIndex]

      // Check if split time is within the clip
      const clipEndTime = clip.startTime + clip.duration
      if (splitTime <= clip.startTime || splitTime >= clipEndTime) {
        console.log('Split time is outside clip bounds')
        return false
      }

      // Calculate the split point within the clip's buffer
      const relativeTime = splitTime - clip.startTime
      const sampleRate = clip.buffer.sampleRate
      const splitSample = Math.floor(relativeTime * sampleRate)

      // Create first part (clip start to split point)
      const firstPartLength = splitSample
      const firstBuffer = this.engine.audioContext.createBuffer(
        clip.buffer.numberOfChannels,
        firstPartLength,
        sampleRate
      )

      // Create second part (split point to clip end)
      const secondPartLength = clip.buffer.length - splitSample
      const secondBuffer = this.engine.audioContext.createBuffer(
        clip.buffer.numberOfChannels,
        secondPartLength,
        sampleRate
      )

      // Copy audio data
      for (let channel = 0; channel < clip.buffer.numberOfChannels; channel++) {
        const sourceData = clip.buffer.getChannelData(channel)
        const firstData = firstBuffer.getChannelData(channel)
        const secondData = secondBuffer.getChannelData(channel)

        // Copy first part
        for (let i = 0; i < firstPartLength; i++) {
          firstData[i] = sourceData[i]
        }

        // Copy second part
        for (let i = 0; i < secondPartLength; i++) {
          secondData[i] = sourceData[splitSample + i]
        }
      }

      // Update the original clip to be the first part
      clip.buffer = markRaw(firstBuffer)
      clip.duration = firstBuffer.duration
      clip.waveformData = markRaw(this.generateWaveformData(firstBuffer))

      // Create new clip for the second part
      const secondClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${clip.name} (2)`,
        buffer: markRaw(secondBuffer),
        startTime: splitTime,
        duration: secondBuffer.duration,
        waveformData: markRaw(this.generateWaveformData(secondBuffer)),
        color: clip.color
      }

      // Insert the second clip right after the first one
      track.clips.splice(clipIndex + 1, 0, secondClip)

      this.updateDuration()

      console.log(`Split clip "${clip.name}" at ${splitTime.toFixed(2)}s`)
      return true
    },

    /**
     * Split all clips at a given time on selected tracks
     */
    sliceAtPlayhead(time) {
      const selectedTracks = this.tracks.filter(t => t.selected)

      if (selectedTracks.length === 0) {
        console.log('No tracks selected for slicing')
        return 0
      }

      let sliceCount = 0

      for (const track of selectedTracks) {
        // Find clips that contain this time
        const clipsToSplit = track.clips.filter(clip => {
          const clipEndTime = clip.startTime + clip.duration
          return time > clip.startTime && time < clipEndTime
        })

        for (const clip of clipsToSplit) {
          if (this.splitClipAtTime(track.id, clip.id, time)) {
            sliceCount++
          }
        }
      }

      console.log(`Sliced ${sliceCount} clip(s) at ${time.toFixed(2)}s`)
      return sliceCount
    },

    /**
     * Reset project
     */
    reset() {
      this.stop()
      if (this.isRecording) {
        this.recorder.destroy()
        this.isRecording = false
      }
      this.tracks = []
      this.selectedTrackId = null
      this.selection = null
      this.clipboard = null
      this.snippets = []
      this.currentTime = 0
      this.duration = 0
      this.projectName = 'Untitled Project'
    }
  }
})
