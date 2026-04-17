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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
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
// Virtualization: only draw/keep the canvas painted when the clip is near the
// viewport. Initialised from mount via IntersectionObserver.
const isVisible = ref(false)
let intersectionObserver = null

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

// Draw visualization based on view mode
function draw() {
  if (audioStore.viewMode === 'spectrogram') {
    drawSpectrogram()
  } else {
    drawWaveform()
  }
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

// Draw spectrogram
function drawSpectrogram() {
  const canvas = waveformCanvas.value
  if (!canvas || !props.clip.buffer) return

  // Check if analyzer is available
  if (!audioStore.analyzer) {
    console.warn('Analyzer not initialized, falling back to waveform')
    drawWaveform()
    return
  }

  try {
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    // Make sure canvas has valid dimensions
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => drawSpectrogram(), 50)
      return
    }

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Generate spectrogram data
    const spectrogramData = audioStore.analyzer.generateSpectrogram(props.clip.buffer, 512, 256)

    if (!spectrogramData || !spectrogramData.data) {
      console.warn('Failed to generate spectrogram data, falling back to waveform')
      drawWaveform()
      return
    }

    const { data, width, height } = spectrogramData

    // Draw spectrogram
    const cellWidth = rect.width / width
    const cellHeight = rect.height / height

    for (let x = 0; x < width; x++) {
      const spectrum = data[x]
      if (!spectrum) continue

      for (let y = 0; y < height; y++) {
        // Get magnitude (frequency bin value)
        const magnitude = spectrum[y] || 0

        // Convert magnitude to dB scale for better visualization
        const db = 20 * Math.log10(magnitude + 1e-10)
        const normalized = Math.max(0, Math.min(1, (db + 100) / 100))

        // Color gradient: blue -> cyan -> yellow -> red
        let r, g, b
        if (normalized < 0.25) {
          // Blue to cyan
          const t = normalized / 0.25
          r = 0
          g = Math.floor(t * 128)
          b = 255
        } else if (normalized < 0.5) {
          // Cyan to green
          const t = (normalized - 0.25) / 0.25
          r = 0
          g = Math.floor(128 + t * 127)
          b = Math.floor(255 * (1 - t))
        } else if (normalized < 0.75) {
          // Green to yellow
          const t = (normalized - 0.5) / 0.25
          r = Math.floor(t * 255)
          g = 255
          b = 0
        } else {
          // Yellow to red
          const t = (normalized - 0.75) / 0.25
          r = 255
          g = Math.floor(255 * (1 - t))
          b = 0
        }

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`

        // Draw from bottom up (low frequencies at bottom, high at top)
        const drawY = rect.height - (y + 1) * cellHeight
        ctx.fillRect(x * cellWidth, drawY, Math.ceil(cellWidth), Math.ceil(cellHeight))
      }
    }
  } catch (error) {
    console.error('Error drawing spectrogram:', error)
    // Fall back to waveform on error
    drawWaveform()
  }
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

// Watch for changes that require redraw. Only trigger while the clip is
// actually on-screen - off-screen clips repaint when they scroll back in.
watch(
  () => props.clip,
  () => {
    if (isVisible.value) setTimeout(() => draw(), 0)
  },
  { deep: true }
)

watch(
  () => props.projectDuration,
  () => {
    if (isVisible.value) setTimeout(() => draw(), 0)
  }
)

watch(
  () => audioStore.viewMode,
  () => {
    if (isVisible.value) setTimeout(() => draw(), 0)
  }
)

function onResize() {
  if (isVisible.value) setTimeout(() => draw(), 0)
}

onMounted(() => {
  if (typeof IntersectionObserver !== 'undefined' && clipElement.value) {
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!isVisible.value) {
            isVisible.value = true
            setTimeout(() => draw(), 0)
          }
        } else if (isVisible.value) {
          isVisible.value = false
          // Free GPU-backed canvas memory when scrolled far out of view.
          const canvas = waveformCanvas.value
          if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
          }
        }
      }
    }, { rootMargin: '200px' })
    intersectionObserver.observe(clipElement.value)
  } else {
    // Fallback for environments without IntersectionObserver.
    isVisible.value = true
    setTimeout(() => draw(), 100)
  }

  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
  window.removeEventListener('resize', onResize)
})
</script>
