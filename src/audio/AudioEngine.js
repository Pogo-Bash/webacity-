/**
 * Core Audio Engine using Web Audio API
 * Manages audio context, playback, and processing
 */

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.tracks = new Map();
    // Per-track list of currently-scheduled buffer sources, so stop() can cancel them.
    this.activeSources = new Map();
    this.isPlaying = false;
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.wasmProcessors = {
      audio: null,
      effects: null
    };
  }

  /**
   * Initialize the audio engine
   */
  async init() {
    // Create audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.sampleRate,
      latencyHint: 'interactive'
    });

    this.sampleRate = this.audioContext.sampleRate;

    // Create master gain node
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    // Load WASM modules
    await this.loadWasmModules();

    console.log('AudioEngine initialized', {
      sampleRate: this.sampleRate,
      state: this.audioContext.state
    });
  }

  /**
   * Load WASM processing modules
   */
  async loadWasmModules() {
    try {
      // Note: These will be loaded once WASM modules are built
      // For now, we'll create placeholder fallbacks
      console.log('WASM modules will be loaded when compiled');

      // In production, you would do:
      // const audioModule = await import('/wasm/audio-processor.js');
      // this.wasmProcessors.audio = await audioModule.default();
      // const effectsModule = await import('/wasm/effects-processor.js');
      // this.wasmProcessors.effects = await effectsModule.default();
    } catch (error) {
      console.warn('WASM modules not yet compiled, using JavaScript fallbacks:', error);
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume() {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Create a new track
   */
  createTrack(id, name = 'New Track') {
    const track = {
      id,
      name,
      buffer: null,
      source: null,
      gainNode: this.audioContext.createGain(),
      panNode: this.audioContext.createStereoPanner(),
      muted: false,
      solo: false,
      volume: 1.0,
      pan: 0
    };

    // Connect track nodes
    track.gainNode.connect(track.panNode);
    track.panNode.connect(this.masterGain);

    this.tracks.set(id, track);
    return track;
  }

  /**
   * Load audio buffer from ArrayBuffer
   */
  async loadAudioBuffer(arrayBuffer) {
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Load audio from file
   */
  async loadAudioFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return await this.loadAudioBuffer(arrayBuffer);
  }

  /**
   * Set audio buffer for a track
   */
  setTrackBuffer(trackId, audioBuffer) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.buffer = audioBuffer;
      return true;
    }
    return false;
  }

  /**
   * Remove a track and cleanup its resources
   */
  removeTrack(trackId) {
    const track = this.tracks.get(trackId);
    if (!track) return false;

    // Stop any playing source
    if (track.source) {
      try {
        track.source.stop();
        track.source.disconnect();
      } catch (e) {
        // Source may already be stopped
      }
      track.source = null;
    }

    // Cancel any scheduled clip sources for this track
    const sources = this.activeSources.get(trackId);
    if (sources) {
      for (const source of sources) {
        try { source.stop(); source.disconnect(); } catch (e) {}
      }
      this.activeSources.delete(trackId);
    }

    // Disconnect audio nodes
    try {
      track.gainNode.disconnect();
      track.panNode.disconnect();
    } catch (e) {
      // Nodes may already be disconnected
    }

    // Remove from tracks map
    this.tracks.delete(trackId);
    return true;
  }

  /**
   * Schedule playback of the given clips on a track.
   * Each clip is scheduled as its own BufferSource at its startTime, which
   * avoids the memory/CPU cost of pre-mixing clips into a single track buffer.
   *
   * @param {string} trackId
   * @param {Array} clips - [{ buffer, startTime, duration }, ...]
   * @param {number} startOffset - playback position in seconds within the project
   * @param {number} contextStartTime - audioContext time to anchor scheduling at
   */
  playTrackClips(trackId, clips, startOffset, contextStartTime) {
    const track = this.tracks.get(trackId);
    if (!track || track.muted) return;

    const sources = this.activeSources.get(trackId) || [];

    for (const clip of clips) {
      if (!clip.buffer) continue;

      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= startOffset) continue; // clip already passed

      // When startOffset is inside the clip, start the buffer partway through;
      // otherwise wait until the clip's startTime.
      const bufferOffset = Math.max(0, startOffset - clip.startTime);
      const when = contextStartTime + Math.max(0, clip.startTime - startOffset);

      const source = this.audioContext.createBufferSource();
      source.buffer = clip.buffer;
      source.connect(track.gainNode);
      try {
        source.start(when, bufferOffset);
      } catch (e) {
        console.warn('Failed to start clip source:', e);
        continue;
      }
      sources.push(source);
    }

    this.activeSources.set(trackId, sources);
  }

  /**
   * Legacy single-buffer track playback (kept for any non-clip callers).
   */
  playTrack(trackId, startTime = 0) {
    const track = this.tracks.get(trackId);
    if (!track || !track.buffer) return;

    if (track.source) {
      try { track.source.stop(); track.source.disconnect(); } catch (e) {}
    }

    track.source = this.audioContext.createBufferSource();
    track.source.buffer = track.buffer;
    track.source.connect(track.gainNode);
    track.source.start(0, startTime);
  }

  /**
   * @deprecated Prefer audioStore.play() which calls playTrackClips per track.
   * Kept as a no-op guard so old calls don't crash.
   */
  play(startTime = 0) {
    this.resume();
    this.currentTime = startTime;
    this.isPlaying = true;
  }

  /**
   * Stop playback - cancels every scheduled source.
   */
  stop() {
    for (const [, sources] of this.activeSources) {
      for (const source of sources) {
        try { source.stop(); source.disconnect(); } catch (e) { /* already stopped */ }
      }
    }
    this.activeSources.clear();

    // Also cancel any legacy single-source tracks
    for (const [, track] of this.tracks) {
      if (track.source) {
        try { track.source.stop(); track.source.disconnect(); } catch (e) {}
        track.source = null;
      }
    }

    this.isPlaying = false;
    this.currentTime = 0;
  }

  /**
   * Pause playback
   */
  pause() {
    this.audioContext.suspend();
    this.isPlaying = false;
  }

  /**
   * Set track volume
   */
  setTrackVolume(trackId, volume) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.volume = volume;
      track.gainNode.gain.value = volume;
    }
  }

  /**
   * Set track pan
   */
  setTrackPan(trackId, pan) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.pan = pan;
      track.panNode.pan.value = pan;
    }
  }

  /**
   * Mute/unmute track
   */
  toggleMute(trackId) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.muted = !track.muted;
      track.gainNode.gain.value = track.muted ? 0 : track.volume;
    }
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume) {
    this.masterGain.gain.value = volume;
  }

  /**
   * Get audio buffer as Float32Array for processing
   */
  getBufferData(trackId, channelIndex = 0) {
    const track = this.tracks.get(trackId);
    if (!track || !track.buffer) return null;

    return track.buffer.getChannelData(channelIndex);
  }

  /**
   * Apply WASM processing to a buffer
   */
  applyWasmEffect(trackId, effectName, params) {
    const bufferData = this.getBufferData(trackId);
    if (!bufferData) return null;

    // Convert Float32Array to vector for WASM
    // This is where you'd use the WASM processors
    // For now, return original data
    console.log('Effect applied:', effectName, params);
    return bufferData;
  }

  /**
   * Export audio buffer as WAV
   */
  exportToWav(trackId) {
    const track = this.tracks.get(trackId);
    if (!track || !track.buffer) return null;

    return this.bufferToWav(track.buffer);
  }

  /**
   * Render clips from the given tracks into a single AudioBuffer using an
   * OfflineAudioContext. Only used for export - during editing there is no
   * pre-mixed track buffer.
   *
   * @param {Array} trackSpecs - [{ id, clips, volume, pan, muted }, ...]
   * @returns {Promise<AudioBuffer|null>}
   */
  async renderTracksOffline(trackSpecs, masterVolume = 1) {
    const sampleRate = this.sampleRate;

    let totalDuration = 0;
    for (const t of trackSpecs) {
      if (t.muted) continue;
      for (const clip of t.clips) {
        totalDuration = Math.max(totalDuration, clip.startTime + clip.duration);
      }
    }
    if (totalDuration === 0) return null;

    const length = Math.ceil(totalDuration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    const master = offlineCtx.createGain();
    master.gain.value = masterVolume;
    master.connect(offlineCtx.destination);

    for (const t of trackSpecs) {
      if (t.muted) continue;
      const gain = offlineCtx.createGain();
      gain.gain.value = t.volume ?? 1;
      const pan = offlineCtx.createStereoPanner();
      pan.pan.value = t.pan ?? 0;
      gain.connect(pan);
      pan.connect(master);

      for (const clip of t.clips) {
        if (!clip.buffer) continue;
        const source = offlineCtx.createBufferSource();
        source.buffer = clip.buffer;
        source.connect(gain);
        source.start(clip.startTime);
      }
    }

    return await offlineCtx.startRendering();
  }

  /**
   * @deprecated Legacy sync mix from pre-mixed track.buffers. Kept as a
   * compatibility shim for callers that still read track.buffer directly; the
   * clip-based path uses renderTracksOffline.
   */
  getMixedBuffer() {
    const activeTracks = [];
    let maxDuration = 0;
    let maxChannels = 2;

    for (const [, track] of this.tracks) {
      if (!track.muted && track.buffer) {
        activeTracks.push(track);
        maxDuration = Math.max(maxDuration, track.buffer.duration);
        maxChannels = Math.max(maxChannels, track.buffer.numberOfChannels);
      }
    }

    if (activeTracks.length === 0) return null;

    const sampleRate = this.sampleRate;
    const length = Math.ceil(maxDuration * sampleRate);
    const mixedBuffer = this.audioContext.createBuffer(maxChannels, length, sampleRate);
    for (let ch = 0; ch < maxChannels; ch++) mixedBuffer.getChannelData(ch).fill(0);

    for (const track of activeTracks) {
      const buffer = track.buffer;
      const volume = track.volume;
      for (let ch = 0; ch < maxChannels; ch++) {
        const mixedData = mixedBuffer.getChannelData(ch);
        const sourceChannelIndex = Math.min(ch, buffer.numberOfChannels - 1);
        const sourceData = buffer.getChannelData(sourceChannelIndex);
        for (let i = 0; i < Math.min(sourceData.length, mixedData.length); i++) {
          mixedData[i] = Math.max(-1, Math.min(1, mixedData[i] + sourceData[i] * volume));
        }
      }
    }

    return mixedBuffer;
  }

  /**
   * Export mix of all tracks as WAV
   */
  exportMix() {
    const mixedBuffer = this.getMixedBuffer();
    if (!mixedBuffer) return null;

    return this.bufferToWav(mixedBuffer);
  }

  /**
   * Convert AudioBuffer to WAV file
   */
  bufferToWav(buffer) {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numberOfChannels * 2;

    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // Write audio data
    const channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
    this.tracks.clear();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export default AudioEngine;
