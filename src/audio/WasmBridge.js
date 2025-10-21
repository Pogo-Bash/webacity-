/**
 * Bridge between JavaScript and WASM audio processors
 * Handles data conversion and module loading
 */

class WasmBridge {
  constructor() {
    this.audioProcessor = null;
    this.effectsProcessor = null;
    this.loaded = false;
  }

  /**
   * Load WASM modules
   */
  async load() {
    try {
      // Load audio processor module
      const audioModule = await import('/wasm/audio-processor.js');
      const AudioProcessorModule = await audioModule.default();
      this.audioProcessor = new AudioProcessorModule.AudioProcessor();

      // Load effects processor module
      const effectsModule = await import('/wasm/effects-processor.js');
      const EffectsProcessorModule = await effectsModule.default();
      this.effectsProcessor = new EffectsProcessorModule.EffectsProcessor();

      this.loaded = true;
      console.log('WASM modules loaded successfully');
    } catch (error) {
      console.error('Failed to load WASM modules:', error);
      console.warn('Falling back to JavaScript implementations');
      this.loaded = false;
    }
  }

  /**
   * Convert Float32Array to WASM vector
   */
  toWasmVector(float32Array, module) {
    const vector = new module.VectorFloat();
    for (let i = 0; i < float32Array.length; i++) {
      vector.push_back(float32Array[i]);
    }
    return vector;
  }

  /**
   * Convert WASM vector to Float32Array
   */
  fromWasmVector(wasmVector) {
    const length = wasmVector.size();
    const result = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = wasmVector.get(i);
    }
    wasmVector.delete(); // Clean up WASM memory
    return result;
  }

  /**
   * Amplify audio (WASM or fallback)
   */
  amplify(input, factor) {
    if (this.loaded && this.audioProcessor) {
      const inputVec = this.toWasmVector(input, this.audioProcessor);
      const outputVec = this.audioProcessor.amplify(inputVec, factor);
      inputVec.delete();
      return this.fromWasmVector(outputVec);
    }

    // JavaScript fallback
    return input.map(sample => Math.max(-1, Math.min(1, sample * factor)));
  }

  /**
   * Normalize audio (WASM or fallback)
   */
  normalize(input, targetPeak = 1.0) {
    if (this.loaded && this.audioProcessor) {
      const inputVec = this.toWasmVector(input, this.audioProcessor);
      const outputVec = this.audioProcessor.normalize(inputVec, targetPeak);
      inputVec.delete();
      return this.fromWasmVector(outputVec);
    }

    // JavaScript fallback
    let peak = 0;
    for (let i = 0; i < input.length; i++) {
      peak = Math.max(peak, Math.abs(input[i]));
    }
    if (peak < 0.0001) return input;

    const factor = targetPeak / peak;
    return input.map(sample => sample * factor);
  }

  /**
   * Fade in (WASM or fallback)
   */
  fadeIn(input, fadeSamples) {
    if (this.loaded && this.audioProcessor) {
      const inputVec = this.toWasmVector(input, this.audioProcessor);
      const outputVec = this.audioProcessor.fadeIn(inputVec, fadeSamples);
      inputVec.delete();
      return this.fromWasmVector(outputVec);
    }

    // JavaScript fallback
    const output = new Float32Array(input);
    const actualFade = Math.min(fadeSamples, input.length);
    for (let i = 0; i < actualFade; i++) {
      output[i] *= i / actualFade;
    }
    return output;
  }

  /**
   * Fade out (WASM or fallback)
   */
  fadeOut(input, fadeSamples) {
    if (this.loaded && this.audioProcessor) {
      const inputVec = this.toWasmVector(input, this.audioProcessor);
      const outputVec = this.audioProcessor.fadeOut(inputVec, fadeSamples);
      inputVec.delete();
      return this.fromWasmVector(outputVec);
    }

    // JavaScript fallback
    const output = new Float32Array(input);
    const actualFade = Math.min(fadeSamples, input.length);
    const startPos = input.length - actualFade;
    for (let i = 0; i < actualFade; i++) {
      output[startPos + i] *= 1 - (i / actualFade);
    }
    return output;
  }

  /**
   * Reverse audio (WASM or fallback)
   */
  reverse(input) {
    if (this.loaded && this.audioProcessor) {
      const inputVec = this.toWasmVector(input, this.audioProcessor);
      const outputVec = this.audioProcessor.reverse(inputVec);
      inputVec.delete();
      return this.fromWasmVector(outputVec);
    }

    // JavaScript fallback
    return new Float32Array(input).reverse();
  }

  /**
   * Low-pass filter (WASM or fallback)
   */
  lowPassFilter(input, cutoffFreq) {
    if (this.loaded && this.effectsProcessor) {
      const inputVec = this.toWasmVector(input, this.effectsProcessor);
      const outputVec = this.effectsProcessor.lowPassFilter(inputVec, cutoffFreq);
      inputVec.delete();
      return this.fromWasmVector(outputVec);
    }

    // JavaScript fallback - simple one-pole filter
    const output = new Float32Array(input.length);
    const rc = 1.0 / (cutoffFreq * 2 * Math.PI);
    const dt = 1.0 / 44100;
    const alpha = dt / (rc + dt);

    output[0] = input[0];
    for (let i = 1; i < input.length; i++) {
      output[i] = output[i - 1] + alpha * (input[i] - output[i - 1]);
    }
    return output;
  }

  /**
   * High-pass filter (WASM or fallback)
   */
  highPassFilter(input, cutoffFreq) {
    if (this.loaded && this.effectsProcessor) {
      const inputVec = this.toWasmVector(input, this.effectsProcessor);
      const outputVec = this.effectsProcessor.highPassFilter(inputVec, cutoffFreq);
      inputVec.delete();
      return this.fromWasmVector(outputVec);
    }

    // JavaScript fallback
    const output = new Float32Array(input.length);
    const rc = 1.0 / (cutoffFreq * 2 * Math.PI);
    const dt = 1.0 / 44100;
    const alpha = rc / (rc + dt);

    output[0] = input[0];
    for (let i = 1; i < input.length; i++) {
      output[i] = alpha * (output[i - 1] + input[i] - input[i - 1]);
    }
    return output;
  }

  /**
   * Compressor (WASM or fallback)
   */
  compress(input, threshold, ratio, attackTime, releaseTime) {
    if (this.loaded && this.effectsProcessor) {
      const inputVec = this.toWasmVector(input, this.effectsProcessor);
      const outputVec = this.effectsProcessor.compress(
        inputVec, threshold, ratio, attackTime, releaseTime
      );
      inputVec.delete();
      return this.fromWasmVector(outputVec);
    }

    // JavaScript fallback - simplified compressor
    const output = new Float32Array(input.length);
    let env = 0;
    const sampleRate = 44100;
    const attackCoef = Math.exp(-1 / (sampleRate * attackTime));
    const releaseCoef = Math.exp(-1 / (sampleRate * releaseTime));

    for (let i = 0; i < input.length; i++) {
      const inputLevel = Math.abs(input[i]);

      if (inputLevel > env) {
        env = attackCoef * env + (1 - attackCoef) * inputLevel;
      } else {
        env = releaseCoef * env + (1 - releaseCoef) * inputLevel;
      }

      let gain = 1;
      if (env > threshold) {
        const excess = env - threshold;
        gain = threshold / env + (excess / env) / ratio;
      }

      output[i] = input[i] * gain;
    }
    return output;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.audioProcessor) {
      this.audioProcessor.delete();
    }
    if (this.effectsProcessor) {
      this.effectsProcessor.delete();
    }
  }
}

export default WasmBridge;
