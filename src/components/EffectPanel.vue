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
      <div class="text-sm mb-4">
        <div class="text-gray-400">
          Track: <span class="text-white">{{ selectedTrack.name }}</span>
        </div>
        <div v-if="audioStore.selectedClipId" class="text-blue-400 mt-1">
          Selected Clip: <span class="text-white">{{ selectedClipName }}</span>
        </div>
        <div v-else class="text-gray-500 mt-1 text-xs">
          Click a clip to apply effects to it specifically
        </div>
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

      <!-- Equalizer -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Equalizer (10-Band)</h4>
        <div class="space-y-2">
          <div v-for="freq in equalizerBands" :key="freq" class="flex items-center gap-2">
            <label class="text-xs text-gray-400 w-12">{{ freq >= 1000 ? (freq / 1000) + 'k' : freq }}</label>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              v-model.number="eqGains[freq]"
              class="flex-1"
            />
            <span class="text-xs text-white w-12 text-right">{{ eqGains[freq] > 0 ? '+' : '' }}{{ eqGains[freq] }}dB</span>
          </div>
          <div class="flex gap-2">
            <button @click="resetEqualizer" class="btn-apply bg-gray-700">Reset</button>
            <button @click="applyEqualizer" class="btn-apply flex-1">Apply Equalizer</button>
          </div>
        </div>
      </div>

      <!-- Pitch Shift -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Pitch Shift</h4>
        <div class="space-y-2">
          <!-- Pitch Detector Display -->
          <div v-if="detectedPitch" class="bg-gray-700 rounded p-2 mb-2">
            <div class="text-xs text-gray-400">Current Pitch:</div>
            <div class="text-lg text-blue-400 font-bold">{{ detectedPitch.frequency }} Hz</div>
            <div class="text-sm text-white">{{ detectedPitch.note }}</div>
          </div>
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Semitones</label>
            <span class="text-xs text-white">{{ pitchShiftSemitones > 0 ? '+' : '' }}{{ pitchShiftSemitones }}</span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            v-model.number="pitchShiftSemitones"
            @input="updatePitchPreview"
            class="w-full"
          />
          <div v-if="pitchPreview" class="text-xs text-gray-400">
            Preview: {{ pitchPreview.frequency }} Hz ({{ pitchPreview.note }})
          </div>
          <div class="flex gap-2">
            <button @click="detectPitchNow" class="btn-apply bg-gray-700">Detect Pitch</button>
            <button @click="applyPitchShift" class="btn-apply flex-1">Apply Pitch Shift</button>
          </div>
        </div>
      </div>

      <!-- Reverb -->
      <div class="effect-panel">
        <h4 class="text-white text-sm font-medium mb-3">Reverb</h4>
        <div class="space-y-3">
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Room Size</label>
              <span class="text-xs text-white">{{ (reverbRoomSize * 100).toFixed(0) }}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" v-model.number="reverbRoomSize" class="w-full" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Damping</label>
              <span class="text-xs text-white">{{ (reverbDamping * 100).toFixed(0) }}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" v-model.number="reverbDamping" class="w-full" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Wet Level</label>
              <span class="text-xs text-white">{{ (reverbWetLevel * 100).toFixed(0) }}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" v-model.number="reverbWetLevel" class="w-full" />
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Dry Level</label>
              <span class="text-xs text-white">{{ (reverbDryLevel * 100).toFixed(0) }}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" v-model.number="reverbDryLevel" class="w-full" />
          </div>
          <button @click="applyReverb" class="btn-apply">Apply Reverb</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { useHistoryStore } from '../stores/historyStore'
import { ApplyEffectCommand, ApplyEffectToClipCommand } from '../utils/commands'
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

// Get selected clip name
const selectedClipName = computed(() => {
  if (!audioStore.selectedClipId) return ''
  const clipData = audioStore.selectedClip
  return clipData?.clip?.name || 'Unknown'
})

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

// Equalizer parameters
const equalizerBands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
const eqGains = ref({
  31: 0,
  62: 0,
  125: 0,
  250: 0,
  500: 0,
  1000: 0,
  2000: 0,
  4000: 0,
  8000: 0,
  16000: 0
})

// Pitch shift parameters
const pitchShiftSemitones = ref(0)
const detectedPitch = ref(null)
const pitchPreview = ref(null)

// Reverb parameters
const reverbRoomSize = ref(0.5)
const reverbDamping = ref(0.5)
const reverbWetLevel = ref(0.3)
const reverbDryLevel = ref(0.7)

// Helper function to apply effects with undo support
function applyEffectWithUndo(effectName, params) {
  // If a clip is selected, apply effect to clip with undo
  if (audioStore.selectedClipId) {
    try {
      const command = new ApplyEffectToClipCommand(
        audioStore,
        audioStore.selectedClipId,
        effectName,
        params
      )
      historyStore.execute(command)
      console.log(`✅ ${effectName} applied to clip (Ctrl+Z to undo)`)
    } catch (error) {
      console.error(`Failed to apply ${effectName} to clip:`, error)
      alert('Failed to apply effect to clip')
    }
    return
  }

  // Otherwise apply to track (old behavior) with undo
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
    console.log(`✅ ${effectName} applied (Ctrl+Z to undo)`)
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

function resetEqualizer() {
  for (const freq of equalizerBands) {
    eqGains.value[freq] = 0
  }
}

function applyEqualizer() {
  applyEffectWithUndo('equalizer', { bands: { ...eqGains.value } })
}

function detectPitchNow() {
  // Get the current audio data to analyze
  const clipData = audioStore.selectedClip
  if (!clipData) {
    if (selectedTrack.value?.buffer) {
      // Use track buffer if no clip selected
      const channelData = selectedTrack.value.buffer.getChannelData(0)
      const frequency = audioStore.advancedEffects.detectPitch(channelData)
      const note = audioStore.advancedEffects.frequencyToNote(frequency)
      detectedPitch.value = { frequency, note }
    }
    return
  }

  const { clip } = clipData
  if (!clip.buffer) return

  const channelData = clip.buffer.getChannelData(0)
  const frequency = audioStore.advancedEffects.detectPitch(channelData)
  const note = audioStore.advancedEffects.frequencyToNote(frequency)
  detectedPitch.value = { frequency, note }
  updatePitchPreview()
}

function updatePitchPreview() {
  if (!detectedPitch.value) return

  const originalFreq = detectedPitch.value.frequency
  if (originalFreq === 0) {
    pitchPreview.value = null
    return
  }

  const ratio = Math.pow(2, pitchShiftSemitones.value / 12)
  const newFreq = Math.round(originalFreq * ratio * 10) / 10
  const newNote = audioStore.advancedEffects.frequencyToNote(newFreq)
  pitchPreview.value = { frequency: newFreq, note: newNote }
}

function applyPitchShift() {
  if (pitchShiftSemitones.value === 0) {
    alert('No pitch shift selected (0 semitones)')
    return
  }
  applyEffectWithUndo('pitch', { semitones: pitchShiftSemitones.value })
  // Update detected pitch after applying
  if (detectedPitch.value) {
    detectPitchNow()
  }
}

function applyReverb() {
  applyEffectWithUndo('reverb', {
    roomSize: reverbRoomSize.value,
    damping: reverbDamping.value,
    wetLevel: reverbWetLevel.value,
    dryLevel: reverbDryLevel.value
  })
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
