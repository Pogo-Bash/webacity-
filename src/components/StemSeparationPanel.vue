<template>
  <div v-if="visible" class="stem-panel-container fixed right-4 top-20 w-96 max-h-[calc(100vh-6rem)] overflow-y-auto bg-gray-800 rounded-lg shadow-2xl z-50">
    <!-- Header -->
    <div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <h3 class="text-white font-semibold">AI Stem Separation</h3>
      </div>
      <button @click="$emit('close')" class="text-gray-400 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-4">
      <!-- API Key Section -->
      <div class="api-key-section p-3 rounded-lg bg-gray-900 border border-gray-700">
        <div v-if="!apiKeyConfigured" class="space-y-3">
          <div class="flex items-start gap-2 text-yellow-400 text-sm">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>No API key configured</span>
          </div>
          <div class="flex gap-2">
            <a
              href="https://mvsep.com"
              target="_blank"
              class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors text-center"
            >
              Get API Key
            </a>
            <button
              @click="showApiKeyModal = true"
              class="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              Enter API Key
            </button>
          </div>
        </div>

        <div v-else class="space-y-2">
          <div class="flex items-center gap-2 text-green-400 text-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>API Key Valid</span>
          </div>

          <div v-if="userInfo" class="text-xs text-gray-400 space-y-1">
            <div>Credits: <span class="text-white font-medium">{{ userInfo.premium_minutes || 0 }} minutes</span></div>
            <div v-if="userInfo.current_queue">Queue: <span class="text-white">{{ userInfo.current_queue }} jobs</span></div>
          </div>

          <button
            @click="showApiKeyModal = true"
            class="w-full px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
          >
            Change API Key
          </button>
        </div>
      </div>

      <!-- Track Info -->
      <div v-if="!selectedTrack" class="p-4 text-gray-400 text-sm text-center">
        Select a track to separate stems
      </div>

      <div v-else class="space-y-4">
        <!-- Track Selection Info -->
        <div class="track-info p-3 rounded-lg bg-gray-900 border border-gray-700">
          <div class="text-xs text-gray-400">Track:</div>
          <div class="text-white font-medium truncate">{{ selectedTrack.name }}</div>
          <div class="text-xs text-gray-400 mt-1">
            Duration: {{ formatDuration(selectedTrack.duration) }}
          </div>
        </div>

        <!-- Separation Type Selection -->
        <div class="space-y-2">
          <label class="text-sm text-gray-300 font-medium">Separation Type:</label>
          <div class="space-y-2">
            <label
              v-for="(preset, key) in SEPARATION_PRESETS"
              :key="key"
              class="preset-option flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all"
              :class="{
                'bg-blue-900/30 border-blue-500': selectedPreset === key,
                'bg-gray-900 border-gray-700 hover:bg-gray-700': selectedPreset !== key
              }"
            >
              <input
                type="radio"
                :value="key"
                v-model="selectedPreset"
                class="mt-1"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm text-white font-medium">{{ preset.name }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ preset.description }}</div>
                <div class="text-xs text-blue-400 mt-1">
                  ~{{ estimatedCost(key) }} credits
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Output Format -->
        <div class="space-y-2">
          <label class="text-sm text-gray-300 font-medium">Output Format:</label>
          <select
            v-model="outputFormat"
            class="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option v-for="(format, key) in OUTPUT_FORMATS" :key="key" :value="format.id">
              {{ format.name }}
            </option>
          </select>
        </div>

        <!-- Cost Estimate & Warnings -->
        <div class="space-y-2">
          <div class="p-3 rounded-lg bg-blue-900/20 border border-blue-700">
            <div class="flex items-start gap-2 text-blue-300 text-sm">
              <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div>This will use approximately <strong>{{ currentEstimatedCost }}</strong> credits</div>
                <div class="text-xs text-blue-400 mt-1">≈ ${{ (currentEstimatedCost * 0.10).toFixed(2) }}</div>
              </div>
            </div>
          </div>

          <div v-if="hasInsufficientCredits" class="p-3 rounded-lg bg-red-900/20 border border-red-700">
            <div class="flex items-start gap-2 text-red-300 text-sm">
              <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div class="font-medium">Insufficient credits!</div>
                <div class="text-xs text-red-400 mt-1">
                  Need {{ currentEstimatedCost }} credits, have {{ userInfo?.premium_minutes || 0 }}
                </div>
                <a
                  href="https://mvsep.com/pricing"
                  target="_blank"
                  class="inline-block mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                >
                  Buy Credits
                </a>
              </div>
            </div>
          </div>

          <div v-else-if="hasLowCredits" class="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700">
            <div class="flex items-start gap-2 text-yellow-300 text-sm">
              <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>Low credits! Only {{ userInfo?.premium_minutes || 0 }} minutes left</div>
            </div>
          </div>
        </div>

        <!-- Separation Button -->
        <button
          @click="startSeparation"
          :disabled="!canStartSeparation || processing"
          class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          <span v-if="!processing">🎵 Separate Stems</span>
          <span v-else>⏳ Processing...</span>
        </button>

        <!-- Progress Section -->
        <div v-if="processing" class="progress-section p-4 rounded-lg bg-gray-900 border border-blue-500">
          <div class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-300">{{ progressData.message || 'Processing...' }}</span>
              <span class="text-blue-400">{{ progressData.progress || 0 }}%</span>
            </div>

            <div class="progress-bar w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-blue-500 transition-all duration-300"
                :style="{ width: (progressData.progress || 0) + '%' }"
              ></div>
            </div>

            <div v-if="progressData.queuePosition" class="text-xs text-gray-400">
              Queue position: {{ progressData.queuePosition }}/{{ progressData.queueCount }}
            </div>
          </div>
        </div>

        <!-- Results Section -->
        <div v-if="results && results.length > 0" class="results-section space-y-3">
          <div class="flex items-center gap-2 text-green-400 text-sm font-medium">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Separation Complete!</span>
          </div>

          <div class="space-y-2">
            <div
              v-for="(stem, index) in results"
              :key="index"
              class="stem-result p-3 rounded-lg bg-gray-900 border border-gray-700"
            >
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="text-white font-medium text-sm">{{ stem.name }}</div>
                  <div class="text-xs text-gray-400 mt-0.5">{{ formatFileSize(stem.size) }}</div>

                  <div class="flex gap-2 mt-2">
                    <button
                      @click="previewStem(stem)"
                      class="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                    >
                      ▶ Preview
                    </button>
                    <button
                      @click="downloadStem(stem)"
                      class="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                    >
                      ⬇ Download
                    </button>
                    <button
                      @click="addStemToTrack(stem)"
                      :disabled="addingToTrack === stem.url"
                      class="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                    >
                      {{ addingToTrack === stem.url ? '...' : '➕ Add' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- API Key Modal -->
    <div v-if="showApiKeyModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" @click.self="showApiKeyModal = false">
      <div class="bg-gray-800 rounded-lg p-6 w-96 max-w-[90vw]">
        <h3 class="text-white font-semibold text-lg mb-4">Enter MVSep API Key</h3>

        <p class="text-gray-400 text-sm mb-4">
          Get your API key from <a href="https://mvsep.com" target="_blank" class="text-blue-400 hover:text-blue-300">mvsep.com</a>
        </p>

        <input
          v-model="apiKeyInput"
          type="password"
          placeholder="Enter API key..."
          class="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500 mb-4"
          @keyup.enter="validateAndSaveApiKey"
        />

        <div v-if="apiKeyError" class="mb-4 p-3 rounded bg-red-900/20 border border-red-700">
          <div class="flex items-start gap-2 text-red-300 text-sm">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ apiKeyError }}</span>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="validateAndSaveApiKey"
            :disabled="!apiKeyInput || validating"
            class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
          >
            {{ validating ? 'Validating...' : 'Validate & Save' }}
          </button>
          <button
            @click="showApiKeyModal = false"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { storeToRefs } from 'pinia'
import mvsepAPI, { SEPARATION_PRESETS, OUTPUT_FORMATS } from '../services/mvsepAPI'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['close'])

const audioStore = useAudioStore()
const { selectedTrack } = storeToRefs(audioStore)

// API Key State
const apiKeyConfigured = ref(mvsepAPI.hasApiToken())
const apiKeyInput = ref('')
const apiKeyError = ref('')
const validating = ref(false)
const showApiKeyModal = ref(false)
const userInfo = ref(null)

// Separation State
const selectedPreset = ref('HIGH_QUALITY_VOCALS')
const outputFormat = ref(OUTPUT_FORMATS.WAV_16.id)
const processing = ref(false)
const progressData = ref({
  status: '',
  message: '',
  progress: 0,
  queuePosition: null,
  queueCount: null
})
const results = ref(null)
const addingToTrack = ref(null)

// Computed Properties
const currentEstimatedCost = computed(() => {
  if (!selectedTrack.value) return 0
  const preset = SEPARATION_PRESETS[selectedPreset.value]
  return mvsepAPI.estimateCost(selectedTrack.value.duration, preset)
})

const hasInsufficientCredits = computed(() => {
  if (!userInfo.value) return false
  return (userInfo.value.premium_minutes || 0) < currentEstimatedCost.value
})

const hasLowCredits = computed(() => {
  if (!userInfo.value || hasInsufficientCredits.value) return false
  return (userInfo.value.premium_minutes || 0) < 50
})

const canStartSeparation = computed(() => {
  return apiKeyConfigured.value &&
         selectedTrack.value &&
         !hasInsufficientCredits.value &&
         !processing.value
})

// Methods
function estimatedCost(presetKey) {
  if (!selectedTrack.value) return 0
  const preset = SEPARATION_PRESETS[presetKey]
  return mvsepAPI.estimateCost(selectedTrack.value.duration, preset)
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

async function validateAndSaveApiKey() {
  if (!apiKeyInput.value) return

  validating.value = true
  apiKeyError.value = ''

  try {
    // Save token temporarily
    mvsepAPI.saveApiToken(apiKeyInput.value)

    // Validate it
    const info = await mvsepAPI.validateApiToken()

    // Success!
    userInfo.value = info
    apiKeyConfigured.value = true
    showApiKeyModal.value = false
    apiKeyInput.value = ''

    console.log('✅ API key validated successfully')
  } catch (error) {
    apiKeyError.value = error.message || 'Invalid API key'
    mvsepAPI.saveApiToken(null) // Clear invalid token
    apiKeyConfigured.value = false
  } finally {
    validating.value = false
  }
}

async function startSeparation() {
  if (!canStartSeparation.value) return

  processing.value = true
  results.value = null
  progressData.value = { status: '', message: 'Preparing...', progress: 0 }

  try {
    // Get audio buffer
    if (!selectedTrack.value.buffer) {
      throw new Error('No audio buffer available')
    }

    // Convert AudioBuffer to WAV Blob
    const wavBlob = await audioBufferToWavBlob(selectedTrack.value.buffer)

    // Create separation job
    const preset = SEPARATION_PRESETS[selectedPreset.value]
    const { hash } = await mvsepAPI.createSeparation(wavBlob, {
      separationType: preset.id,
      outputFormat: outputFormat.value,
      filename: `${selectedTrack.value.name}.wav`
    })

    console.log(`✅ Separation job created: ${hash}`)

    // Poll for results
    const resultData = await mvsepAPI.pollJobStatus(hash, (progress) => {
      progressData.value = progress
    })

    // Parse results
    results.value = mvsepAPI.parseSeparationResult(resultData)

    console.log(`✅ Separation complete! ${results.value.length} stems`)
  } catch (error) {
    console.error('Separation failed:', error)
    alert(`Separation failed: ${error.message}`)
    results.value = null
  } finally {
    processing.value = false
  }
}

async function audioBufferToWavBlob(audioBuffer) {
  // Use the audio engine's bufferToWav method
  const wavBlob = audioStore.engine.bufferToWav(audioBuffer)
  return wavBlob
}

async function previewStem(stem) {
  try {
    // Download the stem
    const blob = await mvsepAPI.downloadStem(stem.url)

    // Create audio element and play
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.play()

    // Clean up URL after playing
    audio.onended = () => {
      URL.revokeObjectURL(url)
    }

    console.log(`▶ Playing preview: ${stem.name}`)
  } catch (error) {
    console.error('Failed to preview stem:', error)
    alert(`Failed to preview: ${error.message}`)
  }
}

async function downloadStem(stem) {
  try {
    // Download the stem
    const blob = await mvsepAPI.downloadStem(stem.url)

    // Create download link
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = stem.filename || `${stem.name}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    console.log(`⬇ Downloaded: ${stem.name}`)
  } catch (error) {
    console.error('Failed to download stem:', error)
    alert(`Failed to download: ${error.message}`)
  }
}

async function addStemToTrack(stem) {
  if (addingToTrack.value) return

  addingToTrack.value = stem.url

  try {
    // Download the stem
    const blob = await mvsepAPI.downloadStem(stem.url)

    // Convert to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer()

    // Decode audio data
    const audioBuffer = await audioStore.engine.audioContext.decodeAudioData(arrayBuffer)

    // Add as new track
    const track = audioStore.addTrack(`${stem.name}`)
    audioStore.addClipToTrack(track.id, audioBuffer, 0, stem.name)

    console.log(`✅ Added ${stem.name} to timeline`)
  } catch (error) {
    console.error('Failed to add stem to track:', error)
    alert(`Failed to add to track: ${error.message}`)
  } finally {
    addingToTrack.value = null
  }
}

// Load user info on mount if API key is configured
onMounted(async () => {
  if (apiKeyConfigured.value) {
    try {
      userInfo.value = await mvsepAPI.getUserInfo()
    } catch (error) {
      console.error('Failed to load user info:', error)
      // API key might be invalid
      apiKeyConfigured.value = false
    }
  }
})

// Watch for visibility changes to refresh user info
watch(() => props.visible, async (visible) => {
  if (visible && apiKeyConfigured.value && !userInfo.value) {
    try {
      userInfo.value = await mvsepAPI.getUserInfo()
    } catch (error) {
      console.error('Failed to load user info:', error)
    }
  }
})
</script>

<style scoped>
.stem-panel-container {
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.preset-option {
  border: 2px solid;
}

.progress-bar {
  position: relative;
}

/* Scrollbar styling */
.stem-panel-container::-webkit-scrollbar {
  width: 8px;
}

.stem-panel-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
}

.stem-panel-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
}

.stem-panel-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
