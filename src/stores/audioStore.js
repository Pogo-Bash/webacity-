import { defineStore } from 'pinia'
import AudioEngine from '../audio/AudioEngine'
import WasmBridge from '../audio/WasmBridge'

export const useAudioStore = defineStore('audio', {
  state: () => ({
    engine: null,
    wasmBridge: null,
    tracks: [],
    selectedTrackId: null,
    selection: null, // { trackId, startTime, endTime }
    clipboard: null, // { buffer, duration }
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    zoom: 1,
    masterVolume: 1,
    projectName: 'Untitled Project',
    sampleRate: 44100,
    isInitialized: false
  }),

  getters: {
    selectedTrack: (state) => {
      return state.tracks.find(t => t.id === state.selectedTrackId)
    },

    trackCount: (state) => state.tracks.length,

    hasAudio: (state) => state.tracks.some(t => t.buffer !== null),

    longestTrackDuration: (state) => {
      return Math.max(0, ...state.tracks.map(t => t.duration || 0))
    },

    hasSelection: (state) => state.selection !== null,

    canCut: (state) => state.selection !== null,

    canCopy: (state) => state.selection !== null,

    canPaste: (state) => state.clipboard !== null && state.selectedTrackId !== null,

    canDelete: (state) => state.selection !== null
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
        this.isInitialized = true

        console.log('Audio store initialized')
      } catch (error) {
        console.error('Failed to initialize audio store:', error)
        throw error
      }
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
        waveformData: null,
        color: this.getRandomTrackColor()
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
        this.tracks.splice(index, 1)
        if (this.selectedTrackId === trackId) {
          this.selectedTrackId = this.tracks.length > 0 ? this.tracks[0].id : null
        }
      }
    },

    /**
     * Load audio file into a track
     */
    async loadAudioFile(file, trackId = null) {
      await this.init()

      try {
        const buffer = await this.engine.loadAudioFile(file)

        let targetTrackId = trackId
        if (!targetTrackId) {
          const track = this.addTrack(file.name)
          targetTrackId = track.id
        }

        this.engine.setTrackBuffer(targetTrackId, buffer)

        const track = this.tracks.find(t => t.id === targetTrackId)
        if (track) {
          track.buffer = buffer
          track.duration = buffer.duration
          track.waveformData = this.generateWaveformData(buffer)
        }

        this.updateDuration()

        return targetTrackId
      } catch (error) {
        console.error('Failed to load audio file:', error)
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
     * Play audio
     */
    play() {
      if (!this.engine || !this.hasAudio) return

      this.engine.play(this.currentTime)
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
     * Update total duration
     */
    updateDuration() {
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
     * Copy selection to clipboard
     */
    copySelection() {
      if (!this.selection) return false

      const track = this.tracks.find(t => t.id === this.selection.trackId)
      if (!track || !track.buffer) return false

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
        buffer: clipBuffer,
        duration: endTime - startTime
      }

      return true
    },

    /**
     * Cut selection (copy + delete)
     */
    cutSelection() {
      if (!this.copySelection()) return false
      return this.deleteSelection(this.selection.trackId, this.selection)
    },

    /**
     * Delete selection
     */
    deleteSelection(trackId, selection) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track || !track.buffer || !selection) return false

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

      track.buffer = newBuffer
      track.duration = newBuffer.duration
      this.engine.setTrackBuffer(trackId, newBuffer)
      track.waveformData = this.generateWaveformData(newBuffer)
      this.updateDuration()
      this.clearSelection()

      return true
    },

    /**
     * Paste clipboard at current position
     */
    pasteAtPosition(trackId, clipboardBuffer, position) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track || !track.buffer || !clipboardBuffer) return false

      const positionSample = Math.floor(position * this.sampleRate)
      const clipLength = clipboardBuffer.length
      const newLength = track.buffer.length + clipLength

      // Create new buffer with pasted audio
      const newBuffer = this.engine.audioContext.createBuffer(
        track.buffer.numberOfChannels,
        newLength,
        this.sampleRate
      )

      for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
        const originalData = track.buffer.getChannelData(ch)
        const clipData = clipboardBuffer.getChannelData(ch % clipboardBuffer.numberOfChannels)
        const newData = newBuffer.getChannelData(ch)

        // Copy before paste position
        newData.set(originalData.slice(0, positionSample), 0)
        // Copy clipboard
        newData.set(clipData, positionSample)
        // Copy after paste position
        newData.set(originalData.slice(positionSample), positionSample + clipLength)
      }

      track.buffer = newBuffer
      track.duration = newBuffer.duration
      this.engine.setTrackBuffer(trackId, newBuffer)
      track.waveformData = this.generateWaveformData(newBuffer)
      this.updateDuration()

      return true
    },

    /**
     * Apply effect to track (with selection support)
     */
    async applyEffectToTrack(trackId, effectName, params, selection = null) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track || !track.buffer) return

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

        // Apply effect using WASM bridge
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
        track.buffer = newBuffer
        this.engine.setTrackBuffer(trackId, newBuffer)
        track.waveformData = this.generateWaveformData(newBuffer)

        console.log(`Applied ${effectName} to track ${trackId}${selection ? ' (selection)' : ''}`)
      } catch (error) {
        console.error('Failed to apply effect:', error)
        throw error
      }
    },

    /**
     * Reset project
     */
    reset() {
      this.stop()
      this.tracks = []
      this.selectedTrackId = null
      this.selection = null
      this.clipboard = null
      this.currentTime = 0
      this.duration = 0
      this.projectName = 'Untitled Project'
    }
  }
})
