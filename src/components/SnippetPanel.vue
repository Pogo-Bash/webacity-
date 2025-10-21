<template>
  <div v-if="visible" class="snippet-panel-container fixed left-4 top-20 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto bg-gray-800 rounded-lg shadow-2xl z-50">
    <div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
      <h3 class="text-white font-semibold flex items-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z"/>
        </svg>
        Snippets
      </h3>
      <button @click="$emit('close')" class="text-gray-400 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="p-4">
      <!-- Create Snippet Button -->
      <button
        v-if="audioStore.hasSelection"
        @click="createSnippet"
        class="w-full mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center justify-center gap-2"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        Create Snippet from Selection
      </button>

      <!-- No Selection Message -->
      <div v-else class="mb-4 p-3 bg-gray-700 rounded text-sm text-gray-400 text-center">
        Select a region on a track to create a snippet
      </div>

      <!-- Snippets List -->
      <div v-if="audioStore.snippets.length > 0" class="space-y-2">
        <div
          v-for="snippet in audioStore.snippets"
          :key="snippet.id"
          :draggable="true"
          @dragstart="handleDragStart(snippet, $event)"
          @dragend="handleDragEnd"
          class="snippet-item bg-gray-700 rounded p-3 cursor-move hover:bg-gray-600 transition-colors border-2 border-transparent hover:border-blue-500"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-white text-sm font-medium">{{ snippet.name }}</span>
            <button
              @click="removeSnippet(snippet.id)"
              class="text-gray-400 hover:text-red-400"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>

          <!-- Mini Waveform -->
          <div class="relative w-full h-12 bg-gray-800 rounded overflow-hidden">
            <canvas
              :ref="el => { if (el) snippetCanvases[snippet.id] = el }"
              class="h-full bg-gray-850"
              :style="{ width: getSnippetWidth(snippet) }"
            ></canvas>
          </div>

          <div class="mt-2 text-xs text-gray-400">
            Duration: {{ snippet.duration.toFixed(2) }}s
            <span v-if="audioStore.duration > 0" class="ml-2 text-gray-500">
              ({{ ((snippet.duration / audioStore.duration) * 100).toFixed(1) }}% of project)
            </span>
          </div>

          <div class="mt-2 text-xs text-gray-500 italic">
            Drag to track to place
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <svg class="w-16 h-16 mx-auto text-gray-600 mb-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
        </svg>
        <p class="text-gray-500 text-sm">No snippets yet</p>
        <p class="text-gray-600 text-xs mt-1">Create snippets from audio selections</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useAudioStore } from '../stores/audioStore'

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const audioStore = useAudioStore()
const snippetCanvases = ref({})

function createSnippet() {
  const snippet = audioStore.createSnippetFromSelection()
  if (snippet) {
    console.log('Snippet created:', snippet.name)
    // Draw waveform for new snippet
    nextTick(() => {
      drawSnippetWaveform(snippet)
    })
  }
}

function removeSnippet(snippetId) {
  if (confirm('Remove this snippet?')) {
    audioStore.removeSnippet(snippetId)
  }
}

function getSnippetWidth(snippet) {
  // Scale snippet width based on its duration relative to the longest track
  const projectDuration = audioStore.duration || 1
  const ratio = snippet.duration / projectDuration
  const minWidth = 20 // Minimum width in pixels
  const maxWidth = 100 // Maximum width percentage

  // Calculate width as percentage, ensuring it's at least visible
  const widthPercent = Math.max(minWidth, Math.min(ratio * 100, maxWidth))
  return `${widthPercent}%`
}

function handleDragStart(snippet, event) {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/snippet-id', snippet.id)
  event.target.classList.add('opacity-50')
}

function handleDragEnd(event) {
  event.target.classList.remove('opacity-50')
}

function drawSnippetWaveform(snippet) {
  const canvas = snippetCanvases.value[snippet.id]
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const width = canvas.clientWidth
  const height = canvas.clientHeight

  canvas.width = width
  canvas.height = height

  // Clear canvas
  ctx.fillStyle = '#1f2937'
  ctx.fillRect(0, 0, width, height)

  if (!snippet.waveformData || snippet.waveformData.length === 0) return

  // Draw waveform
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1
  ctx.beginPath()

  const step = width / snippet.waveformData.length
  const centerY = height / 2

  snippet.waveformData.forEach((point, i) => {
    const x = i * step
    const yMin = centerY + (point.min * centerY)
    const yMax = centerY + (point.max * centerY)

    if (i === 0) {
      ctx.moveTo(x, yMin)
    }
    ctx.lineTo(x, yMin)
    ctx.lineTo(x, yMax)
  })

  ctx.stroke()
}

// Watch for snippet changes and redraw waveforms
watch(() => audioStore.snippets, () => {
  nextTick(() => {
    audioStore.snippets.forEach(snippet => {
      drawSnippetWaveform(snippet)
    })
  })
}, { deep: true })

// Draw waveforms on mount
onMounted(() => {
  nextTick(() => {
    audioStore.snippets.forEach(snippet => {
      drawSnippetWaveform(snippet)
    })
  })
})
</script>

<style scoped>
.snippet-item {
  user-select: none;
}

.snippet-item:active {
  cursor: grabbing;
}
</style>
