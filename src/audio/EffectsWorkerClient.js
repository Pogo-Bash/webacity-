/**
 * Promise-based wrapper around the effects Web Worker.
 * Manages a single worker instance, queues requests, and handles the
 * transferable-buffer round trip.
 */

export class EffectsWorkerClient {
  constructor() {
    this.worker = null
    this.nextId = 1
    // id -> { resolve, reject, onProgress }
    this.pending = new Map()
  }

  _ensureWorker() {
    if (this.worker) return
    this.worker = new Worker(
      new URL('../workers/effectsWorker.js', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = (event) => {
      const { id, type } = event.data
      const entry = this.pending.get(id)
      if (!entry) return
      if (type === 'progress') {
        entry.onProgress?.(event.data.percent)
      } else if (type === 'done') {
        this.pending.delete(id)
        entry.resolve(event.data.processedBuffers)
      } else if (type === 'error') {
        this.pending.delete(id)
        entry.reject(new Error(event.data.error))
      }
    }
    this.worker.onerror = (err) => {
      for (const [, entry] of this.pending) entry.reject(err)
      this.pending.clear()
    }
  }

  /**
   * Apply an effect to each channel of an AudioBuffer's data.
   *
   * @param {string} effectName
   * @param {object} params - effect parameters
   * @param {Float32Array[]} channelBuffers - one per channel; these are
   *   transferred to the worker (zero-copy) so the caller must not use them
   *   after this call returns.
   * @param {number} sampleRate
   * @param {(percent:number)=>void} [onProgress]
   * @returns {Promise<Float32Array[]>} processed channels (newly allocated)
   */
  process(effectName, params, channelBuffers, sampleRate, onProgress) {
    this._ensureWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
      const transfers = channelBuffers.map(c => c.buffer)
      this.worker.postMessage(
        { id, effectName, params, channelBuffers, sampleRate },
        transfers
      )
    })
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pending.clear()
  }
}

export default EffectsWorkerClient
