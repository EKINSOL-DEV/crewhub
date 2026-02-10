# 🚀 Crew Open-Source Analyse

**Datum:** 2 februari 2026  
**Context:** Nicky wil de Crew functionaliteit open-sourcen en betatesters betrekken. Rest van Ekinbot Planner blijft privé.

---

## 1. 📦 Scope voor Open-Source Crew App

### Core Functionaliteit (MVP voor Beta)
| Feature | Beschrijving | Prioriteit |
|---------|-------------|------------|
| **Session Dashboard** | Real-time view van alle OpenClaw agent sessions | P0 |
| **SSE/Polling** | Live updates via Server-Sent Events met polling fallback | P0 |
| **Session Cards** | Status, model, tokens, runtime per session | P0 |
| **Playground View** | Visuele grid layout voor sessions | P1 |
| **Log Viewer** | Bekijk chat history van een session | P1 |
| **Stats Header** | Active/idle counts, totale kosten, tokens | P1 |
| **Settings Panel** | View preferences, refresh interval | P2 |

### Expliciet NIET in scope (blijft privé in Ekinbot Planner)
- Task management / Kanban board
- Personas / Agent Registry
- Team Chat / Orchestrator
- Lijstjes, Documenten, Archief tabs
- User authentication / multi-user
- Ekinbot-specifieke business logic

---

## 2. 🎯 Aantrekkelijk Maken voor Betatesters/Contributors

### Waarom zouden mensen dit willen?
1. **OpenClaw monitoring** - Enige dedicated UI voor OpenClaw Gateway
2. **Real-time visibility** - Zie wat je agents doen
3. **Cost tracking** - Tokens en kosten per session
4. **Self-hosted** - Geen vendor lock-in
5. **Extensible** - Plugin-friendly architectuur

### Betatester Incentives
- 🏅 **Early Adopter badge** in README
- 📣 **Direct feedback channel** (Discord/GitHub Discussions)
- 🎁 **Input op roadmap** - betatesters bepalen priorities mee
- 🔧 **First look** aan nieuwe features

### Contributor Attractors
- 📚 **Goede docs** - CONTRIBUTING.md, Architecture doc
- 🏷️ **"Good first issue"** labels
- ⚡ **Quick wins** - Kleine PRs die direct merged worden
- 🤝 **Responsive maintainers** (snelle reviews)

---

## 3. 🏗️ Architectuur & Tech Stack

### Optie A: Full-Stack (Recommended voor MVP)
```
┌──────────────────────────────────────┐
│           Crew Dashboard             │
│  ┌─────────────┐  ┌───────────────┐  │
│  │   Frontend  │  │    Backend    │  │
│  │   (React)   │──│   (Python)    │  │
│  │  Vite/TS    │  │   FastAPI     │  │
│  └─────────────┘  └───────────────┘  │
│                      │               │
│                      ▼               │
│        ┌─────────────────────┐       │
│        │  OpenClaw Gateway   │       │
│        │    (WebSocket)      │       │
│        └─────────────────────┘       │
└──────────────────────────────────────┘
```

**Frontend:**
- React 18 + TypeScript
- Vite (fast builds)
- Tailwind CSS + shadcn/ui
- Radix UI primitives

**Backend:**
- Python 3.11+
- FastAPI (async)
- WebSocket client voor Gateway
- SSE endpoint voor frontend

**Waarom deze stack:**
- Zelfde stack als huidige implementatie → code extractie makkelijker
- Python populair voor AI tooling community
- FastAPI performant en modern
- shadcn/ui componenten zijn copy-paste → contributors hoeven geen library te leren

### Optie B: Frontend-Only (Simpler, maar beperkter)
- React app die direct met Gateway WebSocket praat
- Geen backend nodig
- Nadeel: moet Gateway CORS configureren, minder flexibel

**Aanbeveling: Optie A** - Backend geeft meer flexibiliteit en is al geïmplementeerd.

---

## 4. 🔌 OpenClaw Gateway Integratie

### Huidige Gateway API (te documenteren)
```python
# WebSocket connection
ws://localhost:18789

# Authentication
{"type": "auth", "token": "OPENCLAW_GATEWAY_TOKEN"}

# Get sessions
{"type": "sessions"}
# Response: {"type": "sessions", "sessions": [...]}

# Get session history
{"type": "history", "session": "agent:dev:main", "limit": 50}
# Response: {"type": "history", "messages": [...]}

# Session events (server push)
{"type": "session-created", ...}
{"type": "session-updated", ...}
{"type": "session-removed", ...}
```

### Wat te documenteren voor open-source:
1. **Gateway setup guide** - Hoe OpenClaw Gateway te starten
2. **Environment variables** - `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`
3. **Session data model** - Welke velden beschikbaar zijn
4. **Rate limits** - Indien van toepassing

### Potentieel issue: Gateway token exposure
- Crew backend houdt token server-side → veilig
- Frontend praat alleen met Crew backend, niet direct Gateway
- Token nooit in browser

---

## 5. 📛 Naam Suggesties

| Naam | Pros | Cons |
|------|------|------|
| **ClawCrew** | Duidelijke OpenClaw connectie, beschikbaar | Kan "Claw" trademark issues hebben |
| **OpenCrew** | Open-source vibe, clean | Generiek, veel projecten heten OpenX |
| **CrewDeck** | Dashboard connotatie, cool | Dekt niet volledige visie |
| **AgentCrew** | AI agent focus | Heel generiek |
| **CrewBoard** | Dashboard/board feeling | Meh |
| **Hive** | Colony/crew metafoor | Geen OpenClaw connectie |
| **OpenClaw Crew** | 100% duidelijk | Lang voor NPM/repo naam |

### Aanbeveling: **ClawCrew** of **OpenCrew**
- `clawcrew` → npm/pypi beschikbaar ✓
- `opencrew` → waarschijnlijk bezet
- GitHub: check `github.com/clawcrew` of `ekinsolbot/clawcrew`

---

## 6. 📋 Eerste Stappen

### Week 1: Setup
- [ ] GitHub repo aanmaken (public)
- [ ] Decide op naam (ClawCrew?)
- [ ] Basis project structuur
- [ ] LICENSE kiezen (MIT of Apache 2.0 aanbevolen)
- [ ] Eerste README.md

### Week 2: Code Extractie
- [ ] Extract relevante backend code uit Ekinbot Planner
- [ ] Extract relevante frontend componenten
- [ ] Remove Ekinbot-specifieke dependencies
- [ ] Standalone werkend krijgen

### Week 3: Polish
- [ ] Demo screenshots/GIF
- [ ] Installation docs
- [ ] CONTRIBUTING.md
- [ ] GitHub Actions voor CI
- [ ] Docker image

### Week 4: Beta Launch
- [ ] Announce op OpenClaw community (Discord?)
- [ ] Tweet/post over project
- [ ] Eerste betatesters verzamelen
- [ ] Feedback channel opzetten

---

## 7. 📄 Essential Files voor Open Source

### README.md Template
```markdown
# 🦀 ClawCrew

Real-time dashboard for monitoring your OpenClaw agent sessions.

![Screenshot](docs/screenshot.png)

## Features
- 🔴 Live session updates (SSE)
- 📊 Token & cost tracking
- 📜 Chat history viewer
- 🎨 Card & Playground views

## Quick Start
\`\`\`bash
# Clone
git clone https://github.com/ekinsolbot/clawcrew.git
cd clawcrew

# Configure
cp .env.example .env
# Edit .env with your Gateway URL and token

# Run with Docker
docker-compose up

# Or run locally
make dev
\`\`\`

## Requirements
- OpenClaw Gateway running
- Python 3.11+ (backend)
- Node.js 18+ (frontend)

## Documentation
- [Installation Guide](docs/installation.md)
- [Configuration](docs/configuration.md)
- [API Reference](docs/api.md)

## Contributing
PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

## License
MIT
```

### Licentie Keuze

| License | Pros | Cons |
|---------|------|------|
| **MIT** | Simpel, maximaal permissive | Geen patent bescherming |
| **Apache 2.0** | Patent grant, enterprise-friendly | Iets complexer |
| **GPL v3** | Copyleft, forks moeten ook open zijn | Minder aantrekkelijk voor bedrijven |

**Aanbeveling: MIT** - Meest open, laagste drempel voor adoption.

---

## 8. 🎯 Minimal Viable Scope voor Beta

### Must Have (Beta v0.1)
- [ ] Session list met status (active/idle/stopped)
- [ ] Real-time updates
- [ ] Basic stats (session count, total tokens)
- [ ] Docker deployment
- [ ] ENV config voor Gateway URL/token

### Nice to Have (v0.2+)
- [ ] Playground view
- [ ] Log viewer
- [ ] Cost estimation
- [ ] Session filtering
- [ ] Dark/light theme
- [ ] Mobile responsive

### Future (v1.0+)
- [ ] Session actions (cancel, restart)
- [ ] Custom dashboards
- [ ] Webhooks/notifications
- [ ] Multi-gateway support
- [ ] Plugin system

---

## 9. 🧹 Code te Extracten uit Ekinbot Planner

### Frontend (kan grotendeels 1:1)
```
frontend/src/components/minions/
├── ActiveMinionsView.tsx    ✓ extract
├── MinionCard.tsx           ✓ extract
├── StatsHeader.tsx          ✓ extract
├── EmptyState.tsx           ✓ extract
├── LogViewer.tsx            ✓ extract
├── PlaygroundView.tsx       ✓ extract
├── SettingsPanel.tsx        ✓ extract
└── MinionsTab.tsx           ✓ simplify (remove tabs)

frontend/src/hooks/
├── useMinionsStream.ts      ✓ extract

frontend/src/lib/
├── minionUtils.ts           ✓ extract
├── easterEggs.ts            ✓ extract (fun!)
```

### Backend (deels extracten)
```
backend/app/services/
├── gateway.py               ✓ extract (core)
├── minions.py               ✓ extract

backend/app/routes/
├── minions.py               ✓ extract
├── sse.py                   ✓ extract (SSE endpoint)
```

### Te verwijderen/refactoren
- Alle imports naar Kanban/Tasks/Personas
- Auth middleware (optioneel maken)
- Database dependencies (SQLAlchemy etc) - niet nodig voor pure Gateway monitoring
- Team chat references

---

## 10. 💭 Finale Aanbeveling

### Go/No-Go Checklist
- ✅ Duidelijke scope afgebakend
- ✅ Tech stack bekend en bewezen
- ✅ Code extractie is haalbaar (~40% van bestaande code)
- ✅ Gateway API is stabiel genoeg
- ⚠️ Check: Is OpenClaw team OK met een community tool?
- ⚠️ Check: Tijd/bandwidth voor maintenance?

### Mijn Aanbeveling
**Go! 🚀** - De Crew functionaliteit is:
1. Zelfstandig genoeg om te extracten
2. Waardevol voor OpenClaw community
3. Goede eerste open-source project

**Start klein:** Basic dashboard die sessions toont. Voeg features toe op basis van betatester feedback.

---

*Analyse door Ekinbot, 2 februari 2026*
