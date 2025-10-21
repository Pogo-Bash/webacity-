<template>
  <teleport to="body">
    <div
      v-if="visible"
      ref="menu"
      class="context-menu fixed bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-[9999] py-1"
      :style="menuPosition"
      @contextmenu.prevent
    >
      <!-- Create Snippet -->
      <button
        v-if="hasSelection"
        @click="handleCreateSnippet"
        class="menu-item"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        <span>Create Snippet from Selection</span>
        <span class="ml-auto text-xs text-gray-500">Ctrl+Shift+S</span>
      </button>

      <div v-if="hasSelection" class="divider"></div>

      <!-- Edit Actions -->
      <button
        v-if="hasSelection"
        @click="handleCut"
        class="menu-item"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
        </svg>
        <span>Cut</span>
        <span class="ml-auto text-xs text-gray-500">Ctrl+X</span>
      </button>

      <button
        v-if="hasSelection"
        @click="handleCopy"
        class="menu-item"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>Copy</span>
        <span class="ml-auto text-xs text-gray-500">Ctrl+C</span>
      </button>

      <button
        v-if="canPaste"
        @click="handlePaste"
        class="menu-item"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Paste</span>
        <span class="ml-auto text-xs text-gray-500">Ctrl+V</span>
      </button>

      <button
        v-if="hasSelection"
        @click="handleDelete"
        class="menu-item text-red-400 hover:bg-red-900"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <span>Delete</span>
        <span class="ml-auto text-xs text-gray-500">Del</span>
      </button>

      <div v-if="hasTrack" class="divider"></div>

      <!-- Track Actions -->
      <button
        v-if="hasTrack"
        @click="handleSelectAll"
        class="menu-item"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span>Select All</span>
        <span class="ml-auto text-xs text-gray-500">Ctrl+A</span>
      </button>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { useHistoryStore } from '../stores/historyStore'
import { DeleteSelectionCommand } from '../utils/commands'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  trackId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close'])

const audioStore = useAudioStore()
const historyStore = useHistoryStore()
const menu = ref(null)

const hasSelection = computed(() => audioStore.hasSelection)
const hasTrack = computed(() => props.trackId !== null)
const canPaste = computed(() => audioStore.clipboard !== null && props.trackId !== null)

const menuPosition = computed(() => {
  if (!menu.value) return { left: props.position.x + 'px', top: props.position.y + 'px' }

  const menuRect = menu.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let { x, y } = props.position

  // Adjust horizontal position if menu goes off right edge
  if (x + menuRect.width > viewportWidth) {
    x = viewportWidth - menuRect.width - 10
  }

  // Adjust vertical position if menu goes off bottom edge
  if (y + menuRect.height > viewportHeight) {
    y = viewportHeight - menuRect.height - 10
  }

  // Ensure menu doesn't go off left edge
  if (x < 10) x = 10

  // Ensure menu doesn't go off top edge
  if (y < 10) y = 10

  return { left: x + 'px', top: y + 'px' }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('contextmenu', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('contextmenu', handleClickOutside)
})

function handleClickOutside(e) {
  if (menu.value && !menu.value.contains(e.target)) {
    emit('close')
  }
}

function handleCreateSnippet() {
  const snippet = audioStore.createSnippetFromSelection()
  if (snippet) {
    console.log('Snippet created from context menu')
  }
  emit('close')
}

function handleCut() {
  if (audioStore.canCut) {
    const command = new DeleteSelectionCommand(audioStore, audioStore.selection.trackId, audioStore.selection)
    if (audioStore.copySelection()) {
      historyStore.execute(command)
    }
  }
  emit('close')
}

function handleCopy() {
  if (audioStore.canCopy) {
    audioStore.copySelection()
  }
  emit('close')
}

function handlePaste() {
  if (audioStore.canPaste && audioStore.clipboard) {
    audioStore.pasteAtPosition(
      props.trackId,
      audioStore.clipboard.buffer,
      audioStore.currentTime
    )
  }
  emit('close')
}

function handleDelete() {
  if (audioStore.hasSelection) {
    const command = new DeleteSelectionCommand(
      audioStore,
      audioStore.selection.trackId,
      audioStore.selection
    )
    historyStore.execute(command)
  }
  emit('close')
}

function handleSelectAll() {
  if (props.trackId) {
    const track = audioStore.tracks.find(t => t.id === props.trackId)
    if (track && track.duration) {
      audioStore.setSelection(props.trackId, 0, track.duration)
    }
  }
  emit('close')
}
</script>

<style scoped>
.context-menu {
  min-width: 220px;
  max-width: 300px;
  backdrop-filter: blur(10px);
  background-color: rgba(31, 41, 55, 0.95);
}

.menu-item {
  @apply w-full px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors flex items-center gap-3 text-left;
}

.menu-item:active {
  @apply bg-gray-600;
}

.divider {
  @apply h-px bg-gray-700 my-1 mx-2;
}
</style>
