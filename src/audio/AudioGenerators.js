/**
 * Audio Generators
 * Generate tones, noise, silence, chirps, and other sounds like Audacity
 */

class AudioGenerators {
  constructor(audioContext, sampleRate = 44100) {
    this.audioContext = audioContext
    this.sampleRate = sampleRate
  }

  /**
   * Generate silence
   */
  generateSilence(duration, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)
    // Buffer is already zeroed by default
    return buffer
  }

  /**
   * Generate sine wave tone
   */
  generateTone(frequency, duration, amplitude = 0.5, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        data[i] = Math.sin(2 * Math.PI * frequency * i / this.sampleRate) * amplitude
      }
    }

    return buffer
  }

  /**
   * Generate square wave
   */
  generateSquareWave(frequency, duration, amplitude = 0.5, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const phase = (2 * Math.PI * frequency * i / this.sampleRate) % (2 * Math.PI)
        data[i] = (phase < Math.PI ? 1 : -1) * amplitude
      }
    }

    return buffer
  }

  /**
   * Generate sawtooth wave
   */
  generateSawtoothWave(frequency, duration, amplitude = 0.5, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const phase = (frequency * i / this.sampleRate) % 1
        data[i] = (2 * phase - 1) * amplitude
      }
    }

    return buffer
  }

  /**
   * Generate white noise
   */
  generateWhiteNoise(duration, amplitude = 0.3, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * amplitude
      }
    }

    return buffer
  }

  /**
   * Generate pink noise (1/f noise)
   */
  generatePinkNoise(duration, amplitude = 0.3, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
        b6 = white * 0.115926
        data[i] = pink * amplitude * 0.11
      }
    }

    return buffer
  }

  /**
   * Generate brown noise (Brownian noise)
   */
  generateBrownNoise(duration, amplitude = 0.3, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      let lastOut = 0

      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + (0.02 * white)) / 1.02
        data[i] = lastOut * amplitude * 3.5
      }
    }

    return buffer
  }

  /**
   * Generate chirp (frequency sweep)
   */
  generateChirp(startFreq, endFreq, duration, amplitude = 0.5, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      const freqRange = endFreq - startFreq

      for (let i = 0; i < length; i++) {
        const t = i / this.sampleRate
        const freq = startFreq + (freqRange * t / duration)
        const phase = 2 * Math.PI * freq * t
        data[i] = Math.sin(phase) * amplitude
      }
    }

    return buffer
  }

  /**
   * Generate DTMF tone (dual-tone multi-frequency)
   */
  generateDTMF(digit, duration, amplitude = 0.5, channels = 2) {
    const tones = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
    }

    if (!tones[digit]) {
      throw new Error('Invalid DTMF digit')
    }

    const [freq1, freq2] = tones[digit]
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const t = i / this.sampleRate
        const tone1 = Math.sin(2 * Math.PI * freq1 * t)
        const tone2 = Math.sin(2 * Math.PI * freq2 * t)
        data[i] = (tone1 + tone2) * amplitude * 0.5
      }
    }

    return buffer
  }

  /**
   * Generate pluck/click sound
   */
  generateClick(duration = 0.01, amplitude = 0.8, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-5 * i / length)
        data[i] = (Math.random() * 2 - 1) * amplitude * decay
      }
    }

    return buffer
  }

  /**
   * Generate risset rhythm (rhythmic illusion)
   */
  generateRissetRhythm(duration, tempo = 120, amplitude = 0.5, channels = 2) {
    const length = Math.floor(duration * this.sampleRate)
    const buffer = this.audioContext.createBuffer(channels, length, this.sampleRate)
    const beatInterval = 60 / tempo // seconds per beat

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel)

      for (let i = 0; i < length; i++) {
        const t = i / this.sampleRate
        let sample = 0

        // Layer multiple rhythms at different tempos
        for (let layer = 0; layer < 4; layer++) {
          const layerTempo = tempo * Math.pow(2, layer)
          const layerInterval = 60 / layerTempo
          const beatPhase = (t % layerInterval) / layerInterval

          if (beatPhase < 0.1) {
            sample += Math.sin(beatPhase * 20 * Math.PI) * Math.exp(-beatPhase * 10)
          }
        }

        data[i] = sample * amplitude * 0.25
      }
    }

    return buffer
  }
}

export default AudioGenerators
