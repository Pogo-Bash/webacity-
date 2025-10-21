import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: 'wasm'
        },
        {
          src: 'node_modules/onnxruntime-web/dist/*.mjs',
          dest: 'wasm'
        }
      ]
    })
  ],
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
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  }
})
