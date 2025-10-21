<template>
  <div class="track-container mb-4">
    <!-- Track Header -->
    <div class="flex items-center gap-2 p-3 bg-gray-800 border-b border-gray-700">
      <!-- Selection Checkbox -->
      <input
        type="checkbox"
        v-model="track.selected"
        class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
        title="Select for slicing"
      />

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
    <div
      ref="trackContainer"
      class="relative bg-gray-900 h-32"
      :class="{ 'ring-2 ring-blue-500': isDraggingOver }"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <!-- Audio clips -->
      <AudioClip
        v-for="clip in track.clips"
        :key="clip.id"
        :clip="clip"
        :track-id="track.id"
        :project-duration="audioStore.duration || 1"
        @delete="deleteClip"
      />

      <!-- Empty track message -->
      <div
        v-if="track.clips.length === 0"
        class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm pointer-events-none"
      >
        Empty track - Drag audio here or paste
      </div>

      <!-- Selection overlay -->
      <div
        v-if="audioStore.selection && audioStore.selection.trackId === track.id"
        class="absolute top-0 bottom-0 bg-white bg-opacity-20 pointer-events-none border-l-2 border-r-2 border-white"
        :style="selectionStyle"
      ></div>

      <!-- Drop indicator -->
      <div
        v-if="isDraggingOver"
        class="absolute top-0 bottom-0 bg-blue-500 bg-opacity-30 pointer-events-none"
      ></div>

      <!-- Snap guide line -->
      <div
        v-if="snapGuidePosition !== null"
        class="absolute top-0 bottom-0 w-0.5 bg-yellow-400 pointer-events-none"
        :style="{ left: snapGuidePosition + 'px' }"
      ></div>
    </div>

    <!-- Time Markers -->
    <div class="relative h-5 bg-gray-950">
      <canvas ref="timeMarkerCanvas" class="w-full h-full"></canvas>
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

    <!-- Context Menu -->
    <ContextMenu
      :visible="showContextMenu"
      :position="contextMenuPosition"
      :track-id="track.id"
      @close="showContextMenu = false"
      @effect="handleEffectFromMenu"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import ContextMenu from './ContextMenu.vue'
import AudioClip from './AudioClip.vue'

const props = defineProps({
  track: {
    type: Object,
    required: true
  }
})

const audioStore = useAudioStore()
const waveformCanvas = ref(null)
const timeMarkerCanvas = ref(null)
const trackContainer = ref(null)
const volume = ref(props.track.volume)
const pan = ref(props.track.pan)
const isSelecting = ref(false)
const isDraggingOver = ref(false)
const snapGuidePosition = ref(null)
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

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
  drawTimeMarkers()
  // Redraw on window resize
  window.addEventListener('resize', () => {
    drawWaveform()
    drawTimeMarkers()
  })
})

watch(() => props.track.waveformData, () => {
  drawWaveform()
  drawTimeMarkers()
})

watch(() => props.track.duration, () => {
  drawTimeMarkers()
})

watch(() => audioStore.duration, () => {
  // Redraw when project duration changes (longest track changes)
  drawWaveform()
  drawTimeMarkers()
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

  // Scale waveform based on project duration (longest track)
  const projectDuration = audioStore.duration || props.track.duration || 1
  const trackDuration = props.track.duration || 0
  const scaleFactor = trackDuration / projectDuration
  const waveformWidth = rect.width * scaleFactor

  // Draw waveform
  const data = props.track.waveformData
  const middle = rect.height / 2
  const barWidth = waveformWidth / data.length
  const color = props.track.color || '#3b82f6'

  ctx.fillStyle = color

  for (let i = 0; i < data.length; i++) {
    const { min, max } = data[i]
    const x = i * barWidth
    const height = (max - min) * middle

    ctx.fillRect(x, middle - (max * middle), Math.max(1, barWidth - 0.5), height)
  }

  // Draw center line across scaled waveform
  ctx.strokeStyle = '#374151' // gray-700
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, middle)
  ctx.lineTo(waveformWidth, middle)
  ctx.stroke()

  // Draw gray background for remainder
  if (waveformWidth < rect.width) {
    ctx.fillStyle = '#0f172a' // darker gray
    ctx.fillRect(waveformWidth, 0, rect.width - waveformWidth, rect.height)

    // Extend center line to end
    ctx.strokeStyle = '#1f2937'
    ctx.beginPath()
    ctx.moveTo(waveformWidth, middle)
    ctx.lineTo(rect.width, middle)
    ctx.stroke()
  }
}

function drawTimeMarkers() {
  const canvas = timeMarkerCanvas.value
  if (!canvas || !props.track.duration) return

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  ctx.scale(dpr, dpr)

  // Clear canvas
  ctx.fillStyle = '#030712' // gray-950
  ctx.fillRect(0, 0, rect.width, rect.height)

  const duration = props.track.duration
  const snapInterval = audioStore.timelineSnapInterval || 1
  const pixelsPerSecond = rect.width / duration

  ctx.strokeStyle = '#374151' // gray-700
  ctx.fillStyle = '#6b7280' // gray-500
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'

  // Draw time markers based on snap interval
  for (let time = 0; time <= duration; time += snapInterval) {
    const x = time * pixelsPerSecond

    // Draw tick
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, rect.height)
    ctx.stroke()

    // Draw time label
    if (time % (snapInterval * 5) === 0 || snapInterval >= 5) {
      const mins = Math.floor(time / 60)
      const secs = Math.floor(time % 60)
      const label = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`
      ctx.fillText(label, x, rect.height - 2)
    }
  }
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

function handleContextMenu(e) {
  showContextMenu.value = false
  // Use nextTick to ensure menu closes before reopening
  setTimeout(() => {
    contextMenuPosition.value = { x: e.clientX, y: e.clientY }
    showContextMenu.value = true
    audioStore.selectedTrackId = props.track.id
  }, 10)
}

function handleEffectFromMenu(effectName) {
  console.log('Apply effect from context menu:', effectName)
  // This will open the effects panel with the specific effect
  // For now, we'll just log it - you could emit an event to parent
}

function handleDragOver(e) {
  isDraggingOver.value = true

  const type = e.dataTransfer.types.includes('type') ? e.dataTransfer.getData('type') : null

  if (type === 'audio-clip') {
    e.dataTransfer.dropEffect = 'move'

    // Show snap guide
    const rect = trackContainer.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const projectDuration = audioStore.duration || 1
    const time = (x / rect.width) * projectDuration

    // Snap to grid
    const snapInterval = audioStore.timelineSnapInterval || 1
    const snappedTime = Math.round(time / snapInterval) * snapInterval
    snapGuidePosition.value = (snappedTime / projectDuration) * rect.width
  } else {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragLeave(e) {
  isDraggingOver.value = false
  snapGuidePosition.value = null
}

function handleDrop(e) {
  isDraggingOver.value = false
  snapGuidePosition.value = null

  const type = e.dataTransfer.getData('type')

  // Handle clip drop (moving between tracks or within track)
  if (type === 'audio-clip') {
    const clipId = e.dataTransfer.getData('clipId')
    const fromTrackId = e.dataTransfer.getData('trackId')
    const offsetX = parseFloat(e.dataTransfer.getData('offsetX'))

    if (!clipId || !fromTrackId) {
      console.log('No clip ID or track ID in drop event')
      return
    }

    // Calculate new position from drop location
    const rect = trackContainer.value.getBoundingClientRect()
    const dropX = e.clientX - rect.left - offsetX // Account for where user grabbed the clip
    const projectDuration = audioStore.duration || 1
    let newStartTime = (dropX / rect.width) * projectDuration

    // Ensure it's not negative
    newStartTime = Math.max(0, newStartTime)

    // Move the clip
    const success = audioStore.moveClip(clipId, fromTrackId, props.track.id, newStartTime)
    if (success) {
      console.log(`✓ Moved clip to ${newStartTime.toFixed(2)}s in track ${props.track.name}`)
    } else {
      console.error('Failed to move clip')
    }
    return
  }

  // Handle snippet drop (creating new clip from snippet)
  const snippetId = e.dataTransfer.getData('application/snippet-id')
  if (snippetId) {
    // Calculate position from drop location
    const rect = trackContainer.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const duration = props.track.duration || 1
    const position = (x / rect.width) * duration

    // Place snippet at position
    const success = audioStore.placeSnippet(snippetId, props.track.id, position)
    if (success) {
      console.log(`✓ Placed snippet at ${position.toFixed(2)}s in track ${props.track.name}`)
    } else {
      console.error('Failed to place snippet')
    }
    return
  }

  console.log('Unknown drop type')
}

function deleteClip(clipId) {
  if (confirm('Delete this clip?')) {
    audioStore.removeClip(props.track.id, clipId)
  }
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
