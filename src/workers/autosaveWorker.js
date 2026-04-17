/**
 * Autosave worker - encodes AudioBuffer channel data to a 16-bit PCM WAV
 * blob off the main thread.
 *
 * Request:  { id, channels: Float32Array[], sampleRate, windowOffset?, windowLength? }
 *   `channels` is transferred to the worker.
 * Response: { id, type: 'done', wav: ArrayBuffer }  (wav is transferred back)
 *           { id, type: 'error', error: string }
 */

function encodeWav(channels, sampleRate, windowOffset = 0, windowLength = null) {
  const numberOfChannels = channels.length
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numberOfChannels * bytesPerSample

  const firstChannelLen = channels[0]?.length ?? 0
  const start = Math.max(0, windowOffset | 0)
  const end = windowLength != null
    ? Math.min(firstChannelLen, start + windowLength)
    : firstChannelLen
  const sampleCount = Math.max(0, end - start)

  const dataLength = sampleCount * numberOfChannels * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < sampleCount; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][start + i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }

  return buffer
}

self.onmessage = (event) => {
  const { id, channels, sampleRate, windowOffset, windowLength } = event.data
  try {
    const wav = encodeWav(channels, sampleRate, windowOffset, windowLength)
    self.postMessage({ id, type: 'done', wav }, [wav])
  } catch (error) {
    self.postMessage({ id, type: 'error', error: String(error.message || error) })
  }
}
