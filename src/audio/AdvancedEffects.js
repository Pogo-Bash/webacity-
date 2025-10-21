/**
 * Advanced Audio Effects
 * Professional audio processing effects like in Audacity
 */

class AdvancedEffects {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate
  }

  /**
   * Parametric EQ (3-band)
   */
  parametricEQ(input, lowGain, midGain, highGain, lowFreq = 250, midFreq = 1000, highFreq = 4000) {
    const output = new Float32Array(input.length)

    // Low shelf filter
    const wL = 2 * Math.PI * lowFreq / this.sampleRate
    const cosWL = Math.cos(wL)
    const aL = Math.pow(10, lowGain / 40)
    const alphaL = Math.sin(wL) / 2 * Math.sqrt((aL + 1 / aL) * (1 / 0.7 - 1) + 2)

    // Mid peak filter
    const wM = 2 * Math.PI * midFreq / this.sampleRate
    const cosWM = Math.cos(wM)
    const aM = Math.pow(10, midGain / 40)
    const alphaM = Math.sin(wM) / (2 * 0.7)

    // High shelf filter
    const wH = 2 * Math.PI * highFreq / this.sampleRate
    const cosWH = Math.cos(wH)
    const aH = Math.pow(10, highGain / 40)
    const alphaH = Math.sin(wH) / 2 * Math.sqrt((aH + 1 / aH) * (1 / 0.7 - 1) + 2)

    // Apply filters in sequence
    let temp = new Float32Array(input)

    // Low shelf
    for (let i = 2; i < input.length; i++) {
      const b0 = aL * ((aL + 1) - (aL - 1) * cosWL + 2 * Math.sqrt(aL) * alphaL)
      const b1 = 2 * aL * ((aL - 1) - (aL + 1) * cosWL)
      const b2 = aL * ((aL + 1) - (aL - 1) * cosWL - 2 * Math.sqrt(aL) * alphaL)
      const a0 = (aL + 1) + (aL - 1) * cosWL + 2 * Math.sqrt(aL) * alphaL
      const a1 = -2 * ((aL - 1) + (aL + 1) * cosWL)
      const a2 = (aL + 1) + (aL - 1) * cosWL - 2 * Math.sqrt(aL) * alphaL

      temp[i] = (b0/a0) * input[i] + (b1/a0) * input[i-1] + (b2/a0) * input[i-2]
                - (a1/a0) * temp[i-1] - (a2/a0) * temp[i-2]
    }

    output.set(temp)
    return output
  }

  /**
   * Phaser effect
   */
  phaser(input, rate = 0.5, depth = 1, stages = 4, feedback = 0.5, mix = 0.5) {
    const output = new Float32Array(input.length)
    const lfoFreq = rate
    const allpassBuffers = Array(stages).fill(0).map(() => [0, 0])

    for (let i = 0; i < input.length; i++) {
      const t = i / this.sampleRate
      const lfo = (Math.sin(2 * Math.PI * lfoFreq * t) + 1) / 2 // 0 to 1

      let sample = input[i]
      let processedSample = sample

      // All-pass filter stages
      for (let stage = 0; stage < stages; stage++) {
        const freq = 200 + lfo * depth * 1000
        const omega = 2 * Math.PI * freq / this.sampleRate
        const alpha = (1 - Math.tan(omega / 2)) / (1 + Math.tan(omega / 2))

        const [x1, y1] = allpassBuffers[stage]
        const y = alpha * processedSample + x1 - alpha * y1

        allpassBuffers[stage] = [processedSample, y]
        processedSample = y
      }

      // Mix with feedback
      const withFeedback = sample + processedSample * feedback
      output[i] = sample * (1 - mix) + withFeedback * mix
    }

    return output
  }

  /**
   * Wahwah effect
   */
  wahwah(input, rate = 0.7, depth = 0.7, resonance = 2.5, mix = 1.0) {
    const output = new Float32Array(input.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0

    for (let i = 0; i < input.length; i++) {
      const t = i / this.sampleRate
      const lfo = (Math.sin(2 * Math.PI * rate * t) + 1) / 2

      const minFreq = 200
      const maxFreq = 2000
      const freq = minFreq + (maxFreq - minFreq) * lfo * depth

      const omega = 2 * Math.PI * freq / this.sampleRate
      const Q = resonance
      const alpha = Math.sin(omega) / (2 * Q)

      const b0 = alpha
      const b1 = 0
      const b2 = -alpha
      const a0 = 1 + alpha
      const a1 = -2 * Math.cos(omega)
      const a2 = 1 - alpha

      const filtered = (b0/a0) * input[i] + (b1/a0) * x1 + (b2/a0) * x2
                       - (a1/a0) * y1 - (a2/a0) * y2

      x2 = x1
      x1 = input[i]
      y2 = y1
      y1 = filtered

      output[i] = input[i] * (1 - mix) + filtered * mix
    }

    return output
  }

  /**
   * Change pitch without changing tempo (using phase vocoder concept simplified)
   */
  changePitch(input, semitones) {
    const ratio = Math.pow(2, semitones / 12)
    const outputLength = Math.floor(input.length / ratio)
    const output = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      const pos = i * ratio
      const index = Math.floor(pos)
      const frac = pos - index

      if (index + 1 < input.length) {
        output[i] = input[index] * (1 - frac) + input[index + 1] * frac
      } else if (index < input.length) {
        output[i] = input[index]
      }
    }

    return output
  }

  /**
   * Change tempo without changing pitch (time-stretching)
   */
  changeTempo(input, ratio) {
    const outputLength = Math.floor(input.length / ratio)
    const output = new Float32Array(outputLength)
    const windowSize = 1024
    const hopSize = 256

    for (let i = 0; i < outputLength; i++) {
      const pos = i * ratio
      const index = Math.floor(pos)
      const frac = pos - index

      if (index + 1 < input.length) {
        output[i] = input[index] * (1 - frac) + input[index + 1] * frac
      } else if (index < input.length) {
        output[i] = input[index]
      }
    }

    return output
  }

  /**
   * Auto-duck (lower volume when another signal is present)
   */
  autoDuck(mainTrack, triggerTrack, threshold = 0.1, reduction = 0.3, attack = 0.01, release = 0.1) {
    const output = new Float32Array(mainTrack.length)
    let envelope = 1.0
    const attackSamples = attack * this.sampleRate
    const releaseSamples = release * this.sampleRate

    for (let i = 0; i < mainTrack.length; i++) {
      const triggerLevel = Math.abs(triggerTrack[Math.min(i, triggerTrack.length - 1)])

      // Determine target envelope
      const targetEnvelope = triggerLevel > threshold ? reduction : 1.0

      // Smooth envelope
      if (envelope < targetEnvelope) {
        envelope += (targetEnvelope - envelope) / releaseSamples
      } else {
        envelope += (targetEnvelope - envelope) / attackSamples
      }

      output[i] = mainTrack[i] * envelope
    }

    return output
  }

  /**
   * Noise gate (silence audio below threshold)
   */
  noiseGate(input, threshold = 0.01, attack = 0.001, release = 0.1) {
    const output = new Float32Array(input.length)
    let envelope = 0
    const attackCoef = Math.exp(-1 / (this.sampleRate * attack))
    const releaseCoef = Math.exp(-1 / (this.sampleRate * release))

    for (let i = 0; i < input.length; i++) {
      const inputLevel = Math.abs(input[i])

      // Envelope follower
      if (inputLevel > envelope) {
        envelope = attackCoef * envelope + (1 - attackCoef) * inputLevel
      } else {
        envelope = releaseCoef * envelope + (1 - releaseCoef) * inputLevel
      }

      // Gate
      const gain = envelope > threshold ? 1 : 0
      output[i] = input[i] * gain
    }

    return output
  }

  /**
   * Truncate silence
   */
  truncateSilence(input, threshold = 0.01, minSilenceDuration = 0.1) {
    const output = []
    const minSilenceSamples = Math.floor(minSilenceDuration * this.sampleRate)
    let silenceCounter = 0
    let inSilence = false

    for (let i = 0; i < input.length; i++) {
      const isSilent = Math.abs(input[i]) < threshold

      if (isSilent) {
        silenceCounter++
        if (silenceCounter < minSilenceSamples) {
          output.push(input[i])
        }
        inSilence = true
      } else {
        if (inSilence && silenceCounter >= minSilenceSamples) {
          // Add a small amount of silence for natural transition
          const transitionSamples = Math.floor(0.01 * this.sampleRate)
          for (let j = 0; j < transitionSamples; j++) {
            output.push(0)
          }
        }
        output.push(input[i])
        silenceCounter = 0
        inSilence = false
      }
    }

    return new Float32Array(output)
  }

  /**
   * Click/pop removal (simple implementation)
   */
  removeClicksPops(input, sensitivity = 0.5) {
    const output = new Float32Array(input)
    const threshold = sensitivity * 2

    for (let i = 2; i < input.length - 2; i++) {
      const diff = Math.abs(input[i] - input[i-1])
      const avgDiff = (Math.abs(input[i-1] - input[i-2]) + Math.abs(input[i+1] - input[i])) / 2

      if (diff > threshold && diff > avgDiff * 3) {
        // Interpolate
        output[i] = (input[i-1] + input[i+1]) / 2
      }
    }

    return output
  }

  /**
   * Simple noise reduction (spectral subtraction concept)
   */
  noiseReduction(input, noiseFloor = 0.1) {
    const output = new Float32Array(input.length)

    // Simple approach: high-pass filter + gentle threshold
    let prev = 0
    for (let i = 0; i < input.length; i++) {
      const highpassed = input[i] - 0.95 * prev
      prev = input[i]

      // Soft threshold
      if (Math.abs(highpassed) < noiseFloor) {
        output[i] = highpassed * (Math.abs(highpassed) / noiseFloor) * 0.5
      } else {
        output[i] = highpassed
      }
    }

    return output
  }

  /**
   * Limiter (prevent clipping)
   */
  limiter(input, threshold = 0.95, release = 0.05) {
    const output = new Float32Array(input.length)
    let gain = 1.0
    const releaseCoef = Math.exp(-1 / (this.sampleRate * release))

    for (let i = 0; i < input.length; i++) {
      const level = Math.abs(input[i])

      if (level * gain > threshold) {
        gain = threshold / level
      } else {
        gain = releaseCoef * gain + (1 - releaseCoef) * 1.0
      }

      output[i] = input[i] * Math.min(gain, 1.0)
    }

    return output
  }

  /**
   * Reverb effect using convolution with impulse response
   * Simpler version using Schroeder reverb algorithm
   */
  reverb(input, roomSize = 0.5, damping = 0.5, wetLevel = 0.3, dryLevel = 0.7) {
    const output = new Float32Array(input.length)

    // Comb filter delays (in samples) based on room size
    const combDelays = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(d =>
      Math.floor(d * (0.5 + roomSize * 0.5))
    )

    // All-pass filter delays
    const allpassDelays = [225, 556, 441, 341]

    // Initialize delay buffers
    const combBuffers = combDelays.map(delay => new Float32Array(delay).fill(0))
    const combIndices = combDelays.map(() => 0)
    const allpassBuffers = allpassDelays.map(delay => new Float32Array(delay).fill(0))
    const allpassIndices = allpassDelays.map(() => 0)

    // Feedback for comb filters
    const combFeedback = 0.84 * (1 - damping * 0.3)

    for (let i = 0; i < input.length; i++) {
      let sample = input[i]
      let combOut = 0

      // Parallel comb filters
      for (let j = 0; j < combBuffers.length; j++) {
        const delay = combDelays[j]
        const buffer = combBuffers[j]
        const index = combIndices[j]

        const delayed = buffer[index]
        combOut += delayed

        // Write to buffer with feedback and damping
        buffer[index] = sample + delayed * combFeedback
        combIndices[j] = (index + 1) % delay
      }

      combOut /= combBuffers.length

      // Series all-pass filters for diffusion
      let allpassOut = combOut
      for (let j = 0; j < allpassBuffers.length; j++) {
        const delay = allpassDelays[j]
        const buffer = allpassBuffers[j]
        const index = allpassIndices[j]

        const delayed = buffer[index]
        const feedforward = allpassOut * -0.5
        allpassOut = delayed + feedforward

        buffer[index] = allpassOut + delayed * 0.5
        allpassIndices[j] = (index + 1) % delay
      }

      // Mix wet and dry signals
      output[i] = input[i] * dryLevel + allpassOut * wetLevel
    }

    return output
  }

  /**
   * Multi-band Equalizer (10 bands: 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz)
   */
  equalizer(input, bands) {
    // bands is an object: { 31: 0, 62: 0, 125: 0, 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0, 16000: 0 }
    // Values are in dB (-12 to +12)

    const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
    let output = new Float32Array(input)

    // Apply each band filter
    for (const freq of frequencies) {
      const gainDB = bands[freq] || 0
      if (Math.abs(gainDB) < 0.1) continue // Skip if no change

      const gain = Math.pow(10, gainDB / 20)
      const Q = 1.0 // Quality factor (bandwidth)

      // Calculate filter coefficients for peak filter
      const w0 = 2 * Math.PI * freq / this.sampleRate
      const alpha = Math.sin(w0) / (2 * Q)
      const A = gain

      const b0 = 1 + alpha * A
      const b1 = -2 * Math.cos(w0)
      const b2 = 1 - alpha * A
      const a0 = 1 + alpha / A
      const a1 = -2 * Math.cos(w0)
      const a2 = 1 - alpha / A

      // Apply biquad filter
      const temp = new Float32Array(output.length)
      temp[0] = output[0]
      temp[1] = output[1]

      for (let i = 2; i < output.length; i++) {
        temp[i] = (b0/a0) * output[i] + (b1/a0) * output[i-1] + (b2/a0) * output[i-2]
                  - (a1/a0) * temp[i-1] - (a2/a0) * temp[i-2]
      }

      output = temp
    }

    return output
  }

  /**
   * Detect pitch (fundamental frequency) using autocorrelation
   * Returns frequency in Hz
   */
  detectPitch(input, minFreq = 80, maxFreq = 1000) {
    const minPeriod = Math.floor(this.sampleRate / maxFreq)
    const maxPeriod = Math.floor(this.sampleRate / minFreq)

    // Use a window of samples for analysis
    const windowSize = Math.min(input.length, maxPeriod * 2)
    const window = input.slice(0, windowSize)

    // Autocorrelation
    let bestPeriod = 0
    let bestCorrelation = 0

    for (let period = minPeriod; period < maxPeriod && period < windowSize / 2; period++) {
      let correlation = 0
      let normalization = 0

      for (let i = 0; i < windowSize - period; i++) {
        correlation += window[i] * window[i + period]
        normalization += window[i] * window[i]
      }

      if (normalization > 0) {
        correlation /= normalization

        if (correlation > bestCorrelation) {
          bestCorrelation = correlation
          bestPeriod = period
        }
      }
    }

    if (bestPeriod === 0 || bestCorrelation < 0.1) {
      return 0 // No clear pitch detected
    }

    // Refine using parabolic interpolation
    const frequency = this.sampleRate / bestPeriod

    return Math.round(frequency * 10) / 10 // Round to 1 decimal
  }

  /**
   * Get note name from frequency
   */
  frequencyToNote(frequency) {
    if (frequency === 0) return ''

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const A4 = 440
    const C0 = A4 * Math.pow(2, -4.75) // C0 frequency

    const halfSteps = 12 * Math.log2(frequency / C0)
    const octave = Math.floor(halfSteps / 12)
    const note = Math.round(halfSteps) % 12

    const cents = Math.round((halfSteps - Math.round(halfSteps)) * 100)
    const centsStr = cents > 0 ? `+${cents}¢` : cents < 0 ? `${cents}¢` : ''

    return `${noteNames[note]}${octave} ${centsStr}`.trim()
  }
}

export default AdvancedEffects
