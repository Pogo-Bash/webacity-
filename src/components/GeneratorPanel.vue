<template>
  <div v-if="visible" class="generator-panel-container fixed right-4 top-20 w-96 max-h-[calc(100vh-6rem)] overflow-y-auto bg-gray-800 rounded-lg shadow-2xl z-50">
    <div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
      <h3 class="text-white font-semibold">Generate Audio</h3>
      <button @click="$emit('close')" class="text-gray-400 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="p-4 space-y-4">
      <!-- Tone Generator -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3 flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          Tone Generator
        </h4>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-400">Waveform</label>
            <select v-model="tone.waveform" class="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded text-sm">
              <option value="sine">Sine Wave</option>
              <option value="square">Square Wave</option>
              <option value="sawtooth">Sawtooth Wave</option>
            </select>
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Frequency</label>
              <span class="text-xs text-white">{{ tone.frequency }} Hz</span>
            </div>
            <input type="range" min="20" max="20000" v-model.number="tone.frequency" class="w-full mt-1" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Duration</label>
              <span class="text-xs text-white">{{ tone.duration }}s</span>
            </div>
            <input type="range" min="0.1" max="30" step="0.1" v-model.number="tone.duration" class="w-full mt-1" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Amplitude</label>
              <span class="text-xs text-white">{{ (tone.amplitude * 100).toFixed(0) }}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" v-model.number="tone.amplitude" class="w-full mt-1" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Preview Volume</label>
              <span class="text-xs text-white">{{ (previewVolume * 100).toFixed(0) }}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" v-model.number="previewVolume" class="w-full mt-1" />
          </div>
          <div class="flex gap-2">
            <button @click="previewTone" class="btn-preview flex-1">
              <svg class="w-4 h-4 mr-1 inline" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Preview
            </button>
            <button v-if="isPreviewing" @click="stopPreview" class="btn-stop flex-1">
              <svg class="w-4 h-4 mr-1 inline" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              Stop
            </button>
          </div>
          <button @click="generateTone" class="btn-apply">Generate Tone</button>
        </div>
      </div>

      <!-- Noise Generator -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3 flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
          </svg>
          Noise Generator
        </h4>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-400">Noise Type</label>
            <select v-model="noise.type" class="w-full mt-1 bg-gray-700 text-white px-3 py-2 rounded text-sm">
              <option value="white">White Noise</option>
              <option value="pink">Pink Noise</option>
              <option value="brown">Brown Noise</option>
            </select>
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Duration</label>
              <span class="text-xs text-white">{{ noise.duration }}s</span>
            </div>
            <input type="range" min="0.1" max="30" step="0.1" v-model.number="noise.duration" class="w-full mt-1" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Amplitude</label>
              <span class="text-xs text-white">{{ (noise.amplitude * 100).toFixed(0) }}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" v-model.number="noise.amplitude" class="w-full mt-1" />
          </div>
          <button @click="generateNoise" class="btn-apply">Generate Noise</button>
        </div>
      </div>

      <!-- Chirp Generator -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3 flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 3L5 6.99h3V14h2V6.99h3L9 3zm7 14.01V10h-2v7.01h-3L15 21l4-3.99h-3z"/>
          </svg>
          Chirp Generator
        </h4>
        <div class="space-y-3">
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Start Frequency</label>
              <span class="text-xs text-white">{{ chirp.startFreq }} Hz</span>
            </div>
            <input type="range" min="20" max="10000" v-model.number="chirp.startFreq" class="w-full mt-1" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">End Frequency</label>
              <span class="text-xs text-white">{{ chirp.endFreq }} Hz</span>
            </div>
            <input type="range" min="20" max="10000" v-model.number="chirp.endFreq" class="w-full mt-1" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Duration</label>
              <span class="text-xs text-white">{{ chirp.duration }}s</span>
            </div>
            <input type="range" min="0.1" max="10" step="0.1" v-model.number="chirp.duration" class="w-full mt-1" />
          </div>
          <button @click="generateChirp" class="btn-apply">Generate Chirp</button>
        </div>
      </div>

      <!-- Silence Generator -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3 flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
          Silence
        </h4>
        <div class="space-y-3">
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Duration</label>
              <span class="text-xs text-white">{{ silence.duration }}s</span>
            </div>
            <input type="range" min="0.1" max="60" step="0.1" v-model.number="silence.duration" class="w-full mt-1" />
          </div>
          <button @click="generateSilence" class="btn-apply">Generate Silence</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAudioStore } from '../stores/audioStore'

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const audioStore = useAudioStore()

// Generator parameters
const tone = ref({
  waveform: 'sine',
  frequency: 440,
  duration: 3,
  amplitude: 0.5
})

const noise = ref({
  type: 'white',
  duration: 3,
  amplitude: 0.3
})

const chirp = ref({
  startFreq: 20,
  endFreq: 2000,
  duration: 2
})

const silence = ref({
  duration: 1
})

// Preview state
const previewVolume = ref(0.3)
const isPreviewing = ref(false)
let previewAudioContext = null
let previewSource = null
let previewGain = null

async function generateTone() {
  try {
    await audioStore.init()
    audioStore.generateTone(
      tone.value.frequency,
      tone.value.duration,
      tone.value.waveform,
      tone.value.amplitude
    )
    console.log('Tone generated')
  } catch (error) {
    console.error('Failed to generate tone:', error)
    alert('Failed to generate tone')
  }
}

async function generateNoise() {
  try {
    await audioStore.init()
    audioStore.generateNoise(
      noise.value.duration,
      noise.value.type,
      noise.value.amplitude
    )
    console.log('Noise generated')
  } catch (error) {
    console.error('Failed to generate noise:', error)
    alert('Failed to generate noise')
  }
}

async function generateChirp() {
  try {
    await audioStore.init()
    audioStore.generateChirp(
      chirp.value.startFreq,
      chirp.value.endFreq,
      chirp.value.duration
    )
    console.log('Chirp generated')
  } catch (error) {
    console.error('Failed to generate chirp:', error)
    alert('Failed to generate chirp')
  }
}

async function generateSilence() {
  try {
    await audioStore.init()
    audioStore.generateSilence(silence.value.duration)
    console.log('Silence generated')
  } catch (error) {
    console.error('Failed to generate silence:', error)
    alert('Failed to generate silence')
  }
}

// Preview Functions
function initPreviewContext() {
  if (!previewAudioContext) {
    previewAudioContext = new (window.AudioContext || window.webkitAudioContext)()
    previewGain = previewAudioContext.createGain()
    previewGain.connect(previewAudioContext.destination)
  }
}

function stopPreview() {
  if (previewSource) {
    try {
      previewSource.stop()
      previewSource.disconnect()
    } catch (e) {
      // Already stopped
    }
    previewSource = null
  }
  isPreviewing.value = false
}

async function previewTone() {
  stopPreview()
  initPreviewContext()

  try {
    // Create buffer for preview (limit to 2 seconds for quick preview)
    const previewDuration = Math.min(tone.value.duration, 2)
    const buffer = previewAudioContext.createBuffer(
      1,
      previewAudioContext.sampleRate * previewDuration,
      previewAudioContext.sampleRate
    )
    const data = buffer.getChannelData(0)

    // Generate waveform
    const freq = tone.value.frequency
    for (let i = 0; i < buffer.length; i++) {
      const t = i / buffer.sampleRate
      let sample = 0

      switch (tone.value.waveform) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * freq * t)
          break
        case 'square':
          sample = Math.sign(Math.sin(2 * Math.PI * freq * t))
          break
        case 'sawtooth':
          sample = 2 * ((freq * t) % 1) - 1
          break
      }

      data[i] = sample * tone.value.amplitude
    }

    // Play preview
    previewSource = previewAudioContext.createBufferSource()
    previewSource.buffer = buffer
    previewGain.gain.value = previewVolume.value
    previewSource.connect(previewGain)
    previewSource.onended = () => {
      isPreviewing.value = false
    }
    previewSource.start()
    isPreviewing.value = true
  } catch (error) {
    console.error('Preview failed:', error)
    isPreviewing.value = false
  }
}
</script>

<style scoped>
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: #374151;
  outline: none;
  border-radius: 4px;
  height: 4px;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
}

input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
  border: none;
}

.btn-apply {
  @apply w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors;
}

.btn-preview {
  @apply px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors;
}

.btn-stop {
  @apply px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors;
}

select {
  outline: none;
}

select:focus {
  ring: 2px;
  ring-color: #3b82f6;
}
</style>
