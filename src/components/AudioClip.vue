<template>
  <div
    ref="clipElement"
    class="absolute top-0 h-full cursor-move rounded overflow-hidden"
    :class="[
      isSelected ? 'ring-2 ring-blue-400 border border-blue-400' : 'border border-gray-600',
    ]"
    :style="{
      left: clipPosition + 'px',
      width: clipWidth + 'px',
      backgroundColor: clip.color + '40' // Add transparency
    }"
    :title="clip.name"
    draggable="true"
    @click.stop="selectClip"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <!-- Waveform canvas -->
    <canvas
      ref="waveformCanvas"
      class="w-full h-full"
    ></canvas>

    <!-- Clip name overlay -->
    <div class="absolute top-0 left-0 right-0 px-1 py-0.5 text-xs text-white bg-black bg-opacity-50 truncate pointer-events-none">
      {{ clip.name }}
    </div>

    <!-- Delete button -->
    <button
      class="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
      @click.stop="$emit('delete', clip.id)"
      title="Delete clip"
    >
      ×
    </button>

    <!-- Overlap indicator -->
    <div
      v-if="hasOverlap"
      class="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500"
      title="This clip overlaps with another"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAudioStore } from '../stores/audioStore'

const props = defineProps({
  clip: {
    type: Object,
    required: true
  },
  trackId: {
    type: String,
    required: true
  },
  projectDuration: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['delete'])

const audioStore = useAudioStore()
const clipElement = ref(null)
const waveformCanvas = ref(null)

// Calculate clip position and width in pixels
const clipPosition = computed(() => {
  if (!props.projectDuration) return 0
  // Assuming track width is based on container, we'll use a ratio
  const containerWidth = clipElement.value?.parentElement?.offsetWidth || 1000
  return (props.clip.startTime / props.projectDuration) * containerWidth
})

const clipWidth = computed(() => {
  if (!props.projectDuration) return 100
  const containerWidth = clipElement.value?.parentElement?.offsetWidth || 1000
  return (props.clip.duration / props.projectDuration) * containerWidth
})

// Check if this clip is selected
const isSelected = computed(() => {
  return audioStore.selectedClipId === props.clip.id
})

// Check if this clip overlaps with others
const hasOverlap = computed(() => {
  const track = audioStore.tracks.find(t => t.id === props.trackId)
  if (!track) return false

  const clipEndTime = props.clip.startTime + props.clip.duration

  return track.clips.some(otherClip => {
    if (otherClip.id === props.clip.id) return false

    const otherEndTime = otherClip.startTime + otherClip.duration

    // Check for overlap
    return (
      (props.clip.startTime < otherEndTime && clipEndTime > otherClip.startTime)
    )
  })
})

// Select this clip
function selectClip() {
  audioStore.selectedClipId = props.clip.id
  audioStore.selectedTrackId = props.trackId
}

// Draw waveform
function drawWaveform() {
  const canvas = waveformCanvas.value
  if (!canvas || !props.clip.waveformData) return

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  ctx.scale(dpr, dpr)

  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height)

  // Draw waveform
  const data = props.clip.waveformData
  const middle = rect.height / 2
  const barWidth = rect.width / data.length

  ctx.fillStyle = props.clip.color || '#3b82f6'

  for (let i = 0; i < data.length; i++) {
    const { min, max } = data[i]
    const x = i * barWidth
    const height = (max - min) * middle

    ctx.fillRect(x, middle - (max * middle), Math.max(1, barWidth - 0.5), height)
  }

  // Draw center line
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, middle)
  ctx.lineTo(rect.width, middle)
  ctx.stroke()
}

// Drag and drop handlers
function onDragStart(event) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('clipId', props.clip.id)
  event.dataTransfer.setData('trackId', props.trackId)
  event.dataTransfer.setData('clipStartTime', props.clip.startTime)
  event.dataTransfer.setData('type', 'audio-clip')

  // Store the offset where the drag started
  const rect = clipElement.value.getBoundingClientRect()
  const offsetX = event.clientX - rect.left
  event.dataTransfer.setData('offsetX', offsetX)
}

function onDragEnd(event) {
  // Clean up if needed
}

// Watch for changes that require redraw
watch(
  () => props.clip,
  () => {
    setTimeout(() => drawWaveform(), 0)
  },
  { deep: true }
)

// Also watch project duration separately as it affects positioning
watch(
  () => props.projectDuration,
  () => {
    setTimeout(() => drawWaveform(), 0)
  }
)

onMounted(() => {
  // Delay initial draw to ensure element is sized
  setTimeout(() => drawWaveform(), 100)
  // Redraw on window resize
  window.addEventListener('resize', () => {
    setTimeout(() => drawWaveform(), 0)
  })
})
</script>
