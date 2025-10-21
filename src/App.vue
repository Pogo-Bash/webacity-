<template>
  <div class="app-container h-screen w-screen flex flex-col bg-darker text-gray-100">
    <!-- Menu Bar -->
    <MenuBar
      @import="importAudio"
      @export="exportProject"
      @toggle-effects="showEffects = !showEffects"
      @toggle-generator="showGenerator = !showGenerator"
      @toggle-snippets="showSnippets = !showSnippets"
      @toggle-stem-separation="showStemSeparation = !showStemSeparation"
      @play-pause="handlePlayPause"
      @stop="audioStore.stop()"
      @record="handleRecord"
    />

    <!-- Toolbar with Playback Controls -->
    <Toolbar
      @toggle-effects="showEffects = !showEffects"
      @toggle-generator="showGenerator = !showGenerator"
      @toggle-stem-separation="showStemSeparation = !showStemSeparation"
      @toggle-settings="showSettings = !showSettings"
    />

    <!-- Timeline -->
    <Timeline ref="timeline" />

    <!-- Main Content Area -->
    <main class="flex-1 overflow-y-auto p-4 relative" ref="mainContent">
      <!-- Global Playhead -->
      <div
        v-if="tracks.length > 0 && duration > 0"
        class="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-50"
        :style="{ left: mainPlayheadPosition + 'px' }"
      ></div>

      <!-- Tracks -->
      <div v-if="tracks.length > 0" class="space-y-4">
        <Track
          v-for="track in tracks"
          :key="track.id"
          :track="track"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="mb-4">
            <svg class="w-24 h-24 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h2 class="text-xl text-gray-400 mb-2">No tracks yet</h2>
          <p class="text-gray-500 mb-4">Import an audio file or create a new track to get started</p>
          <div class="flex gap-3 justify-center">
            <button
              @click="importAudio"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Import Audio
            </button>
            <button
              @click="addTrack"
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Add Empty Track
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Effects Panel -->
    <EffectPanel :visible="showEffects" @close="showEffects = false" />

    <!-- Generator Panel -->
    <GeneratorPanel :visible="showGenerator" @close="showGenerator = false" />

    <!-- Stem Separation Panel -->
    <StemSeparationPanel :visible="showStemSeparation" @close="showStemSeparation = false" />

    <!-- Settings Panel -->
    <SettingsPanel :visible="showSettings" @close="showSettings = false" />

    <!-- Footer -->
    <footer class="bg-gray-900 border-t border-gray-700 px-6 py-2 text-xs text-gray-500">
      <div class="flex items-center justify-between">
        <div>
          Tracks: {{ tracks.length }} | Selected: {{ selectedTrack?.name || 'None' }}
          <span v-if="audioStore.selection" class="ml-2 text-blue-400">
            | Selection: {{ audioStore.selection.startTime.toFixed(2) }}s - {{ audioStore.selection.endTime.toFixed(2) }}s
          </span>
        </div>
        <div class="flex gap-4">
          <span>Space: Play/Pause</span>
          <span>Ctrl+Z/Y: Undo/Redo</span>
          <span>Ctrl+X/C/V: Cut/Copy/Paste</span>
          <span>Ctrl+E/G: Effects/Generate</span>
          <span>Del: Delete</span>
        </div>
      </div>
    </footer>

    <!-- Hidden file input for import -->
    <input
      ref="fileInput"
      type="file"
      accept="audio/*"
      @change="handleFileImport"
      class="hidden"
      multiple
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAudioStore } from './stores/audioStore'
import { useHistoryStore } from './stores/historyStore'
import { DeleteSelectionCommand } from './utils/commands'
import { storeToRefs } from 'pinia'
import { AutosaveService } from './services/autosave'
import MenuBar from './components/MenuBar.vue'
import Toolbar from './components/Toolbar.vue'
import Timeline from './components/Timeline.vue'
import Track from './components/Track.vue'
import EffectPanel from './components/EffectPanel.vue'
import GeneratorPanel from './components/GeneratorPanel.vue'
import StemSeparationPanel from './components/StemSeparationPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const audioStore = useAudioStore()
const historyStore = useHistoryStore()
const { tracks, selectedTrack, currentTime, duration } = storeToRefs(audioStore)

const mainContent = ref(null)
const timeline = ref(null)

const showEffects = ref(false)
const showGenerator = ref(false)
const showStemSeparation = ref(false)
const showSettings = ref(false)
const showSnippets = ref(false)
const fileInput = ref(null)

// Initialize autosave service
let autosaveService = null

// Calculate playhead position based on timeline ruler
const mainPlayheadPosition = computed(() => {
  // Use refs from storeToRefs for reactivity
  const time = currentTime.value
  const dur = duration.value

  if (!timeline.value || dur === 0) return 0

  // Get the ruler element from Timeline component
  const timelineEl = timeline.value.$el
  if (!timelineEl) return 0

  const rulerEl = timelineEl.querySelector('.relative.h-8')
  if (!rulerEl) return 0

  // Calculate position the same way as Timeline component
  const rulerWidth = rulerEl.offsetWidth
  const ratio = time / dur
  const positionInRuler = ratio * rulerWidth

  // Get the absolute left position of the ruler
  const rulerRect = rulerEl.getBoundingClientRect()
  const mainContentRect = mainContent.value?.getBoundingClientRect()

  if (!mainContentRect) return 0

  // Calculate relative position within main content
  const relativeLeft = rulerRect.left - mainContentRect.left

  return relativeLeft + positionInRuler
})

onMounted(async () => {
  // Initialize audio engine
  try {
    await audioStore.init()
  } catch (error) {
    console.error('Failed to initialize audio engine:', error)
  }

  // Initialize autosave
  autosaveService = new AutosaveService(audioStore)
  autosaveService.start()

  // Keyboard shortcuts
  window.addEventListener('keydown', handleKeyDown)

  // Warn before closing if there are unsaved changes
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('beforeunload', handleBeforeUnload)

  // Stop autosave
  if (autosaveService) {
    autosaveService.stop()
  }
})

// Watch for changes to mark autosave as dirty
watch([tracks, () => audioStore.masterVolume, () => audioStore.projectName], () => {
  if (autosaveService) {
    autosaveService.markChanged()
  }
}, { deep: true })

function handleBeforeUnload(e) {
  if (autosaveService && autosaveService.hasUnsavedChanges) {
    const message = autosaveService.getUnsavedWarning()
    if (message) {
      e.preventDefault()
      e.returnValue = message
      return message
    }
  }
}

function handleKeyDown(e) {
  // Ignore if typing in input field
  if (isTyping(e)) return

  // Spacebar: Play/Pause
  if (e.code === 'Space') {
    e.preventDefault()
    if (audioStore.isPlaying) {
      audioStore.pause()
    } else {
      audioStore.play()
    }
  }

  // Ctrl/Cmd + Z: Undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (historyStore.canUndo) {
      historyStore.undo()
      console.log('Undo')
    }
  }

  // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    if (historyStore.canRedo) {
      historyStore.redo()
      console.log('Redo')
    }
  }

  // Ctrl/Cmd + X: Cut
  if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
    e.preventDefault()
    if (audioStore.canCut) {
      audioStore.cutClip()
      console.log('Cut clip')
    }
  }

  // Ctrl/Cmd + C: Copy
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault()
    if (audioStore.canCopy) {
      audioStore.copyClip()
      console.log('Copied clip')
    }
  }

  // Ctrl/Cmd + V: Paste
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault()
    if (audioStore.canPaste) {
      audioStore.pasteClip()
      console.log('Pasted clip')
    }
  }

  // Ctrl/Cmd + A: Select All
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    if (selectedTrack.value && selectedTrack.value.duration) {
      audioStore.setSelection(selectedTrack.value.id, 0, selectedTrack.value.duration)
      console.log('Selected all')
    }
  }

  // Escape: Clear selection
  if (e.key === 'Escape') {
    e.preventDefault()
    audioStore.clearSelection()
    console.log('Selection cleared')
  }

  // Delete or Backspace: Delete clip
  if ((e.key === 'Delete' || e.key === 'Backspace') && audioStore.selectedClipId) {
    e.preventDefault()
    audioStore.deleteClip()
    console.log('Deleted clip')
  }

  // Ctrl/Cmd + I: Import
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault()
    importAudio()
  }

  // Ctrl/Cmd + E: Toggle Effects
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault()
    showEffects.value = !showEffects.value
  }

  // Ctrl/Cmd + G: Toggle Generator
  if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
    e.preventDefault()
    showGenerator.value = !showGenerator.value
  }

  // Ctrl/Cmd + S: Toggle Snippets
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    showSnippets.value = !showSnippets.value
  }
}

function isTyping(e) {
  const target = e.target
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function importAudio() {
  fileInput.value?.click()
}

async function handleFileImport(event) {
  const files = event.target.files
  if (!files || files.length === 0) return

  try {
    for (const file of files) {
      await audioStore.loadAudioFile(file)
    }
  } catch (error) {
    console.error('Failed to import audio:', error)
    alert('Failed to import audio file. Please try again.')
  }

  // Reset file input
  event.target.value = ''
}

function addTrack() {
  audioStore.addTrack()
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

function handlePlayPause() {
  if (audioStore.isPlaying) {
    audioStore.pause()
  } else {
    audioStore.play()
  }
}

function handleRecord() {
  if (audioStore.isRecording) {
    audioStore.stopRecording()
  } else {
    audioStore.startRecording()
  }
}

function exportProject() {
  // Export the project as WAV
  if (!audioStore.hasAudio) {
    alert('No audio to export')
    return
  }
  audioStore.exportProject()
}
</script>

<style>
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
