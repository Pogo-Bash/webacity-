/**
 * Command pattern for undo/redo functionality
 * Each command must implement execute() and undo() methods
 */

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
