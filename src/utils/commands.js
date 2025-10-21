/**
 * Command pattern for undo/redo functionality
 * Each command must implement execute() and undo() methods
 */

/**
 * Add clip to track
 */
export class AddClipCommand {
  constructor(audioStore, trackId, buffer, startTime, name) {
    this.audioStore = audioStore
    this.trackId = trackId
    this.buffer = buffer
    this.startTime = startTime
    this.name = name
    this.clipId = null
  }

  execute() {
    const clip = this.audioStore.addClipToTrack(this.trackId, this.buffer, this.startTime, this.name)
    if (clip) {
      this.clipId = clip.id
    }
  }

  undo() {
    if (this.clipId) {
      this.audioStore.removeClip(this.trackId, this.clipId)
    }
  }
}

/**
 * Delete clip from track
 */
export class DeleteClipCommand {
  constructor(audioStore, trackId, clipId) {
    this.audioStore = audioStore
    this.trackId = trackId
    this.clipId = clipId
    this.savedClip = null
  }

  execute() {
    // Save clip data before deleting
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (track) {
      const clip = track.clips.find(c => c.id === this.clipId)
      if (clip) {
        this.savedClip = { ...clip, buffer: this.cloneBuffer(clip.buffer) }
      }
    }
    this.audioStore.removeClip(this.trackId, this.clipId)
  }

  undo() {
    if (this.savedClip) {
      this.audioStore.addClipToTrack(
        this.trackId,
        this.savedClip.buffer,
        this.savedClip.startTime,
        this.savedClip.name
      )
    }
  }

  cloneBuffer(buffer) {
    const clone = this.audioStore.engine.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      clone.getChannelData(i).set(buffer.getChannelData(i))
    }

    return clone
  }
}

/**
 * Move clip to different position/track
 */
export class MoveClipCommand {
  constructor(audioStore, clipId, fromTrackId, toTrackId, oldStartTime, newStartTime) {
    this.audioStore = audioStore
    this.clipId = clipId
    this.fromTrackId = fromTrackId
    this.toTrackId = toTrackId
    this.oldStartTime = oldStartTime
    this.newStartTime = newStartTime
  }

  execute() {
    const fromTrack = this.audioStore.tracks.find(t => t.id === this.fromTrackId)
    const toTrack = this.audioStore.tracks.find(t => t.id === this.toTrackId)
    if (!fromTrack || !toTrack) return

    const clipIndex = fromTrack.clips.findIndex(c => c.id === this.clipId)
    if (clipIndex === -1) return

    const clip = fromTrack.clips[clipIndex]

    // If moving to different track
    if (this.fromTrackId !== this.toTrackId) {
      // Remove from old track
      fromTrack.clips.splice(clipIndex, 1)
      fromTrack.clips = [...fromTrack.clips]

      // Add to new track
      clip.startTime = this.newStartTime
      clip.color = toTrack.color
      toTrack.clips.push(clip)
      toTrack.clips = [...toTrack.clips]

      // Update both tracks
      this.audioStore.updateTrackBufferFromClips(this.fromTrackId)
      this.audioStore.updateTrackBufferFromClips(this.toTrackId)
    } else {
      // Just update position on same track
      clip.startTime = this.newStartTime
      fromTrack.clips = [...fromTrack.clips]
      this.audioStore.updateTrackBufferFromClips(this.fromTrackId)
    }

    this.audioStore.updateDuration()
    console.log(`📍 Moved clip to ${this.newStartTime.toFixed(2)}s`)
  }

  undo() {
    const fromTrack = this.audioStore.tracks.find(t => t.id === this.toTrackId)
    const toTrack = this.audioStore.tracks.find(t => t.id === this.fromTrackId)
    if (!fromTrack || !toTrack) return

    const clipIndex = fromTrack.clips.findIndex(c => c.id === this.clipId)
    if (clipIndex === -1) return

    const clip = fromTrack.clips[clipIndex]

    // If moved between different tracks, move back
    if (this.fromTrackId !== this.toTrackId) {
      // Remove from current track
      fromTrack.clips.splice(clipIndex, 1)
      fromTrack.clips = [...fromTrack.clips]

      // Add back to original track
      clip.startTime = this.oldStartTime
      clip.color = toTrack.color
      toTrack.clips.push(clip)
      toTrack.clips = [...toTrack.clips]

      // Update both tracks
      this.audioStore.updateTrackBufferFromClips(this.toTrackId)
      this.audioStore.updateTrackBufferFromClips(this.fromTrackId)
    } else {
      // Just restore position on same track
      clip.startTime = this.oldStartTime
      fromTrack.clips = [...fromTrack.clips]
      this.audioStore.updateTrackBufferFromClips(this.fromTrackId)
    }

    this.audioStore.updateDuration()
    console.log(`↩️ Moved clip back to ${this.oldStartTime.toFixed(2)}s`)
  }
}

/**
 * Cut clip (copy + delete with undo support)
 */
export class CutClipCommand {
  constructor(audioStore, clipId) {
    this.audioStore = audioStore
    this.clipId = clipId
    this.deleteCommand = null
  }

  execute() {
    // Find and copy clip to clipboard
    const clipData = this.audioStore.findClipById(this.clipId)
    if (!clipData) return

    const { clip } = clipData

    // Copy to clipboard
    this.audioStore.clipboard = {
      buffer: clip.buffer,
      duration: clip.duration,
      name: clip.name,
      color: clip.color
    }

    // Delete the clip (creates delete command internally)
    this.deleteCommand = new DeleteClipCommand(this.audioStore, this.clipId)
    this.deleteCommand.execute()

    console.log(`✂️ Cut clip "${clip.name}"`)
  }

  undo() {
    if (this.deleteCommand) {
      this.deleteCommand.undo()
      // Clear clipboard
      this.audioStore.clipboard = null
      console.log(`↩️ Undid cut`)
    }
  }
}

/**
 * Paste clip from clipboard
 */
export class PasteClipCommand {
  constructor(audioStore, trackId, position) {
    this.audioStore = audioStore
    this.trackId = trackId
    this.position = position
    this.clipId = null
    this.clipboardData = null
  }

  execute() {
    if (!this.audioStore.clipboard) return

    // Save clipboard data
    this.clipboardData = { ...this.audioStore.clipboard }

    // Add clip to track
    const clip = this.audioStore.addClipToTrack(
      this.trackId,
      this.clipboardData.buffer,
      this.position,
      this.clipboardData.name || 'Pasted Clip'
    )

    if (clip) {
      if (this.clipboardData.color) {
        clip.color = this.clipboardData.color
      }
      this.clipId = clip.id
      this.audioStore.selectedClipId = clip.id
      console.log(`📋 Pasted clip at ${this.position.toFixed(2)}s`)
    }
  }

  undo() {
    if (this.clipId && this.trackId) {
      const track = this.audioStore.tracks.find(t => t.id === this.trackId)
      if (!track) return

      const clipIndex = track.clips.findIndex(c => c.id === this.clipId)
      if (clipIndex !== -1) {
        track.clips.splice(clipIndex, 1)
        track.clips = [...track.clips]
        this.audioStore.updateTrackBufferFromClips(this.trackId)
        this.audioStore.updateDuration()
        console.log(`↩️ Removed pasted clip`)
      }
    }
  }
}

/**
 * Split clip at time
 */
export class SplitClipCommand {
  constructor(audioStore, trackId, clipId, splitTime) {
    this.audioStore = audioStore
    this.trackId = trackId
    this.clipId = clipId
    this.splitTime = splitTime
    this.originalClip = null
    this.newClipId = null
  }

  execute() {
    // Save original clip before splitting
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (track) {
      const clip = track.clips.find(c => c.id === this.clipId)
      if (clip) {
        this.originalClip = { ...clip, buffer: this.cloneBuffer(clip.buffer) }
      }
    }

    // Perform split
    this.audioStore.splitClipAtTime(this.trackId, this.clipId, this.splitTime)

    // Find the new clip that was created
    if (track) {
      const clipIndex = track.clips.findIndex(c => c.id === this.clipId)
      if (clipIndex !== -1 && clipIndex + 1 < track.clips.length) {
        this.newClipId = track.clips[clipIndex + 1].id
      }
    }
  }

  undo() {
    if (!this.originalClip) return

    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (!track) return

    // Remove both split clips
    const clipIndex = track.clips.findIndex(c => c.id === this.clipId)
    if (clipIndex !== -1) {
      track.clips.splice(clipIndex, 2) // Remove original and new clip
    }

    // Add back the original unsplit clip
    this.audioStore.addClipToTrack(
      this.trackId,
      this.originalClip.buffer,
      this.originalClip.startTime,
      this.originalClip.name
    )
  }

  cloneBuffer(buffer) {
    const clone = this.audioStore.engine.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      clone.getChannelData(i).set(buffer.getChannelData(i))
    }

    return clone
  }
}

/**
 * Apply effect to clip
 */
export class ApplyEffectToClipCommand {
  constructor(audioStore, clipId, effectName, params) {
    this.audioStore = audioStore
    this.clipId = clipId
    this.effectName = effectName
    this.params = params
    this.trackId = null
    this.previousClipState = null
  }

  execute() {
    // Find which track contains this clip
    const clipData = this.audioStore.selectedClip
    if (clipData) {
      this.trackId = clipData.trackId
      // Save previous state
      const clip = clipData.clip
      this.previousClipState = {
        ...clip,
        buffer: this.cloneBuffer(clip.buffer),
        waveformData: [...clip.waveformData]
      }
    }

    // Apply effect
    this.audioStore.applyEffectToClip(this.effectName, this.params)
  }

  undo() {
    if (!this.previousClipState || !this.trackId) return

    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (!track) return

    const clipIndex = track.clips.findIndex(c => c.id === this.clipId)
    if (clipIndex === -1) return

    // Restore previous clip state
    track.clips.splice(clipIndex, 1, {
      ...this.previousClipState,
      _lastModified: Date.now()
    })

    // Force reactivity
    track.clips = [...track.clips]

    // Rebuild track buffer
    this.audioStore.updateTrackBufferFromClips(this.trackId)
  }

  cloneBuffer(buffer) {
    const clone = this.audioStore.engine.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      clone.getChannelData(i).set(buffer.getChannelData(i))
    }

    return clone
  }
}

/**
 * Add track
 */
export class AddTrackCommand {
  constructor(audioStore, name) {
    this.audioStore = audioStore
    this.name = name
    this.trackId = null
  }

  execute() {
    const track = this.audioStore.addTrack(this.name)
    this.trackId = track.id
  }

  undo() {
    if (this.trackId) {
      this.audioStore.deleteTrack(this.trackId)
    }
  }
}

/**
 * Delete track
 */
export class DeleteTrackCommand {
  constructor(audioStore, trackId) {
    this.audioStore = audioStore
    this.trackId = trackId
    this.savedTrack = null
    this.trackIndex = -1
  }

  execute() {
    // Save track data before deleting
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (track) {
      this.trackIndex = this.audioStore.tracks.indexOf(track)
      this.savedTrack = {
        ...track,
        clips: track.clips.map(clip => ({
          ...clip,
          buffer: this.cloneBuffer(clip.buffer)
        }))
      }
    }

    this.audioStore.deleteTrack(this.trackId)
  }

  undo() {
    if (this.savedTrack && this.trackIndex !== -1) {
      // Re-insert track at original position
      this.audioStore.tracks.splice(this.trackIndex, 0, this.savedTrack)
      this.audioStore.updateDuration()
    }
  }

  cloneBuffer(buffer) {
    const clone = this.audioStore.engine.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      clone.getChannelData(i).set(buffer.getChannelData(i))
    }

    return clone
  }
}

// Legacy commands (for backward compatibility)

/**
 * Apply effect to audio buffer
 */
export class ApplyEffectCommand {
  constructor(audioStore, trackId, effectName, params, selection = null) {
    this.audioStore = audioStore
    this.trackId = trackId
    this.effectName = effectName
    this.params = params
    this.selection = selection
    this.previousBuffer = null
  }

  execute() {
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (!track || !track.buffer) return

    // Save previous buffer for undo
    this.previousBuffer = this.cloneBuffer(track.buffer)

    // Apply effect
    this.audioStore.applyEffectToTrack(this.trackId, this.effectName, this.params, this.selection)
  }

  undo() {
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (!track || !this.previousBuffer) return

    // Restore previous buffer
    track.buffer = this.previousBuffer
    this.audioStore.engine.setTrackBuffer(this.trackId, this.previousBuffer)
    track.waveformData = this.audioStore.generateWaveformData(this.previousBuffer)
  }

  cloneBuffer(buffer) {
    const clone = this.audioStore.engine.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      clone.getChannelData(i).set(buffer.getChannelData(i))
    }

    return clone
  }
}

/**
 * Delete selection
 */
export class DeleteSelectionCommand {
  constructor(audioStore, trackId, selection) {
    this.audioStore = audioStore
    this.trackId = trackId
    this.selection = selection
    this.previousBuffer = null
  }

  execute() {
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (!track || !track.buffer || !this.selection) return

    // Save previous buffer
    this.previousBuffer = this.cloneBuffer(track.buffer)

    // Delete selection
    this.audioStore.deleteSelection(this.trackId, this.selection)
  }

  undo() {
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (!track || !this.previousBuffer) return

    track.buffer = this.previousBuffer
    this.audioStore.engine.setTrackBuffer(this.trackId, this.previousBuffer)
    track.waveformData = this.audioStore.generateWaveformData(this.previousBuffer)
    track.duration = this.previousBuffer.duration
    this.audioStore.updateDuration()
  }

  cloneBuffer(buffer) {
    const clone = this.audioStore.engine.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      clone.getChannelData(i).set(buffer.getChannelData(i))
    }

    return clone
  }
}

/**
 * Paste audio at position
 */
export class PasteCommand {
  constructor(audioStore, trackId, clipboardBuffer, position) {
    this.audioStore = audioStore
    this.trackId = trackId
    this.clipboardBuffer = clipboardBuffer
    this.position = position
    this.previousBuffer = null
  }

  execute() {
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (!track || !this.clipboardBuffer) return

    // Save previous buffer (may be null for empty track)
    this.previousBuffer = track.buffer ? this.cloneBuffer(track.buffer) : null
    this.audioStore.pasteAtPosition(this.trackId, this.clipboardBuffer, this.position)
  }

  undo() {
    const track = this.audioStore.tracks.find(t => t.id === this.trackId)
    if (!track) return

    // Restore previous buffer (may be null)
    if (this.previousBuffer) {
      track.buffer = this.previousBuffer
      this.audioStore.engine.setTrackBuffer(this.trackId, this.previousBuffer)
      track.waveformData = this.audioStore.generateWaveformData(this.previousBuffer)
      track.duration = this.previousBuffer.duration
    } else {
      // Track was empty before, restore to empty
      track.buffer = null
      track.duration = 0
      track.waveformData = []
    }
    this.audioStore.updateDuration()
  }

  cloneBuffer(buffer) {
    const clone = this.audioStore.engine.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      clone.getChannelData(i).set(buffer.getChannelData(i))
    }

    return clone
  }
}
