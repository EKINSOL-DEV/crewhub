# CrewHub Security Hardening Plan

**Version:** 1.0
**Date:** 2026-02-09
**Status:** Draft — Pending Security Review
**Author:** Ekinbot (Opus)

---

## Executive Summary

CrewHub is designed for local development by default and ships with no user authentication. When deployed to a remote server (VPS, cloud instance, etc.), additional security hardening is required. This plan addresses four security layers: token management, user authentication, transport security, and container hardening. The design preserves the simple `make dev` local workflow while enforcing authentication on remote deployments.

---

## Current State

| Area | Status | Risk |
|------|--------|------|
| UI Authentication | ❌ None — anyone can access | **Critical** |
| OpenClaw Token | ⚠️ Plaintext in `~/.openclaw/openclaw.json` | High |
| Transport | ❌ HTTP only | High |
| Firewall | ❌ All ports exposed | High |
| API Auth | ✅ API key system exists (`X-API-Key` header) | OK |
| Container security | ⚠️ Runs as root | Medium |

**Key insight:** The backend already has a full API key system with scopes (read/self/manage/admin) via `app/auth.py`. The gap is that the **web UI** doesn't require any authentication — it makes API calls without an `X-API-Key` header, and all routes marked `PUBLIC_PATHS` (including SSE, all frontend-facing routes) are wide open.

---

## Phase 1: Token Management

**Goal:** Remove plaintext OpenClaw gateway token from config files and git history.

### Design

```
┌─────────────────┐     ┌──────────────────────┐
│  .env (gitignored) │ ──→ │ docker-compose.yml    │
│  OPENCLAW_GATEWAY_ │     │ environment:           │
│  TOKEN=ocl_xxx     │     │   - OPENCLAW_GATEWAY_  │
│                    │     │     TOKEN=${...}        │
└─────────────────┘     └──────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ app/config.py    │
                     │ Settings(        │
                     │   openclaw_      │
                     │   gateway_token) │
                     └─────────────────┘
```

**This is already partially done.** `docker-compose.yml` already reads `OPENCLAW_GATEWAY_TOKEN` from env. `config.py` already loads it from environment via Pydantic.

### Changes Required

| File | Change |
|------|--------|
| `.env.example` | Create with placeholder values |
| `.env` | Create on VPS (gitignored) |
| `.gitignore` | Ensure `.env` is listed (not `.env.example`) |
| `README.md` | Document env var setup |
| VPS `~/.openclaw/openclaw.json` | Remove `token` field after migration |

### `.env.example`

```env
# CrewHub Environment Configuration
# Copy to .env and fill in values

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789
OPENCLAW_GATEWAY_TOKEN=

# CrewHub Auth (Phase 2)
CREWHUB_AUTH_ENABLED=auto
CREWHUB_ADMIN_PASSWORD=
CREWHUB_JWT_SECRET=

# Database
CREWHUB_DB_PATH=/data/crewhub.db
```

### Migration

1. Copy token from `~/.openclaw/openclaw.json` to `.env`
2. Restart containers: `make prod-rebuild`
3. Verify gateway connects (check logs)
4. Remove token from `openclaw.json` (optional — backend reads from env first)

---

## Phase 2: User Authentication for Web UI

**Goal:** Require login for the CrewHub web UI on remote deployments. No auth for localhost.

### Architecture

```
┌─────────────┐    POST /api/auth/login     ┌──────────────┐
│  Login Page  │ ──────────────────────────→ │   Backend     │
│  (React)     │                              │               │
│              │ ←─── Set-Cookie: session=JWT │  Verify pwd   │
│              │                              │  Issue JWT     │
└─────────────┘                              └──────────────┘
       │                                            │
       │  Subsequent requests                       │
       │  Cookie: session=<jwt>                     │
       ▼                                            ▼
┌─────────────┐    X-API-Key OR Cookie       ┌──────────────┐
│  CrewHub UI  │ ──────────────────────────→ │  Auth Middle- │
│              │                              │  ware         │
│              │ ←─── 200 OK / 401           │  (existing +  │
└─────────────┘                              │   cookie JWT) │
                                             └──────────────┘
```

### Auth Mode Detection

```python
# app/config.py additions
class Settings(BaseSettings):
    # ... existing ...

    # Auth: "auto" | "on" | "off"
    # auto = enabled when not localhost/127.0.0.1/private IP
    crewhub_auth_enabled: str = "auto"
    crewhub_admin_password: str = ""  # bcrypt hash or plaintext (hashed on first use)
    crewhub_jwt_secret: str = ""      # auto-generated if empty
```

**Auto-detection logic:**

```python
def is_auth_required(request: Request) -> bool:
    if settings.crewhub_auth_enabled == "off":
        return False
    if settings.crewhub_auth_enabled == "on":
        return True
    # "auto" mode: check if request is from localhost
    host = request.headers.get("host", "").split(":")[0]
    return host not in ("localhost", "127.0.0.1", "ekinbot.local")
```

> **Note:** Auto-detection uses the `Host` header, not the client IP. This is simpler and works behind reverse proxies. Local dev uses `localhost:8091`, remote deployments use a public IP or domain name.

### Backend Changes

#### New: `POST /api/auth/login`

```python
@router.post("/api/auth/login")
async def login(body: LoginRequest):
    if not verify_password(body.password, settings.crewhub_admin_password):
        raise HTTPException(401, "Invalid credentials")

    token = create_jwt({"sub": "admin", "iat": now, "exp": now + 86400})
    response = JSONResponse({"ok": True})
    response.set_cookie(
        "crewhub_session", token,
        httponly=True, secure=is_https, samesite="lax",
        max_age=86400,  # 24h
    )
    return response
```

#### New: `GET /api/auth/status`

```python
@router.get("/api/auth/status")
async def auth_status(request: Request):
    """Returns whether auth is required and if user is authenticated."""
    required = is_auth_required(request)
    authenticated = False
    if required:
        authenticated = validate_session_cookie(request) is not None
    return {"auth_required": required, "authenticated": authenticated or not required}
```

#### Modified: Auth Middleware

Extend `get_current_key()` to also accept JWT session cookies:

```python
async def get_current_key(request, api_key=...):
    # Existing API key logic ...

    # NEW: Also check session cookie for UI auth
    if not api_key:
        cookie = request.cookies.get("crewhub_session")
        if cookie:
            payload = verify_jwt(cookie)
            if payload:
                # Return a synthetic admin key info
                return APIKeyInfo(
                    key_id="session",
                    name="Web Session",
                    scopes=["read", "self", "manage", "admin"],
                )

    # For non-public paths: check if auth is required
    if not _is_public(path) and is_auth_required(request):
        raise HTTPException(401, "Authentication required")

    return None  # Public path, no auth needed
```

#### Password Storage

Single admin password. Stored as bcrypt hash in env or DB.

**First-run flow:**
1. If `CREWHUB_ADMIN_PASSWORD` is set and not bcrypt-prefixed → hash it, store hash in DB
2. If `CREWHUB_ADMIN_PASSWORD` is empty → generate random password, print to stdout on first startup, store hash in DB
3. On subsequent starts → use hash from DB

```
[CrewHub] ⚠️  No admin password configured.
[CrewHub] Generated admin password: xK9m2pL4qR7n
[CrewHub] Set CREWHUB_ADMIN_PASSWORD in .env to use your own.
```

### Frontend Changes

#### New: `LoginPage.tsx`

Minimal login form — password only (single admin user).

```
┌────────────────────────────┐
│                            │
│        🔒 CrewHub          │
│                            │
│   ┌──────────────────┐    │
│   │ Password          │    │
│   └──────────────────┘    │
│                            │
│   [ Login ]                │
│                            │
└────────────────────────────┘
```

#### Auth Flow

```typescript
// src/lib/auth.ts
export async function checkAuth(): Promise<{required: boolean, authenticated: boolean}> {
  const res = await fetch('/api/auth/status')
  return res.json()
}

// src/App.tsx — wrap existing app
function App() {
  const [authState, setAuthState] = useState<'loading' | 'login' | 'ready'>('loading')

  useEffect(() => {
    checkAuth().then(({required, authenticated}) => {
      if (!required || authenticated) setAuthState('ready')
      else setAuthState('login')
    })
  }, [])

  if (authState === 'loading') return <LoadingSpinner />
  if (authState === 'login') return <LoginPage onSuccess={() => setAuthState('ready')} />
  return <MainApp />
}
```

### Public Paths Update

These paths must remain public (no auth) even in remote mode:

```python
PUBLIC_PATHS = {
    "/health",
    "/api/auth/login",
    "/api/auth/status",
    "/api/auth/logout",
    "/api/discovery/manifest",  # keep for agent discovery
}
```

All other `/api/*` routes and the SSE endpoint require auth (API key or session cookie).

The static frontend files (served by nginx) are always accessible — auth is enforced at the API layer. The frontend redirects to login if `/api/auth/status` says auth is required.

---

## Phase 3: HTTPS & Networking

**Goal:** Encrypt traffic and restrict network access on VPS.

### 3A: Nginx Reverse Proxy with SSL

```
┌─────────┐     HTTPS :443      ┌─────────┐     HTTP :8446    ┌──────────┐
│ Browser  │ ──────────────────→ │  Nginx   │ ───────────────→ │ Frontend │
│          │                     │  (SSL)   │                  │ Container│
└─────────┘                     │          │     HTTP :8090    ├──────────┤
                                │          │ ───────────────→ │ Backend  │
                                └─────────┘                  │ Container│
                                                             └──────────┘
```

#### Nginx Config (`/etc/nginx/sites-available/crewhub`)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;  # or use IP-based config

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:8446;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE (needs long timeouts)
    location /events {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

#### SSL Setup Steps

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate (requires DNS pointing to your server)
certbot --nginx -d your-domain.com

# Auto-renewal (certbot adds cron automatically)
certbot renew --dry-run
```

**Alternative (IP-only, no domain):** Use self-signed cert or Caddy with automatic HTTPS.

### 3B: Firewall (ufw)

```bash
# Reset and set defaults
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp

# Allow HTTPS only (not HTTP after redirect is working)
ufw allow 443/tcp
ufw allow 80/tcp   # for Let's Encrypt + redirect

# Allow OpenClaw gateway from localhost only (containers)
# No external access to 8090, 8446, 18789

ufw enable
```

**Result:** Only ports 22 (SSH), 80 (redirect), 443 (HTTPS) are externally accessible.

### 3C: Docker Network Binding

Update `docker-compose.prod.yml` to bind to localhost only:

```yaml
services:
  backend:
    ports:
      - "127.0.0.1:8090:8090"  # Only accessible via nginx
  frontend:
    ports:
      - "127.0.0.1:8446:80"    # Only accessible via nginx
```

---

## Phase 4: Docker Security

### 4A: Non-root User

**Backend Dockerfile addition:**

```dockerfile
RUN addgroup --system crewhub && adduser --system --ingroup crewhub crewhub
RUN chown -R crewhub:crewhub /app /data
USER crewhub
```

**Frontend (nginx) Dockerfile:** Use `nginx-unprivileged` base image or keep nginx as root (standard practice for port 80 binding inside container).

### 4B: Read-only Filesystem

```yaml
# docker-compose.prod.yml
services:
  backend:
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - ~/.crewhub:/data  # writable for DB
  frontend:
    read_only: true
    tmpfs:
      - /tmp
      - /var/cache/nginx
      - /var/run
```

### 4C: Security Options

```yaml
services:
  backend:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

---

## Implementation Checklist

### Phase 1: Token Management (Est. 1 hour)

- [ ] Create `.env.example` at repo root
- [ ] Add `.env` to `.gitignore`
- [ ] Create `.env` on VPS with actual token
- [ ] Verify `docker-compose.prod.yml` reads from env (already done)
- [ ] Update README with env setup instructions
- [ ] Test: `make prod-rebuild` on VPS, verify gateway connection

### Phase 2: CrewHub Authentication (Est. 4-6 hours)

**Backend:**
- [ ] Add settings to `app/config.py`: `crewhub_auth_enabled`, `crewhub_admin_password`, `crewhub_jwt_secret`
- [ ] Create `app/auth_session.py`: JWT creation/verification, password hashing, auto-detection logic
- [ ] Create `app/routes/auth_web.py`: `/api/auth/login`, `/api/auth/status`, `/api/auth/logout`
- [ ] Modify `app/auth.py`: extend `get_current_key()` to accept session cookies
- [ ] Update `PUBLIC_PATHS` to include auth endpoints
- [ ] Add `CREWHUB_ADMIN_PASSWORD` to `.env.example`
- [ ] Write tests: `tests/test_auth_web.py`

**Frontend:**
- [ ] Create `src/lib/auth.ts`: `checkAuth()`, `login()`, `logout()`
- [ ] Create `src/components/LoginPage.tsx`
- [ ] Modify `src/App.tsx`: wrap with auth gate
- [ ] Add logout button to settings/header

### Phase 3: HTTPS & Networking (Est. 2-3 hours)

- [ ] Set up DNS record: `your-domain.com` → `your-server-ip`
- [ ] Install nginx on VPS
- [ ] Create nginx config (see above)
- [ ] Run certbot for SSL
- [ ] Configure ufw firewall rules
- [ ] Update `docker-compose.prod.yml`: bind ports to `127.0.0.1`
- [ ] Update `VITE_API_URL` build arg (or remove — use relative URLs via nginx)
- [ ] Test: HTTPS access, HTTP redirect, SSE through proxy

### Phase 4: Docker Security (Est. 1 hour)

- [ ] Add non-root user to backend Dockerfile
- [ ] Add `read_only`, `security_opt`, `cap_drop` to compose
- [ ] Test: full prod stack with security hardening
- [ ] Verify DB writes still work with non-root user

---

## Migration Guide

### For Remote Deployment

```bash
# 1. SSH into your server
ssh user@your-server.com

# 2. Pull latest code
cd /path/to/crewhub
git pull

# 3. Create .env from example
cp .env.example .env

# 4. Fill in values
nano .env
# Set OPENCLAW_GATEWAY_TOKEN=<your-token>
# Set CREWHUB_ADMIN_PASSWORD=<choose-a-password>
# Set CREWHUB_JWT_SECRET=<random-string: openssl rand -hex 32>

# 5. Install and configure nginx + SSL
apt install nginx certbot python3-certbot-nginx
cp docs/nginx/crewhub.conf /etc/nginx/sites-available/crewhub
ln -s /etc/nginx/sites-available/crewhub /etc/nginx/sites-enabled/
certbot --nginx -d your-domain.com
nginx -t && systemctl reload nginx

# 6. Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw enable

# 7. Rebuild containers
make prod-rebuild

# 8. Verify
curl -k https://your-domain.com/health
curl -k https://your-domain.com/api/auth/status
```

### For Local Dev (No Changes Needed)

`make dev` continues to work unchanged. Auth auto-detection returns `auth_required: false` for localhost.

---

## Security Audit Checklist

### Authentication
- [ ] Cannot access `/api/sessions` without auth from remote IP
- [ ] Cannot access `/api/agents` without auth from remote IP
- [ ] SSE `/events` requires auth from remote IP
- [ ] Login with wrong password returns 401
- [ ] Login with correct password sets httpOnly cookie
- [ ] Cookie has `Secure` flag when served over HTTPS
- [ ] JWT expires after 24h
- [ ] Logout clears cookie
- [ ] Local dev (`localhost`) works without auth

### Token Management
- [ ] `.env` is in `.gitignore`
- [ ] No tokens in `docker-compose*.yml`
- [ ] No tokens in git history (or history rewritten)
- [ ] `OPENCLAW_GATEWAY_TOKEN` env var works in containers

### Network
- [ ] Only ports 22, 80, 443 are externally accessible (`nmap` scan)
- [ ] HTTP redirects to HTTPS
- [ ] Backend port 8090 not accessible externally
- [ ] Frontend port 8446 not accessible externally
- [ ] HSTS header present
- [ ] SSL Labs test: A or A+ rating

### Docker
- [ ] Containers run as non-root user
- [ ] `no-new-privileges` is set
- [ ] All capabilities dropped
- [ ] Read-only filesystem (except data volume)

### General
- [ ] No sensitive data in container logs
- [ ] Error messages don't leak internal details
- [ ] Rate limiting on login endpoint (consider adding)
- [ ] CORS configured correctly for production domain

---

## Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| Password-only login (no username) | Single admin user. Simpler UX. Can add multi-user later. |
| JWT in httpOnly cookie | XSS-safe. Works seamlessly with browser requests and SSE. |
| Auto-detect auth via Host header | Zero config for local dev. Reliable behind reverse proxy. |
| Nginx reverse proxy (not Caddy/Traefik) | Widely understood, easy to configure, already standard. |
| bcrypt for password hashing | Industry standard. Resistant to brute force. |
| 24h session expiry | Balance between security and convenience. |
| Phase ordering (1→2→3→4) | Each phase is independently deployable and valuable. |

---

## Future Considerations (Out of Scope)

- **Multi-user support:** Multiple admin accounts with different roles
- **OAuth/SSO:** GitHub or Google login
- **2FA/TOTP:** For admin accounts
- **API rate limiting:** Per-key and per-IP rate limits
- **Audit logging:** Track all auth events
- **Automatic token rotation:** For OpenClaw gateway token
- **VPN alternative:** WireGuard instead of public HTTPS
