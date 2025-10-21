/**
 * Autosave Service
 * Automatically saves project state to localStorage to prevent data loss
 */

const AUTOSAVE_KEY = 'webacity_autosave'
const AUTOSAVE_INTERVAL = 30000 // 30 seconds
const LAST_SAVE_KEY = 'webacity_last_save'

export class AutosaveService {
  constructor(audioStore) {
    this.audioStore = audioStore
    this.intervalId = null
    this.hasUnsavedChanges = false
  }

  /**
   * Start autosaving
   */
  start() {
    // Check for existing autosave on startup
    this.checkForAutosave()

    // Save every 30 seconds if there are changes
    this.intervalId = setInterval(() => {
      if (this.hasUnsavedChanges) {
        this.save()
      }
    }, AUTOSAVE_INTERVAL)

    console.log('✅ Autosave enabled (saves every 30 seconds)')
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
   * Save current project state to localStorage
   */
  save() {
    try {
      const projectData = this.serializeProject()
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectData))
      localStorage.setItem(LAST_SAVE_KEY, new Date().toISOString())
      this.hasUnsavedChanges = false
      console.log('💾 Project autosaved')
      return true
    } catch (error) {
      console.error('❌ Autosave failed:', error)
      return false
    }
  }

  /**
   * Check for existing autosave and prompt to restore
   */
  checkForAutosave() {
    const autosaveData = localStorage.getItem(AUTOSAVE_KEY)
    const lastSave = localStorage.getItem(LAST_SAVE_KEY)

    if (autosaveData && lastSave) {
      const lastSaveDate = new Date(lastSave)
      const timeSince = Date.now() - lastSaveDate.getTime()
      const minutesAgo = Math.floor(timeSince / 60000)

      // Only prompt if autosave is recent (less than 24 hours old)
      if (timeSince < 24 * 60 * 60 * 1000) {
        const message = minutesAgo < 60
          ? `Found autosaved project from ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago. Restore it?`
          : `Found autosaved project from ${Math.floor(minutesAgo / 60)} hour${Math.floor(minutesAgo / 60) !== 1 ? 's' : ''} ago. Restore it?`

        if (confirm(message)) {
          this.restore()
        } else {
          // Clear old autosave if user doesn't want to restore
          this.clearAutosave()
        }
      } else {
        // Clear old autosave
        this.clearAutosave()
      }
    }
  }

  /**
   * Restore project from autosave
   */
  restore() {
    try {
      const autosaveData = localStorage.getItem(AUTOSAVE_KEY)
      if (!autosaveData) return false

      const projectData = JSON.parse(autosaveData)
      this.deserializeProject(projectData)
      console.log('✅ Project restored from autosave')
      return true
    } catch (error) {
      console.error('❌ Failed to restore autosave:', error)
      return false
    }
  }

  /**
   * Clear autosave data
   */
  clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY)
    localStorage.removeItem(LAST_SAVE_KEY)
    this.hasUnsavedChanges = false
  }

  /**
   * Serialize project data for storage
   * Note: AudioBuffers cannot be stored directly, so we skip them
   * This is a lightweight save of project structure only
   */
  serializeProject() {
    const tracks = this.audioStore.tracks.map(track => ({
      id: track.id,
      name: track.name,
      color: track.color,
      volume: track.volume,
      pan: track.pan,
      muted: track.muted,
      solo: track.solo,
      clips: track.clips.map(clip => ({
        id: clip.id,
        startTime: clip.startTime,
        duration: clip.duration,
        fileName: clip.fileName,
        // Note: We can't save the actual audio buffer
        // Users will need to re-import audio files
      }))
    }))

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      projectName: this.audioStore.projectName || 'Untitled Project',
      duration: this.audioStore.duration,
      sampleRate: this.audioStore.sampleRate,
      masterVolume: this.audioStore.masterVolume,
      tracks: tracks
    }
  }

  /**
   * Deserialize project data from storage
   */
  deserializeProject(projectData) {
    // Clear existing project
    this.audioStore.tracks = []
    this.audioStore.selectedTrackId = null
    this.audioStore.selectedClipId = null

    // Restore basic settings
    this.audioStore.projectName = projectData.projectName || 'Untitled Project'
    this.audioStore.masterVolume = projectData.masterVolume || 1
    this.audioStore.sampleRate = projectData.sampleRate || 44100

    // Restore track structure (without audio buffers)
    projectData.tracks.forEach(trackData => {
      const track = {
        id: trackData.id,
        name: trackData.name,
        color: trackData.color,
        volume: trackData.volume,
        pan: trackData.pan,
        muted: trackData.muted,
        solo: trackData.solo,
        clips: trackData.clips.map(clipData => ({
          id: clipData.id,
          startTime: clipData.startTime,
          duration: clipData.duration,
          fileName: clipData.fileName,
          buffer: null, // Will need to re-import
          waveformData: []
        })),
        buffer: null,
        duration: trackData.clips.reduce((max, clip) =>
          Math.max(max, clip.startTime + clip.duration), 0)
      }
      this.audioStore.tracks.push(track)
    })

    // Show message about re-importing audio
    if (projectData.tracks.some(t => t.clips.length > 0)) {
      alert('Project structure restored! Note: You will need to re-import your audio files.')
    }
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
