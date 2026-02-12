import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['kais-mac-mini.tail10d3ac.ts.net', 'localhost', '100.67.197.44'],
    proxy: {
      '/api': {
        target: 'http://localhost:4006',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
