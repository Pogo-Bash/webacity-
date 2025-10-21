<template>
  <div class="menu-bar">
    <!-- Logo/Title -->
    <div class="logo">
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
      <span class="logo-text">{{ projectName }}</span>
    </div>

    <!-- Hamburger Button -->
    <button
      @click="toggleMenu"
      class="hamburger-btn"
      :class="{ active: menuOpen }"
      title="Menu"
    >
      <div class="hamburger-icon">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </button>

    <!-- Dropdown Menu -->
    <transition name="menu">
      <div v-if="menuOpen" class="menu-dropdown" @click.stop>
        <!-- File Section -->
        <div class="menu-section">
          <div class="section-title">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            File
          </div>
          <button @click="handleNewProject" class="menu-item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>New Project</span>
          </button>
          <button @click="handleImport" class="menu-item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span>Import Audio</span>
            <kbd>Ctrl+I</kbd>
          </button>
          <button @click="handleExport" class="menu-item" :disabled="!hasAudio">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export</span>
          </button>
        </div>

        <!-- Edit Section -->
        <div class="menu-section">
          <div class="section-title">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </div>
          <button @click="handleUndo" class="menu-item" :disabled="!canUndo">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>Undo</span>
            <kbd>Ctrl+Z</kbd>
          </button>
          <button @click="handleRedo" class="menu-item" :disabled="!canRedo">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
            <span>Redo</span>
            <kbd>Ctrl+Y</kbd>
          </button>
          <button @click="handleCut" class="menu-item" :disabled="!canCut">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
            <span>Cut</span>
            <kbd>Ctrl+X</kbd>
          </button>
          <button @click="handleCopy" class="menu-item" :disabled="!canCopy">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Copy</span>
            <kbd>Ctrl+C</kbd>
          </button>
          <button @click="handlePaste" class="menu-item" :disabled="!canPaste">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Paste</span>
            <kbd>Ctrl+V</kbd>
          </button>
          <button @click="handleDelete" class="menu-item" :disabled="!canDelete">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete</span>
            <kbd>Del</kbd>
          </button>
          <button @click="handleRemoveGaps" class="menu-item" :disabled="!hasAudio">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            <span>Remove Gaps</span>
          </button>
        </div>

        <!-- Track Section -->
        <div class="menu-section">
          <div class="section-title">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Track
          </div>
          <button @click="handleAddTrack" class="menu-item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Track</span>
          </button>
        </div>

        <!-- Tools Section -->
        <div class="menu-section">
          <div class="section-title">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Tools
          </div>
          <button @click="handleToggleEffects" class="menu-item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span>Effects</span>
            <kbd>Ctrl+E</kbd>
          </button>
          <button @click="handleToggleGenerator" class="menu-item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Generator</span>
            <kbd>Ctrl+G</kbd>
          </button>
          <button @click="handleToggleSnippets" class="menu-item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Snippets</span>
            <kbd>Ctrl+S</kbd>
          </button>
          <button @click="handleToggleStemSeparation" class="menu-item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span>Stem Separation</span>
          </button>
        </div>

        <!-- Playback Section -->
        <div class="menu-section">
          <div class="section-title">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Playback
          </div>
          <button @click="handlePlayPause" class="menu-item">
            <svg v-if="!isPlaying" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ isPlaying ? 'Pause' : 'Play' }}</span>
            <kbd>Space</kbd>
          </button>
          <button @click="handleStop" class="menu-item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            <span>Stop</span>
          </button>
          <button @click="handleRecord" class="menu-item" :class="{ recording: isRecording }">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" />
            </svg>
            <span>{{ isRecording ? 'Stop Recording' : 'Record' }}</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- Overlay to close menu when clicking outside -->
    <div
      v-if="menuOpen"
      class="menu-overlay"
      @click="menuOpen = false"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAudioStore } from '../stores/audioStore'
import { useHistoryStore } from '../stores/historyStore'

const audioStore = useAudioStore()
const historyStore = useHistoryStore()

const {
  isPlaying,
  isRecording,
  hasAudio,
  canUndo,
  canRedo,
  canCut,
  canCopy,
  canPaste,
  canDelete,
  projectName
} = storeToRefs(audioStore)

const menuOpen = ref(false)

const emit = defineEmits([
  'import',
  'export',
  'toggle-effects',
  'toggle-generator',
  'toggle-snippets',
  'toggle-stem-separation',
  'play-pause',
  'stop',
  'record'
])

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function handleNewProject() {
  audioStore.newProject()
  closeMenu()
}

function handleImport() {
  emit('import')
  closeMenu()
}

function handleExport() {
  emit('export')
  closeMenu()
}

function handleUndo() {
  historyStore.undo()
  closeMenu()
}

function handleRedo() {
  historyStore.redo()
  closeMenu()
}

function handleCut() {
  audioStore.cutClip()
  closeMenu()
}

function handleCopy() {
  audioStore.copyClip()
  closeMenu()
}

function handlePaste() {
  audioStore.pasteClip()
  closeMenu()
}

function handleDelete() {
  audioStore.deleteClip(audioStore.selectedClipId)
  closeMenu()
}

function handleRemoveGaps() {
  const count = audioStore.removeGaps()
  if (count > 0) {
    console.log(`✅ Removed gaps: ${count} clips repositioned`)
  }
  closeMenu()
}

function handleAddTrack() {
  audioStore.addTrack()
  closeMenu()
}

function handleToggleEffects() {
  emit('toggle-effects')
  closeMenu()
}

function handleToggleGenerator() {
  emit('toggle-generator')
  closeMenu()
}

function handleToggleSnippets() {
  emit('toggle-snippets')
  closeMenu()
}

function handleToggleStemSeparation() {
  emit('toggle-stem-separation')
  closeMenu()
}

function handlePlayPause() {
  emit('play-pause')
  closeMenu()
}

function handleStop() {
  emit('stop')
  closeMenu()
}

function handleRecord() {
  emit('record')
  closeMenu()
}
</script>

<style scoped>
.menu-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 1000;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.logo svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.logo-text {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hamburger-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.hamburger-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.hamburger-btn.active {
  background: rgba(255, 255, 255, 0.3);
}

.hamburger-icon {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 24px;
}

.hamburger-icon span {
  display: block;
  width: 100%;
  height: 3px;
  background: white;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.hamburger-btn.active .hamburger-icon span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.hamburger-btn.active .hamburger-icon span:nth-child(2) {
  opacity: 0;
}

.hamburger-btn.active .hamburger-icon span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 998;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 1.5rem;
  background: #1f2937;
  border-radius: 0.75rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  min-width: 280px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  z-index: 999;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.menu-section {
  padding: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.menu-section:last-child {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.menu-item:hover:not(:disabled) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transform: translateX(4px);
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-item svg {
  flex-shrink: 0;
}

.menu-item span {
  flex: 1;
  text-align: left;
}

.menu-item kbd {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: monospace;
}

.menu-item.recording {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Menu transitions */
.menu-enter-active,
.menu-leave-active {
  transition: all 0.3s ease;
}

.menu-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.menu-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Scrollbar styling */
.menu-dropdown::-webkit-scrollbar {
  width: 8px;
}

.menu-dropdown::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
}

.menu-dropdown::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
}

.menu-dropdown::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Utility classes */
.w-4 { width: 1rem; height: 1rem; }
.w-5 { width: 1.25rem; height: 1.25rem; }
.w-6 { width: 1.5rem; height: 1.5rem; }
.h-4 { height: 1rem; }
.h-5 { height: 1.25rem; }
.h-6 { height: 1.5rem; }
</style>
