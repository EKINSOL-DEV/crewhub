import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Zen Standalone shares source code with the main CrewHub frontend
// via path aliases. This ensures DRY - no code duplication.
const FRONTEND_SRC = path.resolve(__dirname, '../../frontend/src')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point @/ to the shared frontend source
      '@': FRONTEND_SRC,
      // Local src for zen-standalone specific files
      '@zen': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5183,
    fs: {
      // Allow serving files from the shared frontend source
      allow: [
        path.resolve(__dirname, '.'),
        path.resolve(__dirname, '../../frontend'),
      ],
    },
    allowedHosts: ['ekinbot.local', 'localhost'],
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8091',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
})
