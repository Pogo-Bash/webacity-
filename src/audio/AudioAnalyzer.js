/**
 * Audio Analysis Tools
 * Spectral analysis, beat detection, and other analysis features
 */

class AudioAnalyzer {
  constructor(audioContext, sampleRate = 44100) {
    this.audioContext = audioContext
    this.sampleRate = sampleRate
  }

  /**
   * Perform FFT and get spectrum data
   */
  getSpectrum(audioBuffer, fftSize = 2048) {
    const channelData = audioBuffer.getChannelData(0)
    const analyser = this.audioContext.createAnalyser()
    analyser.fftSize = fftSize

    // Create offline context for analysis
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(analyser)

    const frequencyData = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(frequencyData)

    return {
      frequencies: frequencyData,
      binCount: analyser.frequencyBinCount,
      fftSize: fftSize
    }
  }

  /**
   * Generate spectrogram data for visualization
   */
  generateSpectrogram(audioBuffer, fftSize = 2048, hopSize = 512) {
    const channelData = audioBuffer.getChannelData(0)
    const spectrogram = []

    for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
      const slice = channelData.slice(i, i + fftSize)
      const spectrum = this.computeFFT(slice)
      spectrogram.push(spectrum)
    }

    return {
      data: spectrogram,
      width: spectrogram.length,
      height: fftSize / 2,
      timePerFrame: hopSize / this.sampleRate
    }
  }

  /**
   * Simple FFT implementation (Cooley-Tukey algorithm)
   */
  computeFFT(input) {
    const n = input.length
    if (n <= 1) return input

    // Ensure power of 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)))
    if (n !== nextPow2) {
      const padded = new Float32Array(nextPow2)
      padded.set(input)
      return this.computeFFT(padded)
    }

    // Apply Hanning window
    const windowed = input.map((val, i) =>
      val * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n))
    )

    // Simplified FFT (magnitude only)
    const magnitudes = new Float32Array(n / 2)
    for (let k = 0; k < n / 2; k++) {
      let real = 0, imag = 0
      for (let i = 0; i < n; i++) {
        const angle = -2 * Math.PI * k * i / n
        real += windowed[i] * Math.cos(angle)
        imag += windowed[i] * Math.sin(angle)
      }
      magnitudes[k] = Math.sqrt(real * real + imag * imag) / n
    }

    return magnitudes
  }

  /**
   * Beat detection using energy-based algorithm
   */
  detectBeats(audioBuffer, sensitivity = 1.5) {
    const channelData = audioBuffer.getChannelData(0)
    const windowSize = Math.floor(this.sampleRate * 0.05) // 50ms window
    const hopSize = Math.floor(windowSize / 2)
    const beats = []

    // Calculate energy for each window
    const energies = []
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let energy = 0
      for (let j = 0; j < windowSize; j++) {
        energy += channelData[i + j] ** 2
      }
      energies.push({
        time: i / this.sampleRate,
        energy: energy / windowSize
      })
    }

    // Find average energy
    const avgEnergy = energies.reduce((sum, e) => sum + e.energy, 0) / energies.length

    // Detect beats where energy exceeds threshold
    let lastBeatTime = -1
    const minBeatInterval = 0.2 // minimum 200ms between beats

    for (const item of energies) {
      if (item.energy > avgEnergy * sensitivity &&
          item.time - lastBeatTime > minBeatInterval) {
        beats.push(item.time)
        lastBeatTime = item.time
      }
    }

    return beats
  }

  /**
   * Estimate tempo (BPM)
   */
  estimateTempo(audioBuffer) {
    const beats = this.detectBeats(audioBuffer, 1.3)

    if (beats.length < 2) return null

    // Calculate intervals between beats
    const intervals = []
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i-1])
    }

    // Find most common interval (simplified histogram)
    intervals.sort((a, b) => a - b)
    const medianInterval = intervals[Math.floor(intervals.length / 2)]

    // Convert to BPM
    const bpm = 60 / medianInterval

    return {
      bpm: Math.round(bpm),
      beats: beats,
      confidence: 0.7 // simplified
    }
  }

  /**
   * Peak detection
   */
  findPeaks(audioBuffer, threshold = 0.5) {
    const channelData = audioBuffer.getChannelData(0)
    const peaks = []

    for (let i = 1; i < channelData.length - 1; i++) {
      const current = Math.abs(channelData[i])
      const prev = Math.abs(channelData[i-1])
      const next = Math.abs(channelData[i+1])

      if (current > threshold && current > prev && current > next) {
        peaks.push({
          time: i / this.sampleRate,
          amplitude: channelData[i],
          sample: i
        })
      }
    }

    return peaks
  }

  /**
   * Calculate RMS (Root Mean Square) level
   */
  calculateRMS(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0)
    let sum = 0

    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] ** 2
    }

    const rms = Math.sqrt(sum / channelData.length)
    const db = 20 * Math.log10(rms)

    return {
      rms: rms,
      db: db
    }
  }

  /**
   * Calculate peak amplitude
   */
  calculatePeak(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0)
    let peak = 0

    for (let i = 0; i < channelData.length; i++) {
      peak = Math.max(peak, Math.abs(channelData[i]))
    }

    const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity

    return {
      peak: peak,
      db: db
    }
  }

  /**
   * Detect silence regions
   */
  detectSilence(audioBuffer, threshold = 0.01, minDuration = 0.1) {
    const channelData = audioBuffer.getChannelData(0)
    const minSamples = Math.floor(minDuration * this.sampleRate)
    const silenceRegions = []

    let silenceStart = null
    let silenceLength = 0

    for (let i = 0; i < channelData.length; i++) {
      const isSilent = Math.abs(channelData[i]) < threshold

      if (isSilent) {
        if (silenceStart === null) {
          silenceStart = i
        }
        silenceLength++
      } else {
        if (silenceStart !== null && silenceLength >= minSamples) {
          silenceRegions.push({
            startTime: silenceStart / this.sampleRate,
            endTime: (silenceStart + silenceLength) / this.sampleRate,
            duration: silenceLength / this.sampleRate
          })
        }
        silenceStart = null
        silenceLength = 0
      }
    }

    // Check final silence
    if (silenceStart !== null && silenceLength >= minSamples) {
      silenceRegions.push({
        startTime: silenceStart / this.sampleRate,
        endTime: (silenceStart + silenceLength) / this.sampleRate,
        duration: silenceLength / this.sampleRate
      })
    }

    return silenceRegions
  }

  /**
   * Frequency analysis at specific time
   */
  analyzeFrequencyAtTime(audioBuffer, time, fftSize = 2048) {
    const sampleIndex = Math.floor(time * this.sampleRate)
    const channelData = audioBuffer.getChannelData(0)

    if (sampleIndex + fftSize > channelData.length) {
      return null
    }

    const slice = channelData.slice(sampleIndex, sampleIndex + fftSize)
    const spectrum = this.computeFFT(slice)

    // Find dominant frequency
    let maxMag = 0
    let maxIndex = 0
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > maxMag) {
        maxMag = spectrum[i]
        maxIndex = i
      }
    }

    const dominantFreq = maxIndex * this.sampleRate / fftSize

    return {
      spectrum: spectrum,
      dominantFrequency: dominantFreq,
      magnitude: maxMag
    }
  }

  /**
   * Contrast analysis (for accessibility - WCAG compliance)
   */
  analyzeContrast(foregroundBuffer, backgroundBuffer) {
    const fgRMS = this.calculateRMS(foregroundBuffer)
    const bgRMS = this.calculateRMS(backgroundBuffer)

    const contrastRatio = fgRMS.rms / bgRMS.rms
    const contrastDB = fgRMS.db - bgRMS.db

    return {
      ratio: contrastRatio,
      db: contrastDB,
      passes: contrastDB >= 20 // Example threshold
    }
  }

  /**
   * Zero crossing rate (useful for pitch detection)
   */
  calculateZeroCrossingRate(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0)
    let crossings = 0

    for (let i = 1; i < channelData.length; i++) {
      if ((channelData[i] >= 0 && channelData[i-1] < 0) ||
          (channelData[i] < 0 && channelData[i-1] >= 0)) {
        crossings++
      }
    }

    const rate = crossings / (channelData.length / this.sampleRate)

    return {
      rate: rate,
      crossings: crossings
    }
  }
}

export default AudioAnalyzer
