# CrewHub Skill

CrewHub is een real-time dashboard voor AI agent orchestration. Als je in een CrewHub-managed omgeving werkt, gebruik deze instructies.

## Concepten

### Rooms
- Werkruimtes waar agents aan projecten werken
- Elk room kan een project hebben
- HQ (Headquarters) is de command center met overzicht van alle projecten

### Projects
- Gekoppeld aan rooms
- Bevatten tasks en history

### Tasks
- Todo items binnen een project
- Statussen: todo, in_progress, review, done, blocked
- Priorities: low, medium, high, urgent

## API Endpoints

### Je Context Ophalen
```bash
curl http://localhost:8090/api/sessions/{session_key}/context
```

### Tasks

#### List tasks
```bash
curl http://localhost:8090/api/tasks?project_id={id}
```

#### Create task
```bash
curl -X POST http://localhost:8090/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"project_id": "...", "title": "...", "description": "...", "priority": "medium"}'
```

#### Update task status
```bash
curl -X PATCH http://localhost:8090/api/tasks/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

### Rooms
```bash
# List rooms
curl http://localhost:8090/api/rooms

# Get room
curl http://localhost:8090/api/rooms/{id}
```

### Projects
```bash
# List projects
curl http://localhost:8090/api/projects

# Create project
curl -X POST http://localhost:8090/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "...", "description": "..."}'

# Assign project to room
curl -X PATCH http://localhost:8090/api/rooms/{room_id} \
  -H "Content-Type: application/json" \
  -d '{"project_id": "..."}'
```

## Workflow Voorbeelden

### "Werk in de Creative Room"
1. Check je huidige context
2. Als je niet in Creative Room zit, vraag om reassignment
3. Haal project tasks op
4. Pak een task en zet status naar in_progress
5. Werk aan de task
6. Update status naar done

### "Voeg een project toe aan Dev Room"
1. Maak een project aan
2. Haal Dev Room id op
3. Update room met project_id

### "Gebruik sub-agents"
1. Spawn sub-agent met sessions_spawn
2. Sub-agent krijgt automatisch room context via CrewHub
3. Monitor via CrewHub dashboard

## Environment
- Backend: http://localhost:8090 (of via CREWHUB_API_URL env var)
- Session key: beschikbaar in je context of via OpenClaw
