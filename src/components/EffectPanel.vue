<template>
  <div v-if="visible" class="effect-panel-container fixed right-4 top-20 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto bg-gray-800 rounded-lg shadow-2xl z-50">
    <div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
      <h3 class="text-white font-semibold">Effects</h3>
      <button @click="$emit('close')" class="text-gray-400 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div v-if="!selectedTrack" class="p-4 text-gray-400 text-sm">
      Select a track to apply effects
    </div>

    <div v-else class="p-4 space-y-4">
      <div class="text-sm text-gray-400 mb-4">
        Track: <span class="text-white">{{ selectedTrack.name }}</span>
      </div>

      <!-- Amplify -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Amplify</h4>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Factor</label>
            <span class="text-xs text-white">{{ amplifyFactor.toFixed(2) }}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            v-model.number="amplifyFactor"
            class="w-full"
          />
          <button @click="applyAmplify" class="btn-apply">Apply Amplify</button>
        </div>
      </div>

      <!-- Normalize -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Normalize</h4>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Target Peak</label>
            <span class="text-xs text-white">{{ (targetPeak * 100).toFixed(0) }}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            v-model.number="targetPeak"
            class="w-full"
          />
          <button @click="applyNormalize" class="btn-apply">Apply Normalize</button>
        </div>
      </div>

      <!-- Fade In -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Fade In</h4>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Duration</label>
            <span class="text-xs text-white">{{ (fadeInDuration / 1000).toFixed(2) }}s</span>
          </div>
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            v-model.number="fadeInDuration"
            class="w-full"
          />
          <button @click="applyFadeIn" class="btn-apply">Apply Fade In</button>
        </div>
      </div>

      <!-- Fade Out -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Fade Out</h4>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Duration</label>
            <span class="text-xs text-white">{{ (fadeOutDuration / 1000).toFixed(2) }}s</span>
          </div>
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            v-model.number="fadeOutDuration"
            class="w-full"
          />
          <button @click="applyFadeOut" class="btn-apply">Apply Fade Out</button>
        </div>
      </div>

      <!-- Low Pass Filter -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Low Pass Filter</h4>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Cutoff Frequency</label>
            <span class="text-xs text-white">{{ lowPassCutoff }} Hz</span>
          </div>
          <input
            type="range"
            min="100"
            max="10000"
            step="100"
            v-model.number="lowPassCutoff"
            class="w-full"
          />
          <button @click="applyLowPass" class="btn-apply">Apply Low Pass</button>
        </div>
      </div>

      <!-- High Pass Filter -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">High Pass Filter</h4>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Cutoff Frequency</label>
            <span class="text-xs text-white">{{ highPassCutoff }} Hz</span>
          </div>
          <input
            type="range"
            min="20"
            max="2000"
            step="10"
            v-model.number="highPassCutoff"
            class="w-full"
          />
          <button @click="applyHighPass" class="btn-apply">Apply High Pass</button>
        </div>
      </div>

      <!-- Compressor -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Compressor</h4>
        <div class="space-y-3">
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Threshold</label>
              <span class="text-xs text-white">{{ compThreshold.toFixed(2) }}</span>
            </div>
            <input type="range" min="0.1" max="0.9" step="0.05" v-model.number="compThreshold" class="w-full" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Ratio</label>
              <span class="text-xs text-white">{{ compRatio.toFixed(1) }}:1</span>
            </div>
            <input type="range" min="1" max="20" step="0.5" v-model.number="compRatio" class="w-full" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Attack</label>
              <span class="text-xs text-white">{{ (compAttack * 1000).toFixed(0) }}ms</span>
            </div>
            <input type="range" min="0.001" max="0.1" step="0.001" v-model.number="compAttack" class="w-full" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Release</label>
              <span class="text-xs text-white">{{ (compRelease * 1000).toFixed(0) }}ms</span>
            </div>
            <input type="range" min="0.01" max="1" step="0.01" v-model.number="compRelease" class="w-full" />
          </div>
          <button @click="applyCompress" class="btn-apply">Apply Compressor</button>
        </div>
      </div>

      <!-- Reverse -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Reverse</h4>
        <p class="text-xs text-gray-400 mb-2">Reverse the audio playback</p>
        <button @click="applyReverse" class="btn-apply">Apply Reverse</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { useHistoryStore } from '../stores/historyStore'
import { ApplyEffectCommand } from '../utils/commands'
import { storeToRefs } from 'pinia'

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const audioStore = useAudioStore()
const historyStore = useHistoryStore()
const { selectedTrack, selection } = storeToRefs(audioStore)

// Effect parameters
const amplifyFactor = ref(2)
const targetPeak = ref(1)
const fadeInDuration = ref(1000)
const fadeOutDuration = ref(1000)
const lowPassCutoff = ref(2000)
const highPassCutoff = ref(100)
const compThreshold = ref(0.5)
const compRatio = ref(4)
const compAttack = ref(0.005)
const compRelease = ref(0.1)

// Helper function to apply effects with undo support
function applyEffectWithUndo(effectName, params) {
  if (!selectedTrack.value) return
  try {
    const command = new ApplyEffectCommand(
      audioStore,
      selectedTrack.value.id,
      effectName,
      params,
      selection.value
    )
    historyStore.execute(command)
    console.log(`${effectName} applied` + (selection.value ? ' to selection' : ''))
  } catch (error) {
    console.error(`Failed to apply ${effectName}:`, error)
    alert('Failed to apply effect')
  }
}

function applyAmplify() {
  applyEffectWithUndo('amplify', { factor: amplifyFactor.value })
}

function applyNormalize() {
  applyEffectWithUndo('normalize', { targetPeak: targetPeak.value })
}

function applyFadeIn() {
  const samples = Math.floor((fadeInDuration.value / 1000) * audioStore.sampleRate)
  applyEffectWithUndo('fadeIn', { samples })
}

function applyFadeOut() {
  const samples = Math.floor((fadeOutDuration.value / 1000) * audioStore.sampleRate)
  applyEffectWithUndo('fadeOut', { samples })
}

function applyLowPass() {
  applyEffectWithUndo('lowPass', { cutoff: lowPassCutoff.value })
}

function applyHighPass() {
  applyEffectWithUndo('highPass', { cutoff: highPassCutoff.value })
}

function applyCompress() {
  applyEffectWithUndo('compress', {
    threshold: compThreshold.value,
    ratio: compRatio.value,
    attack: compAttack.value,
    release: compRelease.value
  })
}

function applyReverse() {
  applyEffectWithUndo('reverse', {})
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

.effect-panel-container {
  backdrop-filter: blur(10px);
}
</style>
