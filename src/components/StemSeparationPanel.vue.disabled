<template>
  <div v-if="visible" class="stem-panel-container fixed right-4 top-20 w-96 max-h-[calc(100vh-6rem)] overflow-y-auto bg-gray-800 rounded-lg shadow-2xl z-50">
    <div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
      <h3 class="text-white font-semibold">AI Stem Separation</h3>
      <button @click="$emit('close')" class="text-gray-400 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- TensorFlow.js Status -->
    <div class="p-4 border-b border-gray-700">
      <div class="flex items-center gap-2 mb-2">
        <div :class="['w-2 h-2 rounded-full', tfStatus.initialized ? 'bg-green-500' : 'bg-gray-500']"></div>
        <span class="text-sm text-gray-300">
          {{ tfStatus.initialized ? tfStatus.mode : 'Not Initialized' }}
        </span>
      </div>

      <div class="text-xs p-2 rounded border" :class="onnxModelStatus.available ? 'bg-green-900 bg-opacity-20 border-green-700' : 'bg-blue-900 bg-opacity-20 border-blue-700'">
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 mt-0.5 flex-shrink-0" :class="onnxModelStatus.available ? 'text-green-400' : 'text-blue-400'" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <div>
            <strong>{{ separatorInfo.name }}:</strong> {{ separatorInfo.description || separatorInfo.quality }}
            <div class="text-xs text-gray-400 mt-1">Processing speed: {{ separatorInfo.speed }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Track Selection -->
    <div v-if="!selectedTrack" class="p-4 text-gray-400 text-sm">
      Select a track to separate stems
    </div>

    <div v-else class="p-4 space-y-4">
      <div class="text-sm text-gray-400">
        Track: <span class="text-white">{{ selectedTrack.name }}</span>
      </div>

      <!-- Separation Controls -->
      <div class="space-y-3">
        <button
          @click="startSeparation"
          :disabled="!canSeparate || processing"
          class="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="!processing">🎵 Separate Stems</span>
          <span v-else>{{ progressInfo.message || 'Processing...' }}</span>
        </button>

        <!-- Progress Bar -->
        <div v-if="processing" class="space-y-2">
          <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              class="bg-gradient-to-r from-purple-500 to-blue-500 h-2 transition-all duration-300"
              :style="{ width: progressInfo.progress + '%' }"
            ></div>
          </div>
          <div class="text-xs text-center text-gray-400">
            {{ progressInfo.progress }}% - {{ progressInfo.status }}
          </div>
        </div>

        <!-- Info -->
        <div class="text-xs p-3 rounded" :class="onnxModelStatus.available ? 'bg-green-900 bg-opacity-30 text-green-200' : 'bg-gray-900 bg-opacity-50 text-gray-500'">
          <div class="flex items-start gap-2">
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <div>
              <strong>{{ separatorInfo.name }}:</strong> {{ separatorInfo.description || 'Processing audio with ' + separatorInfo.quality }}
              <div class="mt-1">Expected time: {{ separatorInfo.speed }}</div>
              <div v-if="!onnxModelStatus.available" class="mt-1 opacity-75">
                For professional-quality separation, add the AI model to public/models/vocals.onnx
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div v-if="stems" class="space-y-3 pt-3 border-t border-gray-700">
        <h4 class="text-sm font-medium text-white">Separated Stems:</h4>

        <!-- Vocals Stem -->
        <div class="stem-result bg-gray-900 rounded-lg p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-blue-400">🎤 Vocals</span>
            <span class="text-xs text-gray-500">{{ formatDuration(stems.vocals.duration) }}</span>
          </div>

          <div class="flex gap-2">
            <button
              @click="addStemAsTrack('vocals')"
              class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              Add as Track
            </button>
            <button
              @click="downloadStem('vocals')"
              class="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Instrumental Stem -->
        <div class="stem-result bg-gray-900 rounded-lg p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-green-400">🎸 Instrumental</span>
            <span class="text-xs text-gray-500">{{ formatDuration(stems.instrumental.duration) }}</span>
          </div>

          <div class="flex gap-2">
            <button
              @click="addStemAsTrack('instrumental')"
              class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
            >
              Add as Track
            </button>
            <button
              @click="downloadStem('instrumental')"
              class="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { storeToRefs } from 'pinia'
import { stemSeparator } from '../services/stemSeparation'
import { onnxStemSeparator } from '../services/stemSeparationONNX'

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const audioStore = useAudioStore()
const { selectedTrack } = storeToRefs(audioStore)

const separatorMode = ref('auto') // 'auto', 'demo', 'onnx'
const onnxModelStatus = ref({
  available: false,
  loading: false,
  error: null
})

const tfStatus = ref({
  initialized: false,
  backend: '',
  mode: '',
  tfVersion: ''
})

const processing = ref(false)
const progressInfo = ref({
  status: '',
  message: '',
  progress: 0
})

const stems = ref(null)

const canSeparate = computed(() => {
  return selectedTrack.value &&
         selectedTrack.value.clips.length > 0 &&
         !processing.value
})

const separatorInfo = computed(() => {
  if (onnxModelStatus.value.available) {
    return {
      name: 'AI Model (ONNX)',
      quality: '⭐⭐⭐⭐⭐ Professional',
      speed: '30-45s for 90s audio',
      description: 'UVR MDX-NET AI model with WebGPU acceleration'
    }
  } else {
    return {
      name: 'Demo Mode (Filters)',
      quality: '⭐⭐ Basic',
      speed: '1-2 seconds',
      description: 'Fast frequency-based separation for previews'
    }
  }
})

onMounted(async () => {
  // Initialize TensorFlow.js fallback
  try {
    await stemSeparator.initialize()
    tfStatus.value = stemSeparator.getStatus()
  } catch (error) {
    console.error('Failed to initialize stem separator:', error)
  }

  // Check if ONNX model is available
  checkONNXModelAvailability()
})

async function checkONNXModelAvailability() {
  try {
    // Try to fetch model to see if it exists
    const response = await fetch('/models/vocals.onnx', { method: 'HEAD' })
    if (response.ok) {
      onnxModelStatus.value.available = true
      console.log('✅ ONNX model available at /models/vocals.onnx')
    } else {
      console.log('ℹ️ ONNX model not found - using demo mode')
    }
  } catch (error) {
    console.log('ℹ️ ONNX model not available - using demo mode')
  }
}

async function loadONNXModel() {
  if (onnxModelStatus.value.loading) return

  onnxModelStatus.value.loading = true
  onnxModelStatus.value.error = null

  try {
    await onnxStemSeparator.initialize((progress) => {
      progressInfo.value = progress
    })

    await onnxStemSeparator.loadModels(
      '/models/vocals.onnx',
      null, // instrumental will be derived
      (progress) => {
        progressInfo.value = progress
      }
    )

    onnxModelStatus.value.available = true
    alert('✅ AI model loaded successfully!')
  } catch (error) {
    onnxModelStatus.value.error = error.message
    alert(`❌ Failed to load AI model: ${error.message}\n\nFalling back to demo mode.`)
  } finally {
    onnxModelStatus.value.loading = false
  }
}

async function startSeparation() {
  if (!selectedTrack.value) return

  processing.value = true
  stems.value = null

  try {
    // Get the track's audio buffer from the first clip
    if (!selectedTrack.value.clips || selectedTrack.value.clips.length === 0) {
      throw new Error('Track has no audio clips')
    }

    const firstClip = selectedTrack.value.clips[0]
    if (!firstClip || !firstClip.buffer) {
      throw new Error('Clip has no audio buffer')
    }

    const trackBuffer = firstClip.buffer

    // Validate buffer
    if (!trackBuffer.length || trackBuffer.length === 0) {
      throw new Error('Audio buffer is empty')
    }

    console.log(`📊 Processing audio: ${trackBuffer.duration.toFixed(2)}s, ${trackBuffer.sampleRate}Hz, ${trackBuffer.numberOfChannels} channels`)

    // Choose separator based on availability
    let result
    if (onnxModelStatus.value.available && onnxStemSeparator.vocalsSession) {
      console.log('🤖 Using ONNX AI model')
      result = await onnxStemSeparator.separate(trackBuffer, (progress) => {
        progressInfo.value = progress
      })
    } else {
      console.log('🎛️ Using demo mode (frequency filters)')
      result = await stemSeparator.separate(trackBuffer, (progress) => {
        progressInfo.value = progress
      })
    }

    stems.value = result
    console.log('✅ Stems separated successfully')

    // Show success message
    const mode = onnxModelStatus.value.available ? 'AI model' : 'demo mode'
    alert(`✅ Stems separated successfully using ${mode}!\n\nUse the "Add as Track" buttons below to add them to your project.`)

  } catch (error) {
    console.error('Failed to separate stems:', error)
    alert('Failed to separate stems: ' + error.message)
  } finally {
    processing.value = false
  }
}

function addStemAsTrack(stemType) {
  if (!stems.value) return

  try {
    const buffer = stems.value[stemType]
    const trackName = `${selectedTrack.value.name} - ${stemType.charAt(0).toUpperCase() + stemType.slice(1)}`

    // Add track and clip
    const track = audioStore.addTrack(trackName)
    audioStore.addClipToTrack(track.id, buffer, 0, trackName)

    console.log(`✅ Added ${stemType} stem as new track`)

    // Give user feedback
    alert(`✅ ${trackName} added to timeline!`)
  } catch (error) {
    console.error(`Failed to add ${stemType} stem:`, error)
    alert(`Failed to add ${stemType} stem: ` + error.message)
  }
}

async function downloadStem(stemType) {
  if (!stems.value) return

  const buffer = stems.value[stemType]

  // Convert AudioBuffer to WAV
  const wav = audioBufferToWav(buffer)
  const blob = new Blob([wav], { type: 'audio/wav' })

  // Create download link
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedTrack.value.name}-${stemType}.wav`
  a.click()
  URL.revokeObjectURL(url)

  console.log(`Downloaded ${stemType} stem`)
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample

  const data = []
  for (let i = 0; i < numChannels; i++) {
    data.push(buffer.getChannelData(i))
  }

  const interleaved = interleaveChannels(data)
  const dataLength = interleaved.length * bytesPerSample
  const headerLength = 44
  const totalLength = headerLength + dataLength
  const buffer_array = new ArrayBuffer(totalLength)
  const view = new DataView(buffer_array)

  // Write WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalLength - 8, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // Write audio data
  floatTo16BitPCM(view, 44, interleaved)

  return buffer_array
}

function interleaveChannels(channels) {
  const length = channels[0].length
  const result = new Float32Array(length * channels.length)

  let offset = 0
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < channels.length; channel++) {
      result[offset++] = channels[channel][i]
    }
  }

  return result
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.stem-panel-container {
  backdrop-filter: blur(10px);
}

.stem-result {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
