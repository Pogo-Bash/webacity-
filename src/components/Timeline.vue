<template>
  <div class="timeline-container bg-gray-800 border-b border-gray-700">
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

      <!-- Playhead -->
      <div
        class="absolute top-0 bottom-0 w-0.5 bg-red-500"
        :class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
        :style="{ left: playheadPosition + 'px' }"
      >
        <div class="w-3 h-3 bg-red-500 transform -translate-x-1/2 relative top-0" style="clip-path: polygon(50% 0%, 0% 100%, 100% 100%)"></div>
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
</script>

<style scoped>
.timeline-container {
  user-select: none;
}
</style>
