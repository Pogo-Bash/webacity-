/**
 * Autosave Service using OPFS (Origin Private File System)
 * Automatically saves project state including audio buffers to prevent data loss
 */
import { markRaw } from 'vue'

const AUTOSAVE_DIR = 'webacity-autosave'
const PROJECT_FILE = 'project.json'
// Debounce: wait this long after the last change before writing.
const AUTOSAVE_DEBOUNCE = 10000 // 10 seconds

export class AutosaveService {
  constructor(audioStore) {
    this.audioStore = audioStore
    this.hasUnsavedChanges = false
    this.opfsRoot = null
    this.autosaveDir = null
    // Per-clip fingerprint ("buffer identity + window + startTime + duration")
    // so we can skip clips whose on-disk WAV is still current.
    this.clipFingerprints = new Map()
    // A single autosave worker handles WAV encoding so the main thread
    // never stalls on a large buffer serialization.
    this.worker = null
    this.nextWorkerId = 1
    this.workerPending = new Map()
    this.debounceTimer = null
    this.saveInFlight = false
  }

  /**
   * Initialize OPFS
   */
  async initOPFS() {
    try {
      // Check if OPFS is supported
      if (!navigator.storage || !navigator.storage.getDirectory) {
        console.warn('⚠️ OPFS not supported in this browser')
        return false
      }

      // Get OPFS root
      this.opfsRoot = await navigator.storage.getDirectory()

      // Create or get autosave directory
      this.autosaveDir = await this.opfsRoot.getDirectoryHandle(AUTOSAVE_DIR, { create: true })

      console.log('✅ OPFS initialized')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize OPFS:', error)
      return false
    }
  }

  /**
   * Start autosaving
   */
  async start() {
    const initialized = await this.initOPFS()
    if (!initialized) {
      console.warn('⚠️ Autosave disabled - OPFS not available')
      return
    }

    this._initWorker()
    await this.checkForAutosave()

    console.log('✅ Autosave enabled (debounced 10s, OPFS-backed)')
  }

  /**
   * Stop autosaving
   */
  stop() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.workerPending.clear()
  }

  /**
   * Mark that changes have been made; saves are debounced so a burst of
   * edits collapses into a single write 10s after the last one.
   */
  markChanged() {
    this.hasUnsavedChanges = true
    if (!this.autosaveDir) return
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      if (this.hasUnsavedChanges && !this.saveInFlight) {
        this.save().catch(err => console.error('Autosave failed:', err))
      }
    }, AUTOSAVE_DEBOUNCE)
  }

  _initWorker() {
    if (this.worker) return
    this.worker = new Worker(
      new URL('../workers/autosaveWorker.js', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = (event) => {
      const { id, type } = event.data
      const entry = this.workerPending.get(id)
      if (!entry) return
      this.workerPending.delete(id)
      if (type === 'done') entry.resolve(event.data.wav)
      else entry.reject(new Error(event.data.error))
    }
    this.worker.onerror = (err) => {
      for (const [, entry] of this.workerPending) entry.reject(err)
      this.workerPending.clear()
    }
  }

  /**
   * Encode a clip's windowed audio to a WAV ArrayBuffer via the worker.
   * The channel data is copied (slice) to avoid detaching the AudioBuffer.
   */
  async encodeClipWav(clip) {
    this._initWorker()
    const id = this.nextWorkerId++
    const numChannels = clip.buffer.numberOfChannels
    const windowOffset = clip.bufferOffset || 0
    const windowLength = clip.bufferLength ?? clip.buffer.length

    const channels = []
    const transfers = []
    for (let ch = 0; ch < numChannels; ch++) {
      const full = clip.buffer.getChannelData(ch)
      const copy = full.slice(windowOffset, windowOffset + windowLength)
      channels.push(copy)
      transfers.push(copy.buffer)
    }

    return new Promise((resolve, reject) => {
      this.workerPending.set(id, { resolve, reject })
      this.worker.postMessage({
        id,
        channels,
        sampleRate: clip.buffer.sampleRate,
        // Clip data is already sliced to the window, so pass offset=0, length=full.
        windowOffset: 0,
        windowLength: null
      }, transfers)
    })
  }

  _fingerprint(clip) {
    // Identity of the underlying buffer, plus the window, start, and duration.
    // A fresh buffer ref means the audio changed (e.g. an effect was applied).
    return [
      clip.buffer,
      clip.bufferOffset || 0,
      clip.bufferLength ?? (clip.buffer ? clip.buffer.length : 0),
      clip.startTime,
      clip.duration
    ]
  }

  _fingerprintEquals(a, b) {
    if (!a || !b) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  /**
   * Convert AudioBuffer to WAV file data, optionally restricted to a
   * sample-index window (used when a clip only references part of its buffer).
   */
  audioBufferToWav(buffer, windowOffset = 0, windowLength = null) {
    const numberOfChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16

    const bytesPerSample = bitDepth / 8
    const blockAlign = numberOfChannels * bytesPerSample

    const startSample = Math.max(0, windowOffset | 0)
    const endSample = windowLength != null
      ? Math.min(buffer.length, startSample + windowLength)
      : buffer.length
    const sampleCount = Math.max(0, endSample - startSample)

    const data = new Float32Array(sampleCount * numberOfChannels)
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel)
      for (let i = 0; i < sampleCount; i++) {
        data[i * numberOfChannels + channel] = channelData[startSample + i]
      }
    }

    const dataLength = data.length * bytesPerSample
    const buffer2 = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer2)

    // RIFF identifier
    writeString(view, 0, 'RIFF')
    // file length
    view.setUint32(4, 36 + dataLength, true)
    // RIFF type
    writeString(view, 8, 'WAVE')
    // format chunk identifier
    writeString(view, 12, 'fmt ')
    // format chunk length
    view.setUint32(16, 16, true)
    // sample format (raw)
    view.setUint16(20, format, true)
    // channel count
    view.setUint16(22, numberOfChannels, true)
    // sample rate
    view.setUint32(24, sampleRate, true)
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * blockAlign, true)
    // block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true)
    // bits per sample
    view.setUint16(34, bitDepth, true)
    // data chunk identifier
    writeString(view, 36, 'data')
    // data chunk length
    view.setUint32(40, dataLength, true)

    // write the PCM samples
    let offset = 44
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }

    return buffer2

    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
  }

  /**
   * Convert WAV file data to AudioBuffer
   */
  async wavToAudioBuffer(arrayBuffer) {
    const audioContext = this.audioStore.engine.audioContext
    return await audioContext.decodeAudioData(arrayBuffer)
  }

  /**
   * Save current project state to OPFS
   */
  async save() {
    if (!this.autosaveDir) {
      console.warn('⚠️ OPFS not initialized')
      return false
    }
    if (this.saveInFlight) {
      // Another save is already running; the post-save change check will pick
      // up any new edits, so just drop this call.
      return false
    }
    this.saveInFlight = true

    try {
      console.log('💾 Saving project to OPFS...')

      // Serialize project structure and save audio files
      const projectData = {
        version: '2.0', // Version 2.0 uses OPFS
        timestamp: new Date().toISOString(),
        projectName: this.audioStore.projectName || 'Untitled Project',
        duration: this.audioStore.duration,
        sampleRate: this.audioStore.sampleRate,
        masterVolume: this.audioStore.masterVolume,
        tracks: []
      }

      // Save each track
      for (const track of this.audioStore.tracks) {
        const trackData = {
          id: track.id,
          name: track.name,
          color: track.color,
          volume: track.volume,
          pan: track.pan,
          muted: track.muted,
          solo: track.solo,
          clips: []
        }

        // Save each clip's audio buffer
        for (const clip of track.clips) {
          if (clip.buffer) {
            try {
              const clipFileName = `${track.id}_${clip.id}.wav`
              const clipWindowDuration = (clip.bufferLength ?? clip.buffer.length) / clip.buffer.sampleRate

              // Skip very large buffers (> 5 minutes) with a prominent log.
              if (clipWindowDuration > 300) {
                console.warn(`⚠️ AUTOSAVE SKIPPED — clip "${clip.name}" is ${clipWindowDuration.toFixed(1)}s, above the 5-min autosave cap. Use File > Save to persist this project.`)
                trackData.clips.push({
                  id: clip.id,
                  fileName: null,
                  name: clip.name,
                  startTime: clip.startTime,
                  duration: clip.duration,
                  color: clip.color,
                  skipped: true
                })
                continue
              }

              // Skip unchanged clips: reuse the existing on-disk WAV.
              const fp = this._fingerprint(clip)
              const lastFp = this.clipFingerprints.get(clip.id)
              if (this._fingerprintEquals(lastFp, fp)) {
                trackData.clips.push({
                  id: clip.id,
                  fileName: clipFileName,
                  name: clip.name,
                  startTime: clip.startTime,
                  duration: clip.duration,
                  color: clip.color
                })
                continue
              }

              // Encode WAV off the main thread.
              const wavData = await this.encodeClipWav(clip)

              // Validate WAV data size (skip if > 50MB)
              if (wavData.byteLength > 50 * 1024 * 1024) {
                console.warn(`⚠️ AUTOSAVE SKIPPED — encoded WAV for "${clip.name}" is ${(wavData.byteLength / 1024 / 1024).toFixed(1)} MB, above the 50 MB autosave cap.`)
                trackData.clips.push({
                  id: clip.id,
                  fileName: null,
                  name: clip.name,
                  startTime: clip.startTime,
                  duration: clip.duration,
                  color: clip.color,
                  skipped: true
                })
                continue
              }

              const fileHandle = await this.autosaveDir.getFileHandle(clipFileName, { create: true })
              const writable = await fileHandle.createWritable()
              await writable.write(wavData)
              await writable.close()

              this.clipFingerprints.set(clip.id, fp)

              trackData.clips.push({
                id: clip.id,
                fileName: clipFileName,
                name: clip.name,
                startTime: clip.startTime,
                duration: clip.duration,
                color: clip.color
              })
            } catch (clipError) {
              console.error(`❌ Failed to save clip ${clip.name}:`, clipError)
              // Continue with other clips even if one fails
              trackData.clips.push({
                id: clip.id,
                fileName: null,
                name: clip.name,
                startTime: clip.startTime,
                duration: clip.duration,
                color: clip.color,
                error: true
              })
            }
          }
        }

        projectData.tracks.push(trackData)
      }

      // Save project.json
      const projectJson = JSON.stringify(projectData, null, 2)
      const projectFileHandle = await this.autosaveDir.getFileHandle(PROJECT_FILE, { create: true })
      const writable = await projectFileHandle.createWritable()
      await writable.write(projectJson)
      await writable.close()

      this.hasUnsavedChanges = false
      console.log('✅ Project autosaved to OPFS')
      return true
    } catch (error) {
      console.error('❌ Autosave failed:', error)
      return false
    } finally {
      this.saveInFlight = false
    }
  }

  /**
   * Check for existing autosave and prompt to restore
   */
  async checkForAutosave() {
    if (!this.autosaveDir) return

    try {
      // Check if project.json exists
      const projectFileHandle = await this.autosaveDir.getFileHandle(PROJECT_FILE)
      const file = await projectFileHandle.getFile()
      const projectJson = await file.text()
      const projectData = JSON.parse(projectJson)

      const lastSave = new Date(projectData.timestamp)
      const timeSince = Date.now() - lastSave.getTime()
      const minutesAgo = Math.floor(timeSince / 60000)

      // Only prompt if autosave is recent (less than 24 hours old)
      if (timeSince < 24 * 60 * 60 * 1000) {
        const message = minutesAgo < 60
          ? `Found autosaved project from ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago.\n\nProject: ${projectData.projectName}\nTracks: ${projectData.tracks.length}\n\nRestore it?`
          : `Found autosaved project from ${Math.floor(minutesAgo / 60)} hour${Math.floor(minutesAgo / 60) !== 1 ? 's' : ''} ago.\n\nProject: ${projectData.projectName}\nTracks: ${projectData.tracks.length}\n\nRestore it?`

        if (confirm(message)) {
          await this.restore()
        } else {
          // Clear old autosave if user doesn't want to restore
          await this.clearAutosave()
        }
      } else {
        // Clear old autosave
        await this.clearAutosave()
      }
    } catch (error) {
      // No autosave found or error reading it
      console.log('ℹ️ No autosave found')
    }
  }

  /**
   * Restore project from autosave
   */
  async restore() {
    if (!this.autosaveDir) {
      console.warn('⚠️ OPFS not initialized')
      return false
    }

    try {
      console.log('📂 Restoring project from OPFS...')

      // Read project.json
      const projectFileHandle = await this.autosaveDir.getFileHandle(PROJECT_FILE)
      const file = await projectFileHandle.getFile()
      const projectJson = await file.text()
      const projectData = JSON.parse(projectJson)

      // Clear existing project
      this.audioStore.tracks = []
      this.audioStore.selectedTrackId = null
      this.audioStore.selectedClipId = null

      // Restore basic settings
      this.audioStore.projectName = projectData.projectName || 'Untitled Project'
      this.audioStore.masterVolume = projectData.masterVolume || 1
      this.audioStore.sampleRate = projectData.sampleRate || 44100

      // Restore tracks
      for (const trackData of projectData.tracks) {
        // Create track
        const track = this.audioStore.addTrack(trackData.name)
        track.color = trackData.color
        track.volume = trackData.volume
        track.pan = trackData.pan
        track.muted = trackData.muted
        track.solo = trackData.solo

        // Restore clips
        for (const clipData of trackData.clips) {
          try {
            // Read audio file from OPFS
            const clipFileHandle = await this.autosaveDir.getFileHandle(clipData.fileName)
            const clipFile = await clipFileHandle.getFile()
            const arrayBuffer = await clipFile.arrayBuffer()

            // Convert WAV to AudioBuffer
            const audioBuffer = await this.wavToAudioBuffer(arrayBuffer)

            // Add clip to track. Windows are implicitly reset because the
            // WAV on disk already contains only the saved window.
            const clip = {
              id: clipData.id,
              name: clipData.name,
              buffer: markRaw(audioBuffer),
              bufferOffset: 0,
              bufferLength: audioBuffer.length,
              startTime: clipData.startTime,
              duration: clipData.duration,
              color: clipData.color,
              waveformData: null
            }
            this.audioStore.getOrGenerateClipWaveform(clip)

            track.clips.push(clip)
          } catch (error) {
            console.error(`❌ Failed to restore clip ${clipData.name}:`, error)
          }
        }

      }

      // Update duration (each track's duration is derived from its clips)
      this.audioStore.updateDuration()

      console.log('✅ Project restored from OPFS')
      alert(`Project restored successfully!\n\nProject: ${projectData.projectName}\nTracks: ${projectData.tracks.length}`)
      return true
    } catch (error) {
      console.error('❌ Failed to restore autosave:', error)
      alert('Failed to restore project. The autosave may be corrupted.')
      return false
    }
  }

  /**
   * Clear autosave data
   */
  async clearAutosave() {
    if (!this.autosaveDir) return

    try {
      // Remove all files in autosave directory
      for await (const entry of this.autosaveDir.values()) {
        await this.autosaveDir.removeEntry(entry.name)
      }
      console.log('🗑️ Autosave cleared')
    } catch (error) {
      console.error('❌ Failed to clear autosave:', error)
    }

    this.hasUnsavedChanges = false
  }

  /**
   * Get warning message for beforeunload event
   */
  getUnsavedWarning() {
    if (this.hasUnsavedChanges) {
      return 'You have unsaved changes. Are you sure you want to leave?'
    }
    return null
  }
}
