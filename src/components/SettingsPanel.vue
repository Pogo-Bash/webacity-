<template>
  <div v-if="visible" class="settings-panel-container fixed right-4 bottom-20 w-96 bg-gray-800 rounded-lg shadow-2xl z-50">
    <div class="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between rounded-t-lg">
      <h3 class="text-white font-semibold flex items-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
        </svg>
        Settings
      </h3>
      <button @click="$emit('close')" class="text-gray-400 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="p-4 space-y-4">
      <!-- Timeline Settings -->
      <div class="setting-section">
        <h4 class="text-white text-sm font-medium mb-3">Timeline & Grid</h4>

        <div class="space-y-3">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-gray-400">Snap Interval</label>
              <span class="text-xs text-white font-mono">{{ audioStore.timelineSnapInterval }}s</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="30"
              step="0.1"
              v-model.number="audioStore.timelineSnapInterval"
              @input="updateTimelineGrid"
              class="w-full"
            />
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.1s</span>
              <span>Fine</span>
              <span>Coarse</span>
              <span>30s</span>
            </div>
          </div>

          <div class="text-xs text-gray-400 bg-gray-900 p-2 rounded">
            <p>Controls the timeline grid spacing and time marker frequency.</p>
            <p class="mt-1">• Fine (0.1-1s): Precise editing</p>
            <p>• Medium (1-10s): General editing</p>
            <p>• Coarse (10-30s): Overview mode</p>
          </div>

          <!-- Quick Presets -->
          <div>
            <label class="text-xs text-gray-400 block mb-2">Quick Presets</label>
            <div class="grid grid-cols-4 gap-2">
              <button
                @click="setSnapInterval(0.1)"
                class="preset-btn"
                :class="{ 'active': audioStore.timelineSnapInterval === 0.1 }"
              >
                0.1s
              </button>
              <button
                @click="setSnapInterval(0.5)"
                class="preset-btn"
                :class="{ 'active': audioStore.timelineSnapInterval === 0.5 }"
              >
                0.5s
              </button>
              <button
                @click="setSnapInterval(1)"
                class="preset-btn"
                :class="{ 'active': audioStore.timelineSnapInterval === 1 }"
              >
                1s
              </button>
              <button
                @click="setSnapInterval(5)"
                class="preset-btn"
                :class="{ 'active': audioStore.timelineSnapInterval === 5 }"
              >
                5s
              </button>
              <button
                @click="setSnapInterval(10)"
                class="preset-btn"
                :class="{ 'active': audioStore.timelineSnapInterval === 10 }"
              >
                10s
              </button>
              <button
                @click="setSnapInterval(15)"
                class="preset-btn"
                :class="{ 'active': audioStore.timelineSnapInterval === 15 }"
              >
                15s
              </button>
              <button
                @click="setSnapInterval(20)"
                class="preset-btn"
                :class="{ 'active': audioStore.timelineSnapInterval === 20 }"
              >
                20s
              </button>
              <button
                @click="setSnapInterval(30)"
                class="preset-btn"
                :class="{ 'active': audioStore.timelineSnapInterval === 30 }"
              >
                30s
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- View Settings -->
      <div class="setting-section border-t border-gray-700 pt-4">
        <h4 class="text-white text-sm font-medium mb-3">Display</h4>

        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-400 block mb-2">View Mode</label>
            <div class="flex gap-2">
              <button
                @click="audioStore.viewMode = 'waveform'"
                class="flex-1 px-3 py-2 text-sm rounded transition-colors"
                :class="audioStore.viewMode === 'waveform'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
              >
                Waveform
              </button>
              <button
                @click="audioStore.viewMode = 'spectrogram'"
                class="flex-1 px-3 py-2 text-sm rounded transition-colors"
                :class="audioStore.viewMode === 'spectrogram'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
              >
                Spectrogram
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sample Rate Info -->
      <div class="setting-section border-t border-gray-700 pt-4">
        <h4 class="text-white text-sm font-medium mb-3">Project Info</h4>
        <div class="space-y-2 text-xs">
          <div class="flex justify-between text-gray-400">
            <span>Sample Rate:</span>
            <span class="text-white font-mono">{{ audioStore.sampleRate }} Hz</span>
          </div>
          <div class="flex justify-between text-gray-400">
            <span>Tracks:</span>
            <span class="text-white">{{ audioStore.tracks.length }}</span>
          </div>
          <div class="flex justify-between text-gray-400">
            <span>Duration:</span>
            <span class="text-white font-mono">{{ formatDuration(audioStore.duration) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAudioStore } from '../stores/audioStore'

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const audioStore = useAudioStore()

function setSnapInterval(value) {
  audioStore.timelineSnapInterval = value
  updateTimelineGrid()
}

function updateTimelineGrid() {
  // Trigger re-render of track time markers
  // The watch in Track.vue will handle the actual redrawing
  console.log('Timeline snap interval updated to', audioStore.timelineSnapInterval, 'seconds')
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
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
  width: 14px;
  height: 14px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
}

input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
  border: none;
}

.preset-btn {
  @apply px-3 py-2 bg-gray-700 text-gray-300 text-xs rounded transition-colors hover:bg-gray-600;
}

.preset-btn.active {
  @apply bg-blue-600 text-white;
}

.setting-section {
  @apply bg-gray-900 rounded p-3;
}
</style>
