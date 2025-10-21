import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT) || 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT) || 4173,
    allowedHosts: [
      '.onrender.com',
      'localhost',
      '127.0.0.1'
    ]
  },
  build: {
    rollupOptions: {
      external: [
        '/wasm/audio-processor.js',
        '/wasm/effects-processor.js'
      ]
    }
  }
})
