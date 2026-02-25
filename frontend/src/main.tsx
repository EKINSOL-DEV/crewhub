import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installGlobalErrorCapture } from './lib/devErrorStore'
import { initAppSettings } from './components/mobile/MobileSettingsPanel'

// Install dev error capture before anything else
installGlobalErrorCapture()

// Apply persisted theme & font size before React renders (prevents FOUC)
initAppSettings()

// Initialize mock API for demo builds (must run before any React rendering)
async function boot() {
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    const { setupMockApi } = await import('./lib/mock')
    setupMockApi()
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

boot()
