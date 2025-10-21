<template>
  <div class="app-container h-screen w-screen flex flex-col bg-darker text-gray-100">
    <!-- Header -->
    <header class="bg-gray-900 border-b border-gray-700 px-6 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold text-white">Webacity</h1>
          <span class="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">Web Audio Editor</span>
        </div>
        <div class="text-xs text-gray-500">
          A modern, web-based audio editor powered by WASM
        </div>
      </div>
    </header>

    <!-- Toolbar -->
    <Toolbar @toggle-effects="showEffects = !showEffects" />

    <!-- Timeline -->
    <Timeline />

    <!-- Main Content Area -->
    <main class="flex-1 overflow-y-auto p-4">
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

    <!-- Footer -->
    <footer class="bg-gray-900 border-t border-gray-700 px-6 py-2 text-xs text-gray-500">
      <div class="flex items-center justify-between">
        <div>
          Tracks: {{ tracks.length }} | Selected: {{ selectedTrack?.name || 'None' }}
        </div>
        <div>
          Press Spacebar to play/pause | Import audio files to start editing
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useAudioStore } from './stores/audioStore'
import { storeToRefs } from 'pinia'
import Toolbar from './components/Toolbar.vue'
import Timeline from './components/Timeline.vue'
import Track from './components/Track.vue'
import EffectPanel from './components/EffectPanel.vue'

const audioStore = useAudioStore()
const { tracks, selectedTrack } = storeToRefs(audioStore)

const showEffects = ref(false)
const fileInput = ref(null)

onMounted(async () => {
  // Initialize audio engine
  try {
    await audioStore.init()
  } catch (error) {
    console.error('Failed to initialize audio engine:', error)
  }

  // Keyboard shortcuts
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

function handleKeyDown(e) {
  // Spacebar: Play/Pause
  if (e.code === 'Space' && !isTyping(e)) {
    e.preventDefault()
    if (audioStore.isPlaying) {
      audioStore.pause()
    } else {
      audioStore.play()
    }
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

  // Delete: Remove selected track
  if (e.key === 'Delete' && selectedTrack.value) {
    if (confirm(`Delete track "${selectedTrack.value.name}"?`)) {
      audioStore.removeTrack(selectedTrack.value.id)
    }
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
