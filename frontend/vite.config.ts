/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL || 'http://127.0.0.1:8090'

  return ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: Number.parseInt(process.env.VITE_DEV_PORT || '5180'),
    allowedHosts: ['ekinbot.local', 'localhost', 'ekinbot.tailaa4a2e.ts.net'],
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        ws: true, // Enable WebSocket proxy for SSE
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep React and React-DOM separate from everything else
          if (id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react/') && !id.includes('react-')) {
            return 'vendor-react';
          }

          // Three.js and related
          if (id.includes('@react-three/') || id.includes('node_modules/three')) {
            return 'vendor-three';
          }

          // CodeMirror
          if (id.includes('@codemirror/')) {
            return 'vendor-codemirror';
          }

          // Markdown
          if (id.includes('react-markdown') || id.includes('rehype-') || id.includes('remark-') || id.includes('highlight.js')) {
            return 'vendor-markdown';
          }

          // DnD Kit - keep separate from React
          if (id.includes('@dnd-kit/')) {
            return 'vendor-dnd';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
})})
