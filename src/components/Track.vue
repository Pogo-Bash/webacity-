<template>
  <div class="track-container mb-4">
    <!-- Track Header -->
    <div class="flex items-center gap-2 p-3 bg-gray-800 border-b border-gray-700">
      <div class="flex-1">
        <input
          v-model="track.name"
          class="bg-transparent text-white text-sm font-medium outline-none w-full"
          @blur="updateTrackName"
        />
      </div>

      <!-- Track Controls -->
      <div class="flex items-center gap-2">
        <!-- Mute Button -->
        <button
          @click="toggleMute"
          :class="['px-2 py-1 rounded text-xs font-bold transition-colors',
                   track.muted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600']"
        >
          M
        </button>

        <!-- Solo Button -->
        <button
          @click="toggleSolo"
          :class="['px-2 py-1 rounded text-xs font-bold transition-colors',
                   track.solo ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600']"
        >
          S
        </button>

        <!-- Delete Button -->
        <button
          @click="deleteTrack"
          class="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300 hover:bg-red-600 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Waveform Display -->
    <div class="relative bg-gray-900 h-32">
      <canvas
        ref="waveformCanvas"
        class="waveform-canvas w-full h-full"
        @mousedown="startSelection"
        @mousemove="updateSelection"
        @mouseup="endSelection"
        @mouseleave="endSelection"
        @dragover.prevent="handleDragOver"
        @drop.prevent="handleDrop"
      ></canvas>

      <!-- Selection overlay -->
      <div
        v-if="audioStore.selection && audioStore.selection.trackId === track.id"
        class="absolute top-0 bottom-0 bg-white bg-opacity-20 pointer-events-none border-l-2 border-r-2 border-white"
        :style="selectionStyle"
      ></div>
    </div>

    <!-- Track Controls Bottom -->
    <div class="flex items-center gap-4 p-3 bg-gray-800 border-t border-gray-700">
      <!-- Volume -->
      <div class="flex items-center gap-2 flex-1">
        <span class="text-xs text-gray-400">Vol</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          v-model.number="volume"
          @input="updateVolume"
          class="flex-1"
        />
        <span class="text-xs text-gray-400 w-12 text-right">{{ Math.round(volume * 100) }}%</span>
      </div>

      <!-- Pan -->
      <div class="flex items-center gap-2 flex-1">
        <span class="text-xs text-gray-400">Pan</span>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          v-model.number="pan"
          @input="updatePan"
          class="flex-1"
        />
        <span class="text-xs text-gray-400 w-12 text-right">
          {{ pan === 0 ? 'C' : pan < 0 ? `L${Math.abs(Math.round(pan * 100))}` : `R${Math.round(pan * 100)}` }}
        </span>
      </div>

      <!-- Duration -->
      <div class="text-xs text-gray-400">
        {{ formatDuration(track.duration || 0) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'

const props = defineProps({
  track: {
    type: Object,
    required: true
  }
})

const audioStore = useAudioStore()
const waveformCanvas = ref(null)
const volume = ref(props.track.volume)
const pan = ref(props.track.pan)
const isSelecting = ref(false)

const selectionStyle = computed(() => {
  if (!audioStore.selection || audioStore.selection.trackId !== props.track.id) return {}

  if (!props.track.duration) return {}

  const canvas = waveformCanvas.value
  if (!canvas) return {}

  const rect = canvas.getBoundingClientRect()
  const { startTime, endTime } = audioStore.selection

  const leftPx = (startTime / props.track.duration) * rect.width
  const rightPx = (endTime / props.track.duration) * rect.width

  return {
    left: `${leftPx}px`,
    width: `${rightPx - leftPx}px`
  }
})

onMounted(() => {
  drawWaveform()
  // Redraw on window resize
  window.addEventListener('resize', drawWaveform)
})

watch(() => props.track.waveformData, () => {
  drawWaveform()
})

function drawWaveform() {
  const canvas = waveformCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  // Set canvas size accounting for device pixel ratio
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  ctx.scale(dpr, dpr)

  // Clear canvas
  ctx.fillStyle = '#111827' // gray-900
  ctx.fillRect(0, 0, rect.width, rect.height)

  if (!props.track.waveformData || props.track.waveformData.length === 0) {
    // Draw empty state
    ctx.fillStyle = '#4b5563' // gray-600
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('No audio loaded', rect.width / 2, rect.height / 2)
    return
  }

  // Draw waveform
  const data = props.track.waveformData
  const middle = rect.height / 2
  const barWidth = rect.width / data.length
  const color = props.track.color || '#3b82f6'

  ctx.fillStyle = color

  for (let i = 0; i < data.length; i++) {
    const { min, max } = data[i]
    const x = i * barWidth
    const height = (max - min) * middle

    ctx.fillRect(x, middle - (max * middle), Math.max(1, barWidth - 0.5), height)
  }

  // Draw center line
  ctx.strokeStyle = '#374151' // gray-700
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, middle)
  ctx.lineTo(rect.width, middle)
  ctx.stroke()
}

function selectTrack() {
  audioStore.selectedTrackId = props.track.id
}

function toggleMute() {
  audioStore.toggleMute(props.track.id)
}

function toggleSolo() {
  props.track.solo = !props.track.solo
}

function deleteTrack() {
  if (confirm(`Delete track "${props.track.name}"?`)) {
    audioStore.removeTrack(props.track.id)
  }
}

function updateVolume() {
  audioStore.setTrackVolume(props.track.id, volume.value)
}

function updatePan() {
  audioStore.setTrackPan(props.track.id, pan.value)
}

function updateTrackName() {
  // Track name is already bound via v-model
}

let selectionStartTime = 0

function startSelection(e) {
  // Only select on left click
  if (e.button !== 0) return

  const rect = waveformCanvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const duration = props.track.duration || 0

  // Convert pixel to time
  selectionStartTime = (x / rect.width) * duration

  isSelecting.value = true
  audioStore.selectedTrackId = props.track.id
}

function updateSelection(e) {
  if (!isSelecting.value) return

  const rect = waveformCanvas.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const duration = props.track.duration || 0

  // Convert pixel to time
  const currentTime = (x / rect.width) * duration

  // Update selection in store
  audioStore.setSelection(props.track.id, selectionStartTime, currentTime)
}

function endSelection() {
  if (!isSelecting.value) return
  isSelecting.value = false

  // Clear selection if it's too small (less than 0.01 seconds)
  if (audioStore.selection) {
    const { startTime, endTime } = audioStore.selection
    if (Math.abs(endTime - startTime) < 0.01) {
      audioStore.clearSelection()
    }
  }
}

function handleDragOver(e) {
  e.dataTransfer.dropEffect = 'copy'
}

function handleDrop(e) {
  const snippetId = e.dataTransfer.getData('application/snippet-id')
  if (!snippetId) return

  // Calculate position from drop location
  const rect = waveformCanvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const duration = props.track.duration || 0
  const position = (x / rect.width) * duration

  // Place snippet at position
  audioStore.placeSnippet(snippetId, props.track.id, position)
  console.log(`Placed snippet at ${position.toFixed(2)}s in track ${props.track.name}`)
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
</style>
