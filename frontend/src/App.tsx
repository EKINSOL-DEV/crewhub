import { useState, useEffect } from 'react'

interface HealthStatus {
  status: string
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => setHealth({ status: 'connected' }))
      .catch(err => setError('Backend not available'))
  }, [])

  return (
    <div className="app">
      <header>
        <h1>🦀 ClawCrew</h1>
        <p>Multi-agent orchestration platform</p>
      </header>

      <main>
        <section className="status">
          <h2>Status</h2>
          {error ? (
            <p className="error">❌ {error}</p>
          ) : health ? (
            <p className="success">✅ Backend {health.status}</p>
          ) : (
            <p>Loading...</p>
          )}
        </section>

        <section className="agents">
          <h2>Agents</h2>
          <p>No agents running. Create one to get started.</p>
          <button>+ New Agent</button>
        </section>
      </main>

      <footer>
        <p>ClawCrew v0.1.0</p>
      </footer>
    </div>
  )
}

export default App
