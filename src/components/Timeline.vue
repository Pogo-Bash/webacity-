<template>
  <div class="timeline-container bg-gray-800 border-b border-gray-700 px-4">
    <!-- Ruler -->
    <div
      class="relative h-8 bg-gray-900 cursor-pointer"
      ref="ruler"
      @mousedown="startDrag"
      @mousemove="drag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
    >
      <canvas ref="rulerCanvas" class="w-full h-full"></canvas>

      <!-- Playhead Scissor Icon -->
      <div
        class="absolute top-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors z-10"
        :style="{ left: (playheadPosition - 12) + 'px' }"
        @click="sliceAtPlayhead"
        title="Click to slice audio at playhead position"
      >
        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9.64,7.64c.23-.5.36-1.05.36-1.64,0-2.21-1.79-4-4-4S2,3.79,2,6s1.79,4,4,4c.59,0,1.14-.13,1.64-.36L10,12l-2.36,2.36c-.5-.23-1.05-.36-1.64-.36-2.21,0-4,1.79-4,4s1.79,4,4,4s4-1.79,4-4c0-.59-.13-1.14-.36-1.64L12,14l7,7h3v-1L9.64,7.64z M6,8c-1.1,0-2-.89-2-2s.9-2,2-2s2,.89,2,2S7.1,8,6,8z M6,20c-1.1,0-2-.89-2-2s.9-2,2-2s2,.89,2,2S7.1,20,6,20z M12,12.5c-.28,0-.5-.22-.5-.5s.22-.5.5-.5s.5.22.5.5S12.28,12.5,12,12.5z M19,3l-6,6l2,2l7-7V3H19z"/>
        </svg>
      </div>
    </div>

    <!-- Time Display -->
    <div class="flex items-center justify-between px-4 py-2 bg-gray-800 text-xs text-gray-400">
      <div>
        Position: <span class="text-white font-mono">{{ formatTime(currentTime) }}</span>
      </div>
      <div>
        Duration: <span class="text-white font-mono">{{ formatTime(duration) }}</span>
      </div>
      <div>
        Sample Rate: <span class="text-white">{{ sampleRate }} Hz</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { storeToRefs } from 'pinia'

const audioStore = useAudioStore()
const { currentTime, duration, sampleRate } = storeToRefs(audioStore)

const ruler = ref(null)
const rulerCanvas = ref(null)
const isDragging = ref(false)

const playheadPosition = computed(() => {
  if (!ruler.value || duration.value === 0) return 0
  const width = ruler.value.offsetWidth
  return (currentTime.value / duration.value) * width
})

onMounted(() => {
  drawRuler()
  window.addEventListener('resize', drawRuler)

  // Update playhead position periodically when playing
  setInterval(() => {
    if (audioStore.isPlaying) {
      // Increment current time (this is simplified - in production you'd sync with actual playback)
      audioStore.currentTime = Math.min(
        audioStore.currentTime + 0.1,
        audioStore.duration
      )

      if (audioStore.currentTime >= audioStore.duration) {
        audioStore.stop()
      }
    }
  }, 100)
})

watch(duration, () => {
  drawRuler()
})

function drawRuler() {
  const canvas = rulerCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  ctx.scale(dpr, dpr)

  // Clear
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, rect.width, rect.height)

  if (duration.value === 0) return

  // Draw time markers
  ctx.strokeStyle = '#4b5563'
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'

  const totalSeconds = Math.ceil(duration.value)
  const interval = getTimeInterval(totalSeconds)
  const pixelsPerSecond = rect.width / duration.value

  for (let time = 0; time <= totalSeconds; time += interval) {
    const x = time * pixelsPerSecond

    // Draw tick
    const tickHeight = time % (interval * 5) === 0 ? 12 : 6
    ctx.beginPath()
    ctx.moveTo(x, rect.height)
    ctx.lineTo(x, rect.height - tickHeight)
    ctx.stroke()

    // Draw label for major ticks
    if (time % (interval * 5) === 0) {
      ctx.fillText(formatTime(time), x, 10)
    }
  }
}

function getTimeInterval(totalSeconds) {
  if (totalSeconds <= 10) return 1
  if (totalSeconds <= 60) return 5
  if (totalSeconds <= 300) return 10
  if (totalSeconds <= 600) return 30
  return 60
}

function startDrag(e) {
  if (!ruler.value || duration.value === 0) return
  isDragging.value = true
  seekToMouse(e)
}

function drag(e) {
  if (!isDragging.value) return
  seekToMouse(e)
}

function endDrag() {
  isDragging.value = false
}

function seekToMouse(e) {
  if (!ruler.value || duration.value === 0) return

  const rect = ruler.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const ratio = x / rect.width
  const time = ratio * duration.value

  audioStore.seek(time)
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
}

function sliceAtPlayhead() {
  const sliceTime = audioStore.currentTime
  if (sliceTime <= 0) {
    console.log('Invalid slice position')
    return
  }

  const sliceCount = audioStore.sliceAtPlayhead(sliceTime)

  if (sliceCount === 0) {
    console.log('No tracks selected for slicing or no clips at playhead position')
  }
}
</script>

<style scoped>
.timeline-container {
  user-select: none;
}
</style>
