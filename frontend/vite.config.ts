/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.VITE_DEV_PORT || '5180'),
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
})
