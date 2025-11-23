import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT) || 5173,
    proxy: {
      '/api/mvsep': {
        target: 'https://mvsep.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mvsep/, ''),
        secure: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Proxy]', req.method, req.url, '→', proxyReq.path)
          })
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Proxy Response]', proxyRes.statusCode, req.url)
          })
          proxy.on('error', (err, req, res) => {
            console.error('[Proxy Error]', err.message, req.url)
          })
        }
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT) || 4173,
    allowedHosts: [
      '.onrender.com',
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api/mvsep': {
        target: 'https://mvsep.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mvsep/, ''),
        secure: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Proxy]', req.method, req.url, '→', proxyReq.path)
          })
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Proxy Response]', proxyRes.statusCode, req.url)
          })
          proxy.on('error', (err, req, res) => {
            console.error('[Proxy Error]', err.message, req.url)
          })
        }
      }
    }
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
