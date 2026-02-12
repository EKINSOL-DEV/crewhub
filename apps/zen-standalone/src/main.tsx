import React from 'react'
import ReactDOM from 'react-dom/client'
import { ZenStandaloneApp } from './App'

// Import shared styles from CrewHub frontend
import '@/index.css'
// Import Zen Mode CSS
import '@/components/zen/ZenMode.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ZenStandaloneApp />
  </React.StrictMode>,
)
