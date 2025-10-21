import { defineStore } from 'pinia'
import AudioEngine from '../audio/AudioEngine'
import WasmBridge from '../audio/WasmBridge'

export const useAudioStore = defineStore('audio', {
  state: () => ({
    engine: null,
    wasmBridge: null,
    tracks: [],
    selectedTrackId: null,
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
    }
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
     * Apply effect to track
     */
    async applyEffect(trackId, effectName, params) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track || !track.buffer) return

      try {
        // Get buffer data
        const channelData = track.buffer.getChannelData(0)
        let processedData

        // Apply effect using WASM bridge
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
        newBuffer.getChannelData(0).set(processedData)

        // If stereo, copy other channels
        for (let i = 1; i < track.buffer.numberOfChannels; i++) {
          newBuffer.getChannelData(i).set(track.buffer.getChannelData(i))
        }

        // Update track
        track.buffer = newBuffer
        this.engine.setTrackBuffer(trackId, newBuffer)
        track.waveformData = this.generateWaveformData(newBuffer)

        console.log(`Applied ${effectName} to track ${trackId}`)
      } catch (error) {
        console.error('Failed to apply effect:', error)
        throw error
      }
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
     * Reset project
     */
    reset() {
      this.stop()
      this.tracks = []
      this.selectedTrackId = null
      this.currentTime = 0
      this.duration = 0
      this.projectName = 'Untitled Project'
    }
  }
})
