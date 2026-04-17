/**
 * Effects Web Worker
 *
 * Runs audio effects off the main thread so the UI stays responsive while
 * processing long clips. Receives `{ id, effectName, params, channelBuffers,
 * sampleRate }` and posts back `{ id, processedBuffers }` using transferable
 * objects for zero-copy.
 *
 * The effect implementations below are ports of the main-thread versions in
 * AdvancedEffects.js / WasmBridge.js - kept simple so the worker is
 * self-contained and doesn't need a build step.
 */

// ---------------------------------------------------------------------------
// Effect implementations (main-thread equivalents are in AdvancedEffects.js
// and WasmBridge.js; kept in sync with those).
// ---------------------------------------------------------------------------

function amplify(input, factor) {
  const output = new Float32Array(input.length)
  for (let i = 0; i < input.length; i++) {
    output[i] = Math.max(-1, Math.min(1, input[i] * factor))
  }
  return output
}

function normalize(input, targetPeak = 1.0) {
  let peak = 0
  for (let i = 0; i < input.length; i++) {
    const v = Math.abs(input[i])
    if (v > peak) peak = v
  }
  if (peak < 0.0001) return new Float32Array(input)
  const factor = targetPeak / peak
  const output = new Float32Array(input.length)
  for (let i = 0; i < input.length; i++) output[i] = input[i] * factor
  return output
}

function fadeIn(input, fadeSamples) {
  const output = new Float32Array(input)
  const actual = Math.min(fadeSamples, input.length)
  for (let i = 0; i < actual; i++) output[i] *= i / actual
  return output
}

function fadeOut(input, fadeSamples) {
  const output = new Float32Array(input)
  const actual = Math.min(fadeSamples, input.length)
  const start = input.length - actual
  for (let i = 0; i < actual; i++) output[start + i] *= 1 - i / actual
  return output
}

function reverse(input) {
  const output = new Float32Array(input.length)
  for (let i = 0; i < input.length; i++) output[i] = input[input.length - 1 - i]
  return output
}

function lowPassFilter(input, cutoffFreq, sampleRate) {
  const output = new Float32Array(input.length)
  const rc = 1.0 / (cutoffFreq * 2 * Math.PI)
  const dt = 1.0 / sampleRate
  const alpha = dt / (rc + dt)
  output[0] = input[0]
  for (let i = 1; i < input.length; i++) {
    output[i] = output[i - 1] + alpha * (input[i] - output[i - 1])
  }
  return output
}

function highPassFilter(input, cutoffFreq, sampleRate) {
  const output = new Float32Array(input.length)
  const rc = 1.0 / (cutoffFreq * 2 * Math.PI)
  const dt = 1.0 / sampleRate
  const alpha = rc / (rc + dt)
  output[0] = input[0]
  for (let i = 1; i < input.length; i++) {
    output[i] = alpha * (output[i - 1] + input[i] - input[i - 1])
  }
  return output
}

function compress(input, threshold, ratio, attackTime, releaseTime, sampleRate) {
  const output = new Float32Array(input.length)
  let env = 0
  const attackCoef = Math.exp(-1 / (sampleRate * attackTime))
  const releaseCoef = Math.exp(-1 / (sampleRate * releaseTime))
  for (let i = 0; i < input.length; i++) {
    const level = Math.abs(input[i])
    env = level > env
      ? attackCoef * env + (1 - attackCoef) * level
      : releaseCoef * env + (1 - releaseCoef) * level
    let gain = 1
    if (env > threshold) {
      const excess = env - threshold
      gain = threshold / env + (excess / env) / ratio
    }
    output[i] = input[i] * gain
  }
  return output
}

function reverb(input, roomSize = 0.5, damping = 0.5, wetLevel = 0.3, dryLevel = 0.7) {
  if (!input || input.length === 0) return new Float32Array(0)
  roomSize = Math.max(0, Math.min(1, roomSize))
  damping = Math.max(0, Math.min(1, damping))
  wetLevel = Math.max(0, Math.min(1, wetLevel))
  dryLevel = Math.max(0, Math.min(1, dryLevel))

  const output = new Float32Array(input.length)
  const combDelays = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(d =>
    Math.floor(d * (0.5 + roomSize * 0.5))
  )
  const allpassDelays = [225, 556, 441, 341]
  const combBuffers = combDelays.map(d => new Float32Array(d))
  const combIndices = combDelays.map(() => 0)
  const allpassBuffers = allpassDelays.map(d => new Float32Array(d))
  const allpassIndices = allpassDelays.map(() => 0)
  const combFeedback = 0.65 * (1 - damping * 0.5)

  let peak = 0
  for (let i = 0; i < input.length; i++) {
    let sample = Math.max(-1, Math.min(1, input[i]))
    let combOut = 0
    for (let j = 0; j < combBuffers.length; j++) {
      const delay = combDelays[j]
      const buffer = combBuffers[j]
      const idx = combIndices[j]
      const delayed = buffer[idx]
      combOut += delayed
      buffer[idx] = sample + delayed * combFeedback
      combIndices[j] = (idx + 1) % delay
    }
    combOut /= combBuffers.length

    let allpassOut = combOut
    for (let j = 0; j < allpassBuffers.length; j++) {
      const delay = allpassDelays[j]
      const buffer = allpassBuffers[j]
      const idx = allpassIndices[j]
      const delayed = buffer[idx]
      const ff = allpassOut * -0.5
      allpassOut = Math.max(-1, Math.min(1, (delayed + ff) * 0.5))
      buffer[idx] = allpassOut + delayed * 0.5
      allpassIndices[j] = (idx + 1) % delay
    }

    let v = sample * dryLevel + allpassOut * wetLevel
    v = Math.max(-1, Math.min(1, v))
    output[i] = v
    const abs = v < 0 ? -v : v
    if (abs > peak) peak = abs
  }

  if (peak > 0.95) {
    const norm = 0.95 / peak
    for (let i = 0; i < output.length; i++) output[i] *= norm
  }

  return output
}

function equalizer(input, bands, sampleRate) {
  const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
  let output = new Float32Array(input)
  for (const freq of frequencies) {
    const gainDB = bands[freq] || 0
    if (Math.abs(gainDB) < 0.1) continue
    const gain = Math.pow(10, gainDB / 20)
    const Q = 1.0
    const w0 = 2 * Math.PI * freq / sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const A = gain
    const b0 = 1 + alpha * A
    const b1 = -2 * Math.cos(w0)
    const b2 = 1 - alpha * A
    const a0 = 1 + alpha / A
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha / A
    const temp = new Float32Array(output.length)
    temp[0] = output[0]; temp[1] = output[1]
    for (let i = 2; i < output.length; i++) {
      temp[i] = (b0 / a0) * output[i] + (b1 / a0) * output[i - 1] + (b2 / a0) * output[i - 2]
              - (a1 / a0) * temp[i - 1] - (a2 / a0) * temp[i - 2]
    }
    output = temp
  }
  return output
}

function changePitch(input, semitones) {
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

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function processChannel(effectName, params, channelData, sampleRate) {
  switch (effectName) {
    case 'amplify': return amplify(channelData, params.factor)
    case 'normalize': return normalize(channelData, params.targetPeak)
    case 'fadeIn': return fadeIn(channelData, params.samples)
    case 'fadeOut': return fadeOut(channelData, params.samples)
    case 'reverse': return reverse(channelData)
    case 'lowPass': return lowPassFilter(channelData, params.cutoff, sampleRate)
    case 'highPass': return highPassFilter(channelData, params.cutoff, sampleRate)
    case 'compress': return compress(
      channelData, params.threshold, params.ratio, params.attack, params.release, sampleRate)
    case 'reverb': return reverb(
      channelData, params.roomSize, params.damping, params.wetLevel, params.dryLevel)
    case 'equalizer': return equalizer(channelData, params.bands, sampleRate)
    case 'pitch': return changePitch(channelData, params.semitones)
    default: throw new Error(`Unknown effect: ${effectName}`)
  }
}

self.onmessage = (event) => {
  const { id, effectName, params, channelBuffers, sampleRate } = event.data
  try {
    const processedBuffers = []
    const transfers = []
    for (let i = 0; i < channelBuffers.length; i++) {
      const ch = channelBuffers[i]
      const processed = processChannel(effectName, params, ch, sampleRate)
      const percent = Math.round(((i + 1) / channelBuffers.length) * 100)
      self.postMessage({ id, type: 'progress', percent })
      processedBuffers.push(processed)
      transfers.push(processed.buffer)
    }
    self.postMessage({ id, type: 'done', processedBuffers }, transfers)
  } catch (error) {
    self.postMessage({ id, type: 'error', error: String(error.message || error) })
  }
}
