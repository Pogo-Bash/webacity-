/**
 * MVSep API Service
 * Integrates with mvsep.com cloud-based stem separation API
 * API Documentation: https://mvsep.com/api
 */

// Use Vite proxy to avoid CORS issues
// The proxy is configured in vite.config.js for both dev and preview servers
// /api/mvsep/* -> https://mvsep.com/* (via Vite proxy)
const API_BASE_URL = '/api/mvsep'
const STORAGE_KEY = 'mvsep_api_token'

// Debug: Log API configuration
console.log('🔧 MVSep API Configuration:', {
  apiBaseUrl: API_BASE_URL,
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV
})

/**
 * Curated separation presets for different use cases
 */
export const SEPARATION_PRESETS = {
  VOCALS_INSTRUMENTAL: {
    id: 26, // Ensemble (vocals, instrum)
    name: 'Vocals & Instrumental',
    description: 'Best for: Karaoke, vocal removal, instrumental backing tracks',
    outputs: ['vocals', 'instrumental'],
    priceMultiplier: 1.0
  },
  FULL_MIX_5_STEM: {
    id: 28, // Ensemble 5-stem
    name: 'Full Mix (5 Stems)',
    description: 'Best for: Remixing, detailed editing',
    outputs: ['vocals', 'bass', 'drums', 'other', 'instrumental'],
    priceMultiplier: 1.5
  },
  ALL_IN_7_STEM: {
    id: 30, // Ensemble All-In
    name: 'Complete Separation (7 Stems)',
    description: 'Best for: Professional mixing, stem extraction',
    outputs: ['vocals', 'bass', 'drums', 'piano', 'guitar', 'lead_vocals', 'backing_vocals', 'other'],
    priceMultiplier: 2.0
  },
  HIGH_QUALITY_VOCALS: {
    id: 40, // BS Roformer
    name: 'High Quality Vocals',
    description: 'Best for: Vocal isolation, covers, acapella',
    outputs: ['vocals', 'instrumental'],
    priceMultiplier: 1.2
  },
  DENOISE: {
    id: 47, // DeNoise by aufr33
    name: 'Remove Noise',
    description: 'Best for: Cleaning up recordings, removing background noise',
    outputs: ['clean', 'noise'],
    priceMultiplier: 0.8
  }
}

/**
 * Output format options
 */
export const OUTPUT_FORMATS = {
  WAV_16: { id: 1, name: 'WAV (16-bit)', extension: 'wav' },
  FLAC_16: { id: 2, name: 'FLAC (16-bit)', extension: 'flac' },
  MP3_320: { id: 0, name: 'MP3 (320kbps)', extension: 'mp3' },
  WAV_32: { id: 4, name: 'WAV (32-bit)', extension: 'wav' }
}

/**
 * MVSep API Service Class
 */
class MVSepAPIService {
  constructor() {
    this.apiToken = this.loadApiToken()
  }

  /**
   * Save API token to localStorage
   */
  saveApiToken(token) {
    if (!token) {
      localStorage.removeItem(STORAGE_KEY)
      this.apiToken = null
    } else {
      localStorage.setItem(STORAGE_KEY, token)
      this.apiToken = token
    }
  }

  /**
   * Load API token from localStorage
   */
  loadApiToken() {
    return localStorage.getItem(STORAGE_KEY) || null
  }

  /**
   * Check if API token is configured
   */
  hasApiToken() {
    return this.apiToken !== null && this.apiToken !== ''
  }

  /**
   * Validate API token and get user information
   * @returns {Promise<Object>} User info: { name, email, premium_minutes, premium_enabled, current_queue }
   */
  async validateApiToken() {
    if (!this.hasApiToken()) {
      throw new Error('No API token configured')
    }

    const url = `${API_BASE_URL}/api/app/user`
    console.log('🔍 Validating API token at:', url)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API token')
        }
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to validate API token:', error)
      throw error
    }
  }

  /**
   * Get user information (credits, queue status)
   * @returns {Promise<Object>}
   */
  async getUserInfo() {
    return await this.validateApiToken()
  }

  /**
   * Get current queue status
   * @returns {Promise<Object>} Queue info: { queue_count, queue_duration }
   */
  async getQueueStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/app/queue`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get queue status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to get queue status:', error)
      throw error
    }
  }

  /**
   * Estimate cost in credits (minutes) for a separation
   * @param {number} durationSeconds - Audio duration in seconds
   * @param {Object} preset - Separation preset
   * @returns {number} Estimated cost in credits
   */
  estimateCost(durationSeconds, preset) {
    // Formula: floor(duration * priceMultiplier / 60) || 1
    const cost = Math.max(1, Math.floor(durationSeconds * preset.priceMultiplier / 60))
    return cost
  }

  /**
   * Create a separation job
   * @param {Blob} audioBlob - Audio file as Blob
   * @param {Object} options - { separationType, outputFormat, filename }
   * @returns {Promise<Object>} { hash } - Job hash for polling
   */
  async createSeparation(audioBlob, options) {
    if (!this.hasApiToken()) {
      throw new Error('No API token configured')
    }

    const { separationType, outputFormat, filename } = options

    // Create FormData
    const formData = new FormData()
    formData.append('audio', audioBlob, filename || 'audio.wav')
    formData.append('separation_type', separationType.toString())
    formData.append('output_format', outputFormat.toString())

    try {
      const response = await fetch(`${API_BASE_URL}/api/separation/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to create separation: ${response.status}`)
      }

      const data = await response.json()

      if (!data.hash) {
        throw new Error('No job hash returned from API')
      }

      return { hash: data.hash }
    } catch (error) {
      console.error('Failed to create separation:', error)
      throw error
    }
  }

  /**
   * Get separation result (poll for status)
   * @param {string} hash - Job hash
   * @returns {Promise<Object>} Job status data
   */
  async getSeparationResult(hash) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/separation/get?hash=${hash}`)

      if (!response.ok) {
        throw new Error(`Failed to get separation result: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to get separation result:', error)
      throw error
    }
  }

  /**
   * Poll job status until completion
   * @param {string} hash - Job hash
   * @param {Function} onProgress - Callback for progress updates
   * @returns {Promise<Object>} Final job data with download URLs
   */
  async pollJobStatus(hash, onProgress) {
    const maxAttempts = 300 // 5 minutes max (300 seconds)
    let attempts = 0

    while (attempts < maxAttempts) {
      const result = await this.getSeparationResult(hash)

      const status = result.status // 'waiting', 'distributing', 'processing', 'done', 'failed'

      // Calculate progress percentage
      let progress = 0
      if (status === 'done') {
        progress = 100
      } else if (status === 'processing') {
        progress = Math.min(95, 50 + attempts)
      } else if (status === 'distributing') {
        progress = 25
      } else {
        progress = Math.min(20, attempts)
      }

      if (onProgress) {
        onProgress({
          status,
          queuePosition: result.data?.current_order,
          queueCount: result.data?.queue_count,
          message: result.data?.message || this.getStatusMessage(status),
          progress
        })
      }

      if (status === 'done') {
        return result.data // Contains files array with download URLs
      }

      if (status === 'failed') {
        throw new Error(result.data?.message || 'Separation failed')
      }

      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
    }

    throw new Error('Separation timeout - taking too long')
  }

  /**
   * Get human-readable status message
   * @param {string} status
   * @returns {string}
   */
  getStatusMessage(status) {
    const messages = {
      'waiting': 'Waiting in queue...',
      'distributing': 'Preparing job...',
      'processing': 'Separating stems...',
      'done': 'Complete!',
      'failed': 'Failed'
    }
    return messages[status] || 'Processing...'
  }

  /**
   * Download a stem file
   * @param {string} url - Download URL
   * @returns {Promise<Blob>} Audio file as Blob
   */
  async downloadStem(url) {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to download stem: ${response.status}`)
      }

      const blob = await response.blob()
      return blob
    } catch (error) {
      console.error('Failed to download stem:', error)
      throw error
    }
  }

  /**
   * Convert separation result to friendly format
   * @param {Object} resultData - Raw result data from API
   * @returns {Array} Array of { name, url, size, filename }
   */
  parseSeparationResult(resultData) {
    if (!resultData.files || !Array.isArray(resultData.files)) {
      return []
    }

    return resultData.files.map(file => ({
      name: file.name || 'Unknown',
      url: file.url,
      size: file.size || 0,
      filename: file.filename || file.name || 'stem.wav'
    }))
  }
}

// Export singleton instance
const mvsepAPI = new MVSepAPIService()
export default mvsepAPI
