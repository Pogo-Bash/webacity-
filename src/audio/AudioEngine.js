/**
 * Core Audio Engine using Web Audio API
 * Manages audio context, playback, and processing
 */

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.tracks = new Map();
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
   * Play a specific track
   */
  playTrack(trackId, startTime = 0) {
    const track = this.tracks.get(trackId);
    if (!track || !track.buffer) return;

    // Stop existing source if playing
    if (track.source) {
      track.source.stop();
      track.source.disconnect();
    }

    // Create new buffer source
    track.source = this.audioContext.createBufferSource();
    track.source.buffer = track.buffer;
    track.source.connect(track.gainNode);

    // Start playback
    track.source.start(0, startTime);
  }

  /**
   * Play all tracks
   */
  play(startTime = 0) {
    this.resume();
    this.currentTime = startTime;

    for (const [trackId, track] of this.tracks) {
      if (!track.muted && track.buffer) {
        this.playTrack(trackId, startTime);
      }
    }

    this.isPlaying = true;
  }

  /**
   * Stop playback
   */
  stop() {
    for (const [trackId, track] of this.tracks) {
      if (track.source) {
        try {
          track.source.stop();
          track.source.disconnect();
          track.source = null;
        } catch (e) {
          // Source may already be stopped
        }
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
