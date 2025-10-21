<template>
  <div class="toolbar bg-gray-800 border-b border-gray-700 px-4 py-3">
    <div class="flex items-center justify-between">
      <!-- Left: Transport Controls -->
      <div class="flex items-center gap-2">
        <button
          @click="stop"
          class="toolbar-button"
          title="Stop"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </button>

        <button
          @click="playPause"
          class="toolbar-button bg-blue-600 hover:bg-blue-700"
          title="Play/Pause"
        >
          <svg v-if="!isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        </button>

        <button
          @click="toggleRecord"
          :class="['toolbar-button', audioStore.isRecording ? 'bg-red-600 animate-pulse' : '']"
          title="Record from Microphone"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
        </button>

        <!-- Recording Level Meter -->
        <div v-if="audioStore.isRecording" class="flex items-center gap-2 px-2">
          <div class="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full bg-red-500 transition-all duration-75"
              :style="{ width: (audioStore.recordingLevel * 100) + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Center: Project Name -->
      <div class="flex items-center gap-2">
        <input
          v-model="projectName"
          class="bg-gray-700 text-white px-3 py-1 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Project Name"
        />
      </div>

      <!-- Right: File Operations -->
      <div class="flex items-center gap-2">
        <button
          @click="importAudio"
          class="toolbar-button"
          title="Import Audio"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </button>

        <button
          @click="exportAudio"
          class="toolbar-button"
          :disabled="!hasAudio"
          title="Export Audio"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </button>

        <button
          @click="addTrack"
          class="toolbar-button"
          title="Add Track"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <!-- Master Volume -->
        <div class="flex items-center gap-2 ml-4">
          <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            v-model.number="masterVolume"
            @input="updateMasterVolume"
            class="w-24"
          />
          <span class="text-xs text-gray-400 w-8">{{ Math.round(masterVolume * 100) }}%</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Hidden file input -->
  <input
    ref="fileInput"
    type="file"
    accept="audio/*"
    @change="handleFileImport"
    class="hidden"
    multiple
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { storeToRefs } from 'pinia'

const audioStore = useAudioStore()
const { isPlaying, projectName, hasAudio } = storeToRefs(audioStore)

const fileInput = ref(null)
const masterVolume = ref(1)

function playPause() {
  if (isPlaying.value) {
    audioStore.pause()
  } else {
    audioStore.play()
  }
}

function stop() {
  audioStore.stop()
}

async function toggleRecord() {
  if (audioStore.isRecording) {
    await audioStore.stopRecording()
  } else {
    try {
      await audioStore.startRecording()
    } catch (error) {
      console.error('Failed to start recording:', error)
      alert('Microphone access denied. Please grant permission to record.')
    }
  }
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

function exportAudio() {
  const selectedTrack = audioStore.selectedTrack
  if (!selectedTrack) {
    alert('Please select a track to export')
    return
  }

  const result = audioStore.exportTrack(selectedTrack.id)
  if (!result) {
    alert('Failed to export track')
    return
  }

  const { blob, filename } = result

  // Create download link
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function addTrack() {
  audioStore.addTrack()
}

function updateMasterVolume() {
  audioStore.setMasterVolume(masterVolume.value)
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

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
