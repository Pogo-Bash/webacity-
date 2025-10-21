import { defineStore } from 'pinia'
import AudioEngine from '../audio/AudioEngine'
import WasmBridge from '../audio/WasmBridge'
import AudioRecorder from '../audio/AudioRecorder'
import AudioGenerators from '../audio/AudioGenerators'
import AdvancedEffects from '../audio/AdvancedEffects'
import AudioAnalyzer from '../audio/AudioAnalyzer'

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
    selection: null, // { trackId, startTime, endTime }
    clipboard: null, // { buffer, duration }
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
    viewMode: 'waveform' // 'waveform' or 'spectrogram'
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
        track.buffer = audioBuffer
        track.duration = audioBuffer.duration
        this.engine.setTrackBuffer(track.id, audioBuffer)
        track.waveformData = this.generateWaveformData(audioBuffer)
        this.updateDuration()

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
      track.buffer = buffer
      track.duration = duration
      this.engine.setTrackBuffer(track.id, buffer)
      track.waveformData = this.generateWaveformData(buffer)
      this.updateDuration()

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
      track.buffer = buffer
      track.duration = duration
      this.engine.setTrackBuffer(track.id, buffer)
      track.waveformData = this.generateWaveformData(buffer)
      this.updateDuration()

      return track.id
    },

    /**
     * Generate silence and add as track
     */
    generateSilence(duration) {
      const buffer = this.generators.generateSilence(duration)

      const track = this.addTrack('Silence')
      track.buffer = buffer
      track.duration = duration
      this.engine.setTrackBuffer(track.id, buffer)
      track.waveformData = this.generateWaveformData(buffer)
      this.updateDuration()

      return track.id
    },

    /**
     * Generate chirp and add as track
     */
    generateChirp(startFreq, endFreq, duration, amplitude = 0.5) {
      const buffer = this.generators.generateChirp(startFreq, endFreq, duration, amplitude)

      const track = this.addTrack(`Chirp ${startFreq}-${endFreq}Hz`)
      track.buffer = buffer
      track.duration = duration
      this.engine.setTrackBuffer(track.id, buffer)
      track.waveformData = this.generateWaveformData(buffer)
      this.updateDuration()

      return track.id
    },

    /**
     * Analyze track - get beats, tempo, spectrum
     */
    analyzeTrack(trackId) {
      const track = this.tracks.find(t => t.id === trackId)
      if (!track || !track.buffer) return null

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
      if (!track || !track.buffer) return null

      return this.analyzer.generateSpectrogram(track.buffer)
    },

    /**
     * Create snippet from selection
     */
    createSnippetFromSelection(name = null) {
      if (!this.selection) return null

      const track = this.tracks.find(t => t.id === this.selection.trackId)
      if (!track || !track.buffer) return null

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
        buffer: snippetBuffer,
        duration,
        waveformData: this.generateWaveformData(snippetBuffer)
      }

      this.snippets.push(snippet)
      return snippet
    },

    /**
     * Place snippet into track at position
     */
    placeSnippet(snippetId, trackId, position = 0) {
      const snippet = this.snippets.find(s => s.id === snippetId)
      if (!snippet) return false

      const track = this.tracks.find(t => t.id === trackId)
      if (!track || !track.buffer) return false

      const sampleRate = track.buffer.sampleRate
      const positionSample = Math.floor(position * sampleRate)

      // Calculate new buffer size
      const snippetLength = snippet.buffer.length
      const newLength = Math.max(
        track.buffer.length,
        positionSample + snippetLength
      )

      // Create new buffer
      const newBuffer = this.engine.audioContext.createBuffer(
        track.buffer.numberOfChannels,
        newLength,
        sampleRate
      )

      // Copy original track data
      for (let channel = 0; channel < track.buffer.numberOfChannels; channel++) {
        const sourceData = track.buffer.getChannelData(channel)
        const destData = newBuffer.getChannelData(channel)

        for (let i = 0; i < track.buffer.length; i++) {
          destData[i] = sourceData[i]
        }

        // Mix in snippet data
        const snippetData = snippet.buffer.getChannelData(
          Math.min(channel, snippet.buffer.numberOfChannels - 1)
        )
        for (let i = 0; i < snippetLength; i++) {
          const destIndex = positionSample + i
          if (destIndex < newLength) {
            // Mix audio (average if overlapping)
            destData[destIndex] = (destData[destIndex] + snippetData[i]) / 2
          }
        }
      }

      // Update track
      track.buffer = newBuffer
      track.duration = newBuffer.duration
      track.waveformData = this.generateWaveformData(newBuffer)
      this.engine.setTrackBuffer(trackId, newBuffer)
      this.updateDuration()

      return true
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
