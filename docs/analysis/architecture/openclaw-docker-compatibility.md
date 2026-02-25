# OpenClaw Docker Compatibility Masterplan

**Author:** Ekinbot
**Date:** 2026-02-07
**Status:** Draft
**Purpose:** Guide the implementation of full Docker compatibility between CrewHub and OpenClaw Gateway

---

## Executive Summary

This document outlines the strategy for enabling CrewHub to work seamlessly with OpenClaw Gateway in containerized deployments. Currently, CrewHub has partial Docker support but relies on host-based OpenClaw access. This masterplan covers full container-to-container communication, volume sharing, and configuration abstraction.

---

## 1. Current Architecture Analysis

### 1.1 How CrewHub Connects to OpenClaw

CrewHub uses two methods to interact with OpenClaw:

#### Method 1: WebSocket API (Real-time)
- **File:** `backend/app/services/connections/openclaw.py`
- **Default URL:** `ws://127.0.0.1:18789`
- **Purpose:** Session management, chat, events, cron jobs
- **Auth:** Token-based (from env or config)

```python
# Current implementation
self.uri = config.get("url") or os.getenv(
    "OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789"
)
self.token = config.get("token") or os.getenv("OPENCLAW_GATEWAY_TOKEN", "")
```

#### Method 2: Direct File Access (Session History)
- **File:** `backend/app/services/connections/openclaw.py`
- **Path:** `~/.openclaw/agents/{agentId}/sessions/{sessionId}.jsonl`
- **Purpose:** Read full session history/messages
- **Issue:** Assumes local filesystem access

```python
# Current file-based session reading
base = Path.home() / ".openclaw" / "agents" / agent_id / "sessions"
session_file = (base / f"{session_id}.jsonl").resolve()
```

#### Method 3: Config Auto-Discovery
- **File:** `backend/app/services/discovery.py`
- **Config paths probed:**
  - `~/.openclaw/openclaw.json`
  - `~/.openclaw/clawdbot.json`
  - `~/.openclaw/config.json`
- **Purpose:** Find OpenClaw port and token automatically

### 1.2 Current Assumptions (Docker Incompatibilities)

| Assumption | Issue in Docker |
|------------|-----------------|
| `127.0.0.1:18789` reachable | Container network isolation |
| `~/.openclaw/` exists locally | Different filesystem in container |
| Session files readable on host | Need volume mounts or API access |
| Config discovery on `Path.home()` | Container home ≠ host home |
| WebSocket to localhost | Need `host.docker.internal` or service name |

### 1.3 Current Docker Compose State

The existing `docker-compose.yml` already handles some of this:

```yaml
# Current setup (partial)
environment:
  - OPENCLAW_GATEWAY_URL=${OPENCLAW_GATEWAY_URL:-ws://host.docker.internal:18789}
extra_hosts:
  - "host.docker.internal:host-gateway"
```

**What works:** Connecting to host-based OpenClaw
**What's missing:** Container-to-container communication, shared volumes, full containerized deployment

---

## 2. Docker Networking Requirements

### 2.1 Deployment Scenarios

| Scenario | OpenClaw Location | CrewHub Location | Networking |
|----------|------------------|------------------|------------|
| **A. Host + Host** | Host machine | Host machine | `localhost:18789` |
| **B. Host + Container** | Host machine | Docker | `host.docker.internal:18789` |
| **C. Container + Container** | Docker | Docker | Shared network: `openclaw:18789` |
| **D. Mixed Compose** | Docker Compose | Docker Compose | Bridge network |

### 2.2 Network Configuration by Scenario

#### Scenario B: CrewHub in Docker, OpenClaw on Host (Current)
```yaml
services:
  backend:
    environment:
      - OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

#### Scenario C: Both in Same Docker Compose
```yaml
services:
  openclaw-gateway:
    image: openclaw:local
    networks:
      - crewhub-network

  backend:
    environment:
      - OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789
    networks:
      - crewhub-network

networks:
  crewhub-network:
    driver: bridge
```

#### Scenario D: Separate Compose Files (External Network)
```yaml
# In OpenClaw docker-compose.yml
networks:
  openclaw-net:
    name: openclaw-external
    driver: bridge

# In CrewHub docker-compose.yml
networks:
  openclaw-net:
    external: true
    name: openclaw-external
```

### 2.3 Port Exposure Strategy

| Service | Internal Port | External Port | Exposure |
|---------|--------------|---------------|----------|
| OpenClaw Gateway | 18789 | 18789 (optional) | Internal for container-to-container |
| CrewHub Backend | 8090 | 8090 | Public |
| CrewHub Frontend | 5180 | 5180 | Public |

**Recommendation:** Only expose OpenClaw externally if CLI access from host is needed.

---

## 3. Configuration Changes Needed

### 3.1 Environment Variables

```bash
# CrewHub Backend Environment
OPENCLAW_GATEWAY_URL=ws://openclaw:18789     # WebSocket endpoint
OPENCLAW_GATEWAY_TOKEN=your-token            # Auth token
OPENCLAW_DATA_DIR=/openclaw-data             # Shared data directory
OPENCLAW_SESSION_ACCESS=file|api             # How to read sessions (default: file)

# New: Path overrides for containerized setup
OPENCLAW_CONFIG_PATH=/openclaw-data/openclaw.json
OPENCLAW_AGENTS_PATH=/openclaw-data/agents
```

### 3.2 Config File Adaptations

#### Updated Discovery Service
```python
# discovery.py - Make paths configurable
class OpenClawDetector(BaseDetector):
    def __init__(self):
        # Allow override via environment
        self.data_dir = Path(os.getenv("OPENCLAW_DATA_DIR", str(Path.home() / ".openclaw")))
        self.DEFAULT_PORT = int(os.getenv("OPENCLAW_PORT", "18789"))

    @property
    def CONFIG_PATHS(self) -> list[Path]:
        return [
            self.data_dir / "openclaw.json",
            self.data_dir / "clawdbot.json",
            self.data_dir / "config.json",
        ]
```

#### Updated Session File Reader
```python
# openclaw.py - Make session path configurable
async def get_session_history(self, session_key: str, limit: int = 50):
    # Use configurable base path
    data_dir = Path(os.getenv("OPENCLAW_DATA_DIR", str(Path.home() / ".openclaw")))
    base = data_dir / "agents" / agent_id / "sessions"
    session_file = (base / f"{session_id}.jsonl").resolve()
```

### 3.3 Configuration Priority

1. **Environment variables** (highest priority - Docker-friendly)
2. **Config file** (`crewhub.json` or connection settings)
3. **Auto-discovery** (fallback for local development)

---

## 4. Volume Mounting Strategy

### 4.1 Shared `.openclaw` Directory

Both CrewHub and OpenClaw need access to the same data:

```yaml
volumes:
  openclaw-data:
    driver: local

services:
  openclaw-gateway:
    volumes:
      - openclaw-data:/home/node/.openclaw
      - openclaw-workspace:/home/node/.openclaw/workspace

  crewhub-backend:
    volumes:
      - openclaw-data:/openclaw-data:ro  # Read-only for CrewHub
```

### 4.2 What CrewHub Needs Access To

| Path | Access | Purpose |
|------|--------|---------|
| `agents/*/sessions/*.jsonl` | Read | Session history |
| `openclaw.json` | Read | Auto-discovery (port, token hint) |
| `workspace/` | None | Agent workspaces (not needed) |

### 4.3 Recommended Mount Structure

```yaml
# Minimal mount - only what CrewHub needs
volumes:
  - openclaw-data:/openclaw-data:ro

# Environment tells CrewHub where to look
environment:
  - OPENCLAW_DATA_DIR=/openclaw-data
```

### 4.4 Security Considerations

| Risk | Mitigation |
|------|-----------|
| Token exposure | Mount config read-only, use env vars for tokens |
| Session data leakage | CrewHub only reads, never writes |
| Path traversal | Already implemented in `_safe_id()` function |
| Volume permission issues | Match UID:GID (1000:1000 for OpenClaw) |

---

## 5. Docker Compose Setup

### 5.1 Complete Template: CrewHub + OpenClaw

```yaml
# docker-compose.full.yml - Full containerized deployment
version: "3.8"

services:
  # ============================================
  # OpenClaw Gateway
  # ============================================
  openclaw-gateway:
    image: openclaw:local
    container_name: openclaw-gateway
    restart: unless-stopped
    ports:
      - "18789:18789"  # Expose for external CLI access (optional)
    volumes:
      - openclaw-data:/home/node/.openclaw
      - openclaw-workspace:/home/node/.openclaw/workspace
    environment:
      - NODE_ENV=production
      - OPENCLAW_GATEWAY_BIND=lan  # Listen on all interfaces
    networks:
      - crewhub-network
    healthcheck:
      test: ["CMD", "node", "dist/index.js", "health", "--token", "${OPENCLAW_GATEWAY_TOKEN}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # ============================================
  # OpenClaw CLI (for setup/management)
  # ============================================
  openclaw-cli:
    image: openclaw:local
    container_name: openclaw-cli
    profiles: ["cli"]  # Only run when explicitly requested
    volumes:
      - openclaw-data:/home/node/.openclaw
      - openclaw-workspace:/home/node/.openclaw/workspace
    environment:
      - OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
    networks:
      - crewhub-network
    entrypoint: ["node", "dist/index.js"]

  # ============================================
  # CrewHub Backend
  # ============================================
  crewhub-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: crewhub-backend
    restart: unless-stopped
    ports:
      - "8090:8090"
    volumes:
      - crewhub-data:/root/.crewhub
      - openclaw-data:/openclaw-data:ro  # Read-only access to OpenClaw data
    environment:
      - OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - OPENCLAW_DATA_DIR=/openclaw-data
    networks:
      - crewhub-network
    depends_on:
      openclaw-gateway:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  # ============================================
  # CrewHub Frontend
  # ============================================
  crewhub-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: crewhub-frontend
    restart: unless-stopped
    ports:
      - "5180:5180"
    environment:
      - VITE_API_URL=http://crewhub-backend:8090
    networks:
      - crewhub-network
    depends_on:
      crewhub-backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:5180"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

# ============================================
# Networks
# ============================================
networks:
  crewhub-network:
    driver: bridge
    name: crewhub-network

# ============================================
# Volumes
# ============================================
volumes:
  openclaw-data:
    name: openclaw-data
  openclaw-workspace:
    name: openclaw-workspace
  crewhub-data:
    name: crewhub-data
```

### 5.2 Hybrid Template: CrewHub in Docker + OpenClaw on Host

```yaml
# docker-compose.yml - CrewHub containerized, OpenClaw on host
version: "3.8"

services:
  crewhub-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: crewhub-backend
    restart: unless-stopped
    ports:
      - "8090:8090"
    volumes:
      - ./data:/root/.crewhub
      - ~/.openclaw:/openclaw-data:ro  # Mount host's .openclaw directory
    environment:
      - OPENCLAW_GATEWAY_URL=${OPENCLAW_GATEWAY_URL:-ws://host.docker.internal:18789}
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN:-}
      - OPENCLAW_DATA_DIR=/openclaw-data
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      - crewhub-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  crewhub-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: crewhub-frontend
    restart: unless-stopped
    ports:
      - "5180:5180"
    environment:
      - VITE_API_URL=http://crewhub-backend:8090
    networks:
      - crewhub-network
    depends_on:
      crewhub-backend:
        condition: service_healthy

networks:
  crewhub-network:
    driver: bridge
```

### 5.3 Environment File Template

```bash
# .env.docker
# ============================================
# OpenClaw Configuration
# ============================================

# Gateway token (required for authenticated access)
OPENCLAW_GATEWAY_TOKEN=your-secure-token-here

# Gateway URL (auto-configured based on compose file)
# For full containerized: ws://openclaw-gateway:18789
# For hybrid (OpenClaw on host): ws://host.docker.internal:18789
OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789

# ============================================
# CrewHub Configuration
# ============================================

# Frontend API URL (internal Docker network)
VITE_API_URL=http://crewhub-backend:8090

# Data directory (inside container)
CREWHUB_DATA_DIR=/root/.crewhub
```

---

## 6. Implementation Phases

### Phase 1: Configuration Abstraction (Week 1)

**Goal:** Make all paths and URLs configurable via environment variables.

#### Tasks:
- [ ] Update `discovery.py` to use `OPENCLAW_DATA_DIR` environment variable
- [ ] Update `openclaw.py` session file reader to use configurable paths
- [ ] Add `OPENCLAW_SESSION_ACCESS` mode (file vs API)
- [ ] Update `docker-compose.yml` with new environment variables
- [ ] Add `.env.example` with all new variables documented

#### Code Changes:

**File: `backend/app/services/discovery.py`**
```python
import os
from pathlib import Path

class OpenClawDetector(BaseDetector):
    def __init__(self):
        self.data_dir = Path(os.getenv(
            "OPENCLAW_DATA_DIR",
            str(Path.home() / ".openclaw")
        ))
        self.DEFAULT_PORT = int(os.getenv("OPENCLAW_PORT", "18789"))
        self.gateway_host = os.getenv("OPENCLAW_HOST", "127.0.0.1")

    @property
    def CONFIG_PATHS(self) -> list[Path]:
        return [
            self.data_dir / "openclaw.json",
            self.data_dir / "clawdbot.json",
            self.data_dir / "config.json",
        ]

    async def _probe_websocket(self, url: str = None, token: str = None):
        if url is None:
            url = f"ws://{self.gateway_host}:{self.DEFAULT_PORT}"
        # ... rest of implementation
```

**File: `backend/app/services/connections/openclaw.py`**
```python
class OpenClawConnection(AgentConnection):
    def __init__(self, connection_id: str, name: str, config: dict = None):
        config = config or {}
        super().__init__(...)

        # Configurable data directory
        self.data_dir = Path(config.get("data_dir") or os.getenv(
            "OPENCLAW_DATA_DIR",
            str(Path.home() / ".openclaw")
        ))

        # Session access mode: 'file' or 'api'
        self.session_access = config.get("session_access") or os.getenv(
            "OPENCLAW_SESSION_ACCESS", "file"
        )

    async def get_session_history(self, session_key: str, limit: int = 50):
        if self.session_access == "api":
            return await self._get_history_via_api(session_key, limit)
        return await self._get_history_via_file(session_key, limit)

    async def _get_history_via_file(self, session_key: str, limit: int):
        # ... existing file-based implementation
        base = self.data_dir / "agents" / agent_id / "sessions"
        # ...

    async def _get_history_via_api(self, session_key: str, limit: int):
        # Future: use sessions.history API when available
        result = await self.call("sessions.history", {
            "sessionKey": session_key,
            "limit": limit
        })
        # ...
```

### Phase 2: Docker Compose Integration (Week 2)

**Goal:** Create production-ready Docker Compose configurations.

#### Tasks:
- [ ] Create `docker-compose.full.yml` (complete stack)
- [ ] Update `docker-compose.yml` (hybrid mode)
- [ ] Create `docker-compose.override.yml` for development
- [ ] Add startup scripts (`./scripts/docker-start.sh`)
- [ ] Test container-to-container connectivity
- [ ] Implement volume permission handling

#### Startup Script:

**File: `scripts/docker-start.sh`**
```bash
#!/bin/bash
set -e

MODE="${1:-hybrid}"  # hybrid | full

echo "🚀 Starting CrewHub in $MODE mode..."

if [ "$MODE" == "full" ]; then
    # Full containerized stack
    docker compose -f docker-compose.full.yml up -d

    echo "📋 Running OpenClaw onboarding..."
    docker compose -f docker-compose.full.yml run --rm openclaw-cli onboard

    echo "✅ Full stack started!"
    echo "   - CrewHub: http://localhost:5180"
    echo "   - Backend: http://localhost:8090"
    echo "   - OpenClaw Gateway: ws://localhost:18789"

elif [ "$MODE" == "hybrid" ]; then
    # CrewHub in Docker, OpenClaw on host
    if ! pgrep -f "openclaw" > /dev/null; then
        echo "⚠️  OpenClaw Gateway not running on host!"
        echo "   Start it with: openclaw gateway start"
        exit 1
    fi

    docker compose up -d

    echo "✅ Hybrid stack started!"
    echo "   - CrewHub: http://localhost:5180"
    echo "   - Backend: http://localhost:8090"
    echo "   - OpenClaw Gateway: ws://host.docker.internal:18789 (host)"
fi
```

### Phase 3: Documentation & Examples (Week 3)

**Goal:** Comprehensive documentation for all deployment scenarios.

#### Tasks:
- [ ] Update `README.md` with Docker deployment section
- [ ] Create `docs/deployment/docker.md` guide
- [ ] Add troubleshooting section for common issues
- [ ] Create example `.env` files for each scenario
- [ ] Add architecture diagrams

#### Documentation Structure:

```
docs/
├── deployment/
│   ├── docker.md           # Main Docker guide
│   ├── docker-hybrid.md    # Hybrid deployment
│   ├── docker-full.md      # Full containerized
│   └── troubleshooting.md  # Common issues
├── configuration/
│   └── environment.md      # All env vars documented
└── openclaw-docker-compatibility.md  # This masterplan
```

### Phase 4: CI/CD Integration (Week 4)

**Goal:** Automated testing and deployment pipelines.

#### Tasks:
- [ ] Add GitHub Actions workflow for Docker builds
- [ ] Create integration tests for containerized deployment
- [ ] Implement health check endpoints
- [ ] Add smoke tests for connectivity
- [ ] Create deployment automation scripts

#### GitHub Actions Workflow:

**File: `.github/workflows/docker.yml`**
```yaml
name: Docker Build & Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build images
        run: docker compose build

      - name: Start services (hybrid mode)
        run: |
          # Mock OpenClaw for testing
          docker run -d --name mock-openclaw -p 18789:18789 \
            python:3.11 python -c "
            import asyncio
            import websockets
            async def echo(ws):
                async for msg in ws:
                    await ws.send(msg)
            asyncio.run(websockets.serve(echo, '0.0.0.0', 18789))
            "

          docker compose up -d
          sleep 10

      - name: Health checks
        run: |
          curl -f http://localhost:8090/health
          curl -f http://localhost:5180

      - name: Cleanup
        if: always()
        run: |
          docker compose down
          docker stop mock-openclaw || true
```

---

## 7. API/Code Changes

### 7.1 Discovery Service Updates

**New environment support:**
```python
# Add to OpenClawDetector.__init__
self.data_dir = Path(os.getenv("OPENCLAW_DATA_DIR", str(Path.home() / ".openclaw")))
self.gateway_url = os.getenv("OPENCLAW_GATEWAY_URL")  # Skip probe if set
```

**Skip probing when URL is configured:**
```python
async def detect(self) -> list[DiscoveryCandidate]:
    # If URL is explicitly configured, trust it
    if self.gateway_url:
        url = self.gateway_url
        candidate = DiscoveryCandidate(
            runtime_type="openclaw",
            discovery_method="environment",
            target={"url": url, "transport": "websocket"},
            confidence="high",
            status="configured",
            evidence=[f"URL configured via OPENCLAW_GATEWAY_URL: {url}"],
        )
        # Still probe to verify reachability
        probe = await self._probe_websocket(url, self.token)
        if probe["reachable"]:
            candidate.status = "reachable"
        return [candidate]

    # ... existing auto-discovery logic
```

### 7.2 Connection Manager Adaptations

**Add graceful fallback for file access:**
```python
async def get_session_history(self, session_key: str, limit: int = 50):
    """Get history with fallback to API if file access fails."""
    try:
        if self.session_access == "file":
            return await self._get_history_via_file(session_key, limit)
    except (FileNotFoundError, PermissionError) as e:
        logger.warning(f"File access failed, falling back to API: {e}")

    # Fallback to API
    return await self._get_history_via_api(session_key, limit)
```

### 7.3 Health Check Endpoint Enhancement

**Add OpenClaw connectivity check:**
```python
# backend/app/api/health.py
@router.get("/health")
async def health_check():
    status = {"status": "healthy", "checks": {}}

    # Database check
    status["checks"]["database"] = await check_database()

    # OpenClaw connectivity check
    try:
        conn = get_openclaw_connection()
        if conn and await conn.health_check():
            status["checks"]["openclaw"] = {"status": "connected"}
        else:
            status["checks"]["openclaw"] = {"status": "disconnected"}
    except Exception as e:
        status["checks"]["openclaw"] = {"status": "error", "message": str(e)}

    # Determine overall status
    if any(c.get("status") == "error" for c in status["checks"].values()):
        status["status"] = "degraded"

    return status
```

### 7.4 New Configuration Model

**File: `backend/app/core/config.py`**
```python
from pydantic_settings import BaseSettings
from typing import Optional

class OpenClawSettings(BaseSettings):
    gateway_url: str = "ws://127.0.0.1:18789"
    gateway_token: Optional[str] = None
    data_dir: str = "~/.openclaw"
    session_access: str = "file"  # file | api

    class Config:
        env_prefix = "OPENCLAW_"

    @property
    def resolved_data_dir(self) -> Path:
        return Path(self.data_dir).expanduser()

class Settings(BaseSettings):
    openclaw: OpenClawSettings = OpenClawSettings()
    # ... other settings

settings = Settings()
```

---

## 8. Testing Strategy

### 8.1 Local Docker Deployment Testing

**Test Matrix:**

| Scenario | OpenClaw | CrewHub | Test Command |
|----------|----------|---------|--------------|
| Native | Host | Host | `make dev` |
| Hybrid | Host | Docker | `docker compose up` |
| Full | Docker | Docker | `docker compose -f docker-compose.full.yml up` |

**Manual Test Checklist:**
```bash
# 1. Health endpoint
curl http://localhost:8090/health

# 2. WebSocket connectivity (via frontend)
# Open http://localhost:5180 and check agent status

# 3. Session list
curl http://localhost:8090/api/v1/connections/openclaw/sessions

# 4. Session history
curl http://localhost:8090/api/v1/connections/openclaw/sessions/{session_key}/history
```

### 8.2 Integration Tests

**File: `backend/tests/integration/test_docker_connectivity.py`**
```python
import pytest
import os

@pytest.mark.integration
class TestDockerConnectivity:

    @pytest.fixture
    def openclaw_url(self):
        return os.getenv("OPENCLAW_GATEWAY_URL", "ws://localhost:18789")

    async def test_websocket_connection(self, openclaw_url):
        """Test WebSocket connection to OpenClaw Gateway."""
        from app.services.connections.openclaw import OpenClawConnection

        conn = OpenClawConnection(
            connection_id="test",
            name="Test Connection",
            config={"url": openclaw_url}
        )

        connected = await conn.connect()
        assert connected, "Failed to connect to OpenClaw Gateway"

        await conn.disconnect()

    async def test_session_list(self, openclaw_url):
        """Test session list retrieval."""
        from app.services.connections.openclaw import OpenClawConnection

        conn = OpenClawConnection(
            connection_id="test",
            name="Test Connection",
            config={"url": openclaw_url}
        )

        await conn.connect()
        sessions = await conn.get_sessions()

        assert isinstance(sessions, list)
        await conn.disconnect()

    async def test_session_history_fallback(self):
        """Test session history with file/API fallback."""
        from app.services.connections.openclaw import OpenClawConnection

        # Force API mode (no file access)
        conn = OpenClawConnection(
            connection_id="test",
            name="Test Connection",
            config={"session_access": "api"}
        )

        await conn.connect()
        # This should use API, not file access
        history = await conn.get_session_history("agent:main:test:123")

        # Should gracefully handle missing session
        assert isinstance(history, list)
        await conn.disconnect()
```

### 8.3 Smoke Test Script

**File: `scripts/smoke-test.sh`**
```bash
#!/bin/bash
set -e

echo "🔍 Running smoke tests..."

# Test 1: Backend health
echo "  Testing backend health..."
if curl -sf http://localhost:8090/health > /dev/null; then
    echo "  ✅ Backend healthy"
else
    echo "  ❌ Backend unhealthy"
    exit 1
fi

# Test 2: Frontend accessible
echo "  Testing frontend..."
if curl -sf http://localhost:5180 > /dev/null; then
    echo "  ✅ Frontend accessible"
else
    echo "  ❌ Frontend not accessible"
    exit 1
fi

# Test 3: OpenClaw connection
echo "  Testing OpenClaw connection..."
HEALTH=$(curl -sf http://localhost:8090/health)
OPENCLAW_STATUS=$(echo "$HEALTH" | jq -r '.checks.openclaw.status')

if [ "$OPENCLAW_STATUS" == "connected" ]; then
    echo "  ✅ OpenClaw connected"
else
    echo "  ⚠️  OpenClaw: $OPENCLAW_STATUS"
fi

# Test 4: API endpoints
echo "  Testing API endpoints..."
if curl -sf http://localhost:8090/api/v1/connections > /dev/null; then
    echo "  ✅ API responding"
else
    echo "  ❌ API not responding"
    exit 1
fi

echo ""
echo "✅ All smoke tests passed!"
```

### 8.4 Migration Path for Existing Deployments

**For users upgrading from host-based to Docker:**

1. **Backup data:**
   ```bash
   cp -r ~/.openclaw ~/.openclaw.backup
   cp -r ./data ./data.backup
   ```

2. **Update environment:**
   ```bash
   # Add to .env
   OPENCLAW_DATA_DIR=/openclaw-data
   ```

3. **Update docker-compose.yml:**
   ```yaml
   volumes:
     - ~/.openclaw:/openclaw-data:ro
   ```

4. **Restart services:**
   ```bash
   docker compose down
   docker compose up -d
   ```

5. **Verify connectivity:**
   ```bash
   ./scripts/smoke-test.sh
   ```

---

## 9. Future Considerations

### 9.1 Session History API

OpenClaw may add a `sessions.history` API method in the future. When available:
- Remove file-based session reading
- Use pure API access
- Eliminate need for shared volume mounts

### 9.2 Kubernetes Deployment

For K8s deployment, consider:
- ConfigMaps for configuration
- Secrets for tokens
- PersistentVolumeClaims for data
- NetworkPolicies for security

### 9.3 Multi-Gateway Support

Future enhancement to connect to multiple OpenClaw instances:
- Load balancing across gateways
- Failover support
- Per-agent gateway routing

---

## 10. Summary & Recommendations

### Quick Start Commands

**Hybrid mode (recommended for development):**
```bash
# Start OpenClaw on host
openclaw gateway start

# Start CrewHub in Docker
docker compose up -d
```

**Full containerized mode:**
```bash
docker compose -f docker-compose.full.yml up -d
docker compose -f docker-compose.full.yml run --rm openclaw-cli onboard
```

### Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_GATEWAY_URL` | `ws://127.0.0.1:18789` | Gateway WebSocket URL |
| `OPENCLAW_GATEWAY_TOKEN` | (none) | Auth token |
| `OPENCLAW_DATA_DIR` | `~/.openclaw` | Data directory path |
| `OPENCLAW_SESSION_ACCESS` | `file` | Session history access mode |

### Implementation Priority

1. **High:** Environment variable configuration (Phase 1)
2. **High:** Docker Compose templates (Phase 2)
3. **Medium:** Documentation (Phase 3)
4. **Medium:** CI/CD integration (Phase 4)
5. **Low:** Session history API (when available)

---

*Document maintained by Ekinbot. Last updated: 2026-02-07*
