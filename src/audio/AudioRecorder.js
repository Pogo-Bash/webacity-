/**
 * Audio Recording Manager
 * Handles microphone and system audio recording
 */

class AudioRecorder {
  constructor(audioContext) {
    this.audioContext = audioContext
    this.mediaRecorder = null
    this.audioStream = null
    this.recordedChunks = []
    this.isRecording = false
    this.isPaused = false
    this.recordingStartTime = 0
    this.recordingDuration = 0
    this.audioWorkletNode = null
  }

  /**
   * Request microphone access
   */
  async requestMicrophoneAccess() {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.audioContext.sampleRate
        }
      })
      return true
    } catch (error) {
      console.error('Microphone access denied:', error)
      throw new Error('Microphone access denied. Please grant permission.')
    }
  }

  /**
   * Start recording
   */
  async startRecording() {
    if (!this.audioStream) {
      await this.requestMicrophoneAccess()
    }

    // Create MediaRecorder
    const options = { mimeType: 'audio/webm;codecs=opus' }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'audio/webm'
    }

    this.mediaRecorder = new MediaRecorder(this.audioStream, options)
    this.recordedChunks = []

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' })
      this.recordedBlob = blob
    }

    this.mediaRecorder.start(100) // Collect data every 100ms
    this.isRecording = true
    this.recordingStartTime = this.audioContext.currentTime

    return true
  }

  /**
   * Pause recording
   */
  pauseRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.pause()
      this.isPaused = true
    }
  }

  /**
   * Resume recording
   */
  resumeRecording() {
    if (this.mediaRecorder && this.isPaused) {
      this.mediaRecorder.resume()
      this.isPaused = false
    }
  }

  /**
   * Stop recording and return audio buffer
   */
  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No active recording'))
        return
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' })
          const arrayBuffer = await blob.arrayBuffer()
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

          this.isRecording = false
          this.isPaused = false
          this.recordingDuration = this.audioContext.currentTime - this.recordingStartTime

          resolve(audioBuffer)
        } catch (error) {
          reject(error)
        }
      }

      this.mediaRecorder.stop()
    })
  }

  /**
   * Monitor recording level (for visual feedback)
   */
  async setupLevelMonitoring(callback) {
    if (!this.audioStream) return

    const source = this.audioContext.createMediaStreamSource(this.audioStream)
    const analyser = this.audioContext.createAnalyser()
    analyser.fftSize = 256

    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const monitorLevel = () => {
      if (!this.isRecording) return

      analyser.getByteFrequencyData(dataArray)

      // Calculate average level
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }
      const average = sum / dataArray.length / 255 // Normalize to 0-1

      callback(average)

      requestAnimationFrame(monitorLevel)
    }

    monitorLevel()
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop())
    }
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
    }
  }
}

export default AudioRecorder
