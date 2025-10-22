/**
 * Autosave Service using OPFS (Origin Private File System)
 * Automatically saves project state including audio buffers to prevent data loss
 */

const AUTOSAVE_DIR = 'webacity-autosave'
const PROJECT_FILE = 'project.json'
const AUTOSAVE_INTERVAL = 30000 // 30 seconds

export class AutosaveService {
  constructor(audioStore) {
    this.audioStore = audioStore
    this.intervalId = null
    this.hasUnsavedChanges = false
    this.opfsRoot = null
    this.autosaveDir = null
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
    // Initialize OPFS
    const initialized = await this.initOPFS()
    if (!initialized) {
      console.warn('⚠️ Autosave disabled - OPFS not available')
      return
    }

    // Check for existing autosave on startup
    await this.checkForAutosave()

    // Save every 30 seconds if there are changes
    this.intervalId = setInterval(() => {
      if (this.hasUnsavedChanges) {
        this.save()
      }
    }, AUTOSAVE_INTERVAL)

    console.log('✅ Autosave enabled (saves every 30 seconds using OPFS)')
  }

  /**
   * Stop autosaving
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Mark that changes have been made
   */
  markChanged() {
    this.hasUnsavedChanges = true
  }

  /**
   * Convert AudioBuffer to WAV file data
   */
  audioBufferToWav(buffer) {
    const numberOfChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16

    const bytesPerSample = bitDepth / 8
    const blockAlign = numberOfChannels * bytesPerSample

    const data = new Float32Array(buffer.length * numberOfChannels)
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel)
      for (let i = 0; i < buffer.length; i++) {
        data[i * numberOfChannels + channel] = channelData[i]
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

              // Skip very large buffers that might cause issues (> 5 minutes)
              if (clip.buffer.duration > 300) {
                console.warn(`⚠️ Skipping autosave for large clip: ${clip.name} (${clip.buffer.duration.toFixed(1)}s)`)
                trackData.clips.push({
                  id: clip.id,
                  fileName: null, // Mark as not saved
                  name: clip.name,
                  startTime: clip.startTime,
                  duration: clip.duration,
                  color: clip.color,
                  skipped: true
                })
                continue
              }

              // Convert audio buffer to WAV
              const wavData = this.audioBufferToWav(clip.buffer)

              // Validate WAV data size (skip if > 50MB)
              if (wavData.byteLength > 50 * 1024 * 1024) {
                console.warn(`⚠️ Skipping autosave for large WAV file: ${clip.name} (${(wavData.byteLength / 1024 / 1024).toFixed(1)}MB)`)
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

              // Write to OPFS
              const fileHandle = await this.autosaveDir.getFileHandle(clipFileName, { create: true })
              const writable = await fileHandle.createWritable()
              await writable.write(wavData)
              await writable.close()

              // Save clip metadata
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

            // Add clip to track
            const clip = {
              id: clipData.id,
              name: clipData.name,
              buffer: audioBuffer,
              startTime: clipData.startTime,
              duration: clipData.duration,
              color: clipData.color,
              waveformData: this.audioStore.generateWaveformData(audioBuffer)
            }

            track.clips.push(clip)
          } catch (error) {
            console.error(`❌ Failed to restore clip ${clipData.name}:`, error)
          }
        }

        // Update track buffer from clips
        if (track.clips.length > 0) {
          this.audioStore.updateTrackBufferFromClips(track.id)
        }
      }

      // Update duration
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
