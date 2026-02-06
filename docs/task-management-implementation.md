# Task Management Implementation Plan

**Date:** 2026-02-06  
**Status:** Draft  
**Author:** Dev (Subagent Analysis)

---

## 1. Executive Summary

Dit document beschrijft de technische implementatie van vier nieuwe features voor CrewHub:

1. **Bot Context Injection** - Bots krijgen automatisch project context wanneer ze in een room worden toegewezen
2. **Task Board per Room** - Taken kunnen worden toegewezen aan rooms/bots met een visueel task board
3. **Project History** - Volledige log van alle taken en activiteiten per project
4. **Task Wall (3D)** - Lopende taken worden visueel weergegeven op een muur in de 3D room

---

## 2. Huidige Staat Analyse

### 2.1 Database Schema (Relevant)

Huidige tabellen in `database.py`:
- `rooms` - met `project_id`, `is_hq` columns (al geïmplementeerd)
- `projects` - met `name`, `description`, `folder_path`, `status`
- `agents` - met `default_room_id`
- `session_room_assignments` - handmatige session→room toewijzingen

**Ontbreekt:**
- `tasks` tabel (voor task board)
- `project_history` tabel (voor activity log)
- Bot context injection mechanisme

### 2.2 Backend Routes (Relevant)

- `/projects` - CRUD + `/projects/overview` voor HQ dashboard
- `/rooms/{id}/project` - project toewijzing aan room

**Ontbreekt:**
- `/tasks` routes
- `/projects/{id}/history` endpoint
- WebSocket context broadcast voor bots

### 2.3 Frontend Components (Relevant)

- `Room3D.tsx` - De 3D room component met hover/click interactie
- `RoomInfoPanel.tsx` - Het info panel wanneer je een room focust
- `RoomNameplate.tsx` - Toont project naam op nameplate
- `RoomWalls.tsx` - De muren van de room

**Ontbreekt:**
- Task board UI component
- Task Wall 3D visualisatie
- History panel/view

---

## 3. Database Schema Changes

### 3.1 Tasks Table

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',        -- todo | in_progress | review | done | cancelled
    priority TEXT DEFAULT 'normal',    -- low | normal | high | urgent
    
    -- Assignments
    project_id TEXT REFERENCES projects(id),
    room_id TEXT REFERENCES rooms(id),
    assigned_agent_id TEXT REFERENCES agents(id),
    created_by TEXT,                   -- agent_id or 'human'
    
    -- Metadata
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    tags TEXT,                         -- JSON array: ["frontend", "bug"]
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    due_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_room ON tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
```

### 3.2 Project History Table

```sql
CREATE TABLE IF NOT EXISTS project_history (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    
    -- Event details
    event_type TEXT NOT NULL,          -- task_created | task_completed | task_assigned |
                                       -- agent_joined | agent_left | status_changed |
                                       -- message | note
    event_data TEXT NOT NULL,          -- JSON blob with event-specific data
    
    -- Actor
    actor_type TEXT NOT NULL,          -- agent | human | system
    actor_id TEXT,                     -- agent_id or null for system
    
    -- References
    task_id TEXT REFERENCES tasks(id),
    room_id TEXT REFERENCES rooms(id),
    
    -- Timestamp
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_project ON project_history(project_id);
CREATE INDEX IF NOT EXISTS idx_history_task ON project_history(task_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON project_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_type ON project_history(event_type);
```

### 3.3 Schema Migration

Update `SCHEMA_VERSION` naar 9 en voeg migration toe in `init_database()`:

```python
# v9: Add tasks and project_history tables
try:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'normal',
            project_id TEXT REFERENCES projects(id),
            room_id TEXT REFERENCES rooms(id),
            assigned_agent_id TEXT REFERENCES agents(id),
            created_by TEXT,
            estimated_minutes INTEGER,
            actual_minutes INTEGER,
            tags TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            started_at INTEGER,
            completed_at INTEGER,
            due_at INTEGER
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS project_history (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id),
            event_type TEXT NOT NULL,
            event_data TEXT NOT NULL,
            actor_type TEXT NOT NULL,
            actor_id TEXT,
            task_id TEXT REFERENCES tasks(id),
            room_id TEXT REFERENCES rooms(id),
            created_at INTEGER NOT NULL
        )
    """)
except Exception:
    pass  # Tables already exist
```

---

## 4. Backend API Endpoints

### 4.1 Tasks CRUD (`routes/tasks.py`)

```python
# GET /tasks - List tasks (with filters)
# Query params: project_id, room_id, agent_id, status, limit, offset

# GET /tasks/{id} - Get single task

# POST /tasks - Create task
# Body: { title, description?, project_id?, room_id?, assigned_agent_id?, priority?, tags?, due_at? }

# PUT /tasks/{id} - Update task
# Body: { title?, description?, status?, priority?, assigned_agent_id?, ... }

# DELETE /tasks/{id} - Delete task (or mark cancelled?)

# POST /tasks/{id}/assign - Assign task to agent
# Body: { agent_id }

# POST /tasks/{id}/status - Update task status
# Body: { status, actual_minutes? }
```

### 4.2 Room Tasks Endpoint

```python
# GET /rooms/{id}/tasks - Get all tasks for a room
# Returns tasks where room_id matches OR project_id matches room's project
```

### 4.3 Project History Endpoints (`routes/projects.py` extension)

```python
# GET /projects/{id}/history - Get project activity log
# Query params: limit, offset, event_type, since

# POST /projects/{id}/history - Add manual note/event
# Body: { event_type: "note", event_data: { message: "..." } }
```

### 4.4 Pydantic Models (`models.py`)

```python
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    room_id: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    tags: Optional[List[str]] = None
    estimated_minutes: Optional[int] = None
    due_at: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["todo", "in_progress", "review", "done", "cancelled"]] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    assigned_agent_id: Optional[str] = None
    tags: Optional[List[str]] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    due_at: Optional[int] = None

class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    project_id: Optional[str]
    room_id: Optional[str]
    assigned_agent_id: Optional[str]
    assigned_agent_name: Optional[str]  # Joined
    created_by: Optional[str]
    estimated_minutes: Optional[int]
    actual_minutes: Optional[int]
    tags: List[str]
    created_at: int
    updated_at: int
    started_at: Optional[int]
    completed_at: Optional[int]
    due_at: Optional[int]

class ProjectHistoryEvent(BaseModel):
    id: str
    project_id: str
    event_type: str
    event_data: dict
    actor_type: str
    actor_id: Optional[str]
    actor_name: Optional[str]  # Joined
    task_id: Optional[str]
    room_id: Optional[str]
    created_at: int
```

### 4.5 SSE Events

Nieuwe SSE events voor real-time updates:
- `tasks-refresh` - Bij task CRUD operaties
- `history-update` - Bij nieuwe history events

---

## 5. Bot Context Injection

### 5.1 Mechanisme

Wanneer een bot (session) actief is in een room, moet de bot context ontvangen over:
1. Het project van de room
2. Actieve taken in de room
3. Taken toegewezen aan de specifieke bot

### 5.2 Context Data Structure

```json
{
  "room": {
    "id": "dev-room",
    "name": "Dev Room",
    "is_hq": false,
    "project": {
      "id": "proj-123",
      "name": "Website Redesign",
      "description": "Redesign the main website for Q2 launch",
      "folder_path": "~/Projects/website-redesign",
      "status": "active"
    }
  },
  "tasks": {
    "assigned_to_me": [
      {
        "id": "task-1",
        "title": "Fix mobile navigation",
        "priority": "high",
        "status": "in_progress"
      }
    ],
    "room_tasks": [
      {
        "id": "task-2",
        "title": "Add dark mode",
        "assigned_to": "reviewer",
        "status": "todo"
      }
    ]
  },
  "context_files": [
    "~/Projects/website-redesign/README.md",
    "~/Projects/website-redesign/docs/ARCHITECTURE.md"
  ]
}
```

### 5.3 API Endpoint for Context

```python
# GET /sessions/{session_key}/context
# Returns the full context object for a session based on its room assignment
```

### 5.4 OpenClaw Integration

OpenClaw moet deze context injecteren in de system prompt van de bot:

```python
# In OpenClaw session start:
context = await fetch_session_context(session_key)
if context["room"]["project"]:
    system_prompt += f"""
    
## Current Assignment
You are working in {context["room"]["name"]} on project: {context["room"]["project"]["name"]}
Project description: {context["room"]["project"]["description"]}
Project folder: {context["room"]["project"]["folder_path"]}

## Your Tasks
{format_tasks(context["tasks"]["assigned_to_me"])}

## Room Tasks
{format_tasks(context["tasks"]["room_tasks"])}
"""
```

---

## 6. Frontend Components

### 6.1 Task Board Component (`TaskBoard.tsx`)

Locatie: `frontend/src/components/world3d/TaskBoard.tsx`

```typescript
interface Task {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assigned_agent_id?: string
  assigned_agent_name?: string
  tags: string[]
  created_at: number
  due_at?: number
}

interface TaskBoardProps {
  roomId: string
  projectId?: string
  onTaskClick?: (task: Task) => void
  onCreateTask?: () => void
}
```

Kanban-style board met kolommen:
- **To Do** (todo)
- **In Progress** (in_progress)
- **Review** (review)
- **Done** (done)

Features:
- Drag & drop tussen kolommen (status change)
- Quick-create task met titel
- Filter op agent/priority
- Assign agent via dropdown
- Priority indicator (kleur/icon)

### 6.2 RoomInfoPanel Extension

Uitbreiden van `RoomInfoPanel.tsx` met task board sectie:

```typescript
// In RoomInfoPanel.tsx

<section className="tasks-section">
  <h3>📋 Tasks</h3>
  <TaskBoardMini 
    roomId={room.id}
    projectId={room.project_id}
    maxVisible={5}
  />
  <button onClick={() => openFullTaskBoard()}>
    View Full Board →
  </button>
</section>
```

### 6.3 Project History Panel (`ProjectHistoryPanel.tsx`)

Locatie: `frontend/src/components/world3d/ProjectHistoryPanel.tsx`

Timeline view van alle project events:

```typescript
interface HistoryPanelProps {
  projectId: string
  limit?: number
}

// Event types met icons:
const eventIcons = {
  task_created: '📝',
  task_completed: '✅',
  task_assigned: '👤',
  agent_joined: '🤖',
  agent_left: '👋',
  status_changed: '🔄',
  message: '💬',
  note: '📌',
}
```

### 6.4 Hooks

```typescript
// hooks/useTasks.ts
export function useTasks(filters?: { roomId?: string, projectId?: string, agentId?: string }) {
  // Fetch tasks with SSE updates
}

// hooks/useProjectHistory.ts  
export function useProjectHistory(projectId: string, limit?: number) {
  // Fetch history with SSE updates
}
```

---

## 7. Task Wall 3D Visualization

### 7.1 Concept

Een dedicated muurpaneel in elke room die lopende taken visualiseert. Vergelijkbaar met een fysiek kanban board of post-it muur.

### 7.2 Component (`TaskWall3D.tsx`)

Locatie: `frontend/src/components/world3d/TaskWall3D.tsx`

```typescript
interface TaskWall3DProps {
  tasks: Task[]
  position: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  height?: number
}
```

### 7.3 Visuele Elementen

```
┌─────────────────────────────────────────────┐
│  📋 TASK BOARD                              │
├──────────┬──────────┬──────────┬───────────┤
│ TODO (3) │ DOING(2) │ REVIEW(1)│ DONE (5)  │
├──────────┼──────────┼──────────┼───────────┤
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │           │
│ │Task 1│ │ │Task 4│ │ │Task 6│ │           │
│ │🔴high│ │ │🟡med │ │ │🟢low │ │           │
│ └──────┘ │ └──────┘ │ └──────┘ │           │
│ ┌──────┐ │ ┌──────┐ │          │           │
│ │Task 2│ │ │Task 5│ │          │           │
│ └──────┘ │ └──────┘ │          │           │
│ ┌──────┐ │          │          │           │
│ │Task 3│ │          │          │           │
│ └──────┘ │          │          │           │
└──────────┴──────────┴──────────┴───────────┘
```

### 7.4 Implementation Details

```typescript
import { Html, Text } from '@react-three/drei'
import * as THREE from 'three'

export function TaskWall3D({ tasks, position, width = 4, height = 2.5 }: TaskWall3DProps) {
  const columns = ['todo', 'in_progress', 'review', 'done']
  
  const tasksByStatus = useMemo(() => {
    return columns.reduce((acc, status) => {
      acc[status] = tasks.filter(t => t.status === status)
      return acc
    }, {} as Record<string, Task[]>)
  }, [tasks])
  
  return (
    <group position={position}>
      {/* Board backing */}
      <mesh position={[0, height/2, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      
      {/* Column headers */}
      {columns.map((col, i) => (
        <Text
          key={col}
          position={[colX(i, width), height - 0.2, 0.01]}
          fontSize={0.12}
          color="#94a3b8"
        >
          {col.toUpperCase()} ({tasksByStatus[col].length})
        </Text>
      ))}
      
      {/* Task cards */}
      {columns.map((col, colIdx) => (
        tasksByStatus[col].slice(0, 5).map((task, taskIdx) => (
          <TaskCard3D
            key={task.id}
            task={task}
            position={[colX(colIdx, width), height - 0.5 - taskIdx * 0.4, 0.02]}
          />
        ))
      ))}
    </group>
  )
}

function TaskCard3D({ task, position }: { task: Task, position: [number, number, number] }) {
  const priorityColor = {
    urgent: '#ef4444',
    high: '#f59e0b',
    normal: '#3b82f6',
    low: '#6b7280',
  }[task.priority]
  
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[0.8, 0.35]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      
      {/* Priority indicator */}
      <mesh position={[-0.35, 0, 0.01]}>
        <planeGeometry args={[0.04, 0.35]} />
        <meshStandardMaterial color={priorityColor} />
      </mesh>
      
      {/* Task title (using Html for text readability) */}
      <Html position={[0, 0, 0.02]} center>
        <div style={{
          width: '70px',
          fontSize: '8px',
          color: 'white',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          {task.title}
        </div>
      </Html>
    </group>
  )
}
```

### 7.5 Placement in Room

De Task Wall wordt geplaatst op een van de muren van de room. Beste positie: de muur tegenover de ingang, zodat het direct zichtbaar is bij binnenkomst.

In `Room3D.tsx`:

```typescript
// Add TaskWall3D to room when project is assigned
{room.project_id && (
  <TaskWall3D
    tasks={roomTasks}
    position={[0, 1.2, -size/2 + 0.1]}  // Back wall
    width={size * 0.6}
    height={2}
  />
)}
```

---

## 8. Implementation Phases

### Phase 1: Database & API Foundation (1 day)

| Task | Effort | Files |
|------|--------|-------|
| Add `tasks` table + migrations | 30m | `database.py` |
| Add `project_history` table + migrations | 30m | `database.py` |
| Create Pydantic models | 30m | `models.py` |
| Create `/tasks` CRUD routes | 2h | New: `routes/tasks.py` |
| Add history logging helper | 30m | `routes/tasks.py` |
| Add `/projects/{id}/history` endpoint | 1h | `routes/projects.py` |
| Add SSE events for tasks | 30m | `routes/sse.py` |

**Total: ~5.5 hours**

### Phase 2: Frontend Task Board (1-2 days)

| Task | Effort | Files |
|------|--------|-------|
| Create `useTasks` hook | 1h | New: `hooks/useTasks.ts` |
| Create `useProjectHistory` hook | 30m | New: `hooks/useProjectHistory.ts` |
| Build `TaskBoard.tsx` (kanban UI) | 3h | New: `TaskBoard.tsx` |
| Build `TaskBoardMini.tsx` (collapsed view) | 1h | New: `TaskBoardMini.tsx` |
| Integrate into `RoomInfoPanel.tsx` | 1h | `RoomInfoPanel.tsx` |
| Build `TaskCreateModal.tsx` | 1.5h | New: `TaskCreateModal.tsx` |
| Build `ProjectHistoryPanel.tsx` | 2h | New: `ProjectHistoryPanel.tsx` |

**Total: ~10 hours**

### Phase 3: Task Wall 3D (1 day)

| Task | Effort | Files |
|------|--------|-------|
| Create `TaskWall3D.tsx` component | 3h | New: `TaskWall3D.tsx` |
| Create `TaskCard3D.tsx` component | 1h | New: `TaskCard3D.tsx` |
| Integrate into `Room3D.tsx` | 1h | `Room3D.tsx` |
| Add hover/click interactions | 1h | `TaskWall3D.tsx` |
| Style & polish | 1h | Various |

**Total: ~7 hours**

### Phase 4: Bot Context Injection (1-2 days)

| Task | Effort | Files |
|------|--------|-------|
| Create `/sessions/{key}/context` endpoint | 2h | New: `routes/session_context.py` |
| Context builder with tasks + project | 1.5h | `routes/session_context.py` |
| OpenClaw integration: fetch context | 2h | OpenClaw side |
| OpenClaw integration: inject in prompt | 2h | OpenClaw side |
| Test with live sessions | 2h | Integration testing |

**Total: ~9.5 hours**

### Timeline Summary

| Phase | Effort | Days |
|-------|--------|------|
| 1 — Database & API | ~5.5h | 1 |
| 2 — Frontend Task Board | ~10h | 1-2 |
| 3 — Task Wall 3D | ~7h | 1 |
| 4 — Bot Context | ~9.5h | 1-2 |

**Total: ~32 hours / 5-7 working days**

---

## 9. Edge Cases & Decisions

| Question | Decision |
|----------|----------|
| Kan een taak zonder project/room bestaan? | **Ja**, voor ad-hoc taken. Verschijnt alleen in HQ task board. |
| Wat gebeurt bij room verwijdering met taken? | Tasks behouden `room_id` (orphaned), kunnen worden hertoewezen. |
| Kunnen meerdere agents aan één taak werken? | **Nee v1**, één `assigned_agent_id`. Later: collaborators array. |
| Hoe werkt task status update via bot? | Bot kan `/tasks/{id}/status` aanroepen. History event wordt gelogd. |
| Task Wall: hoeveel taken tonen? | Max 5 per kolom op de muur, "View all" link naar full board. |
| Task Wall: klikbaar? | **Ja**, klik opent taak detail in panel (niet 3D popup). |
| History retention? | Indefinite in v1. Later: configurable cleanup/archival. |
| Real-time updates? | SSE push voor task changes + history events. |

---

## 10. Files to Create/Modify

### New Files

**Backend:**
- `backend/app/routes/tasks.py` - Tasks CRUD routes
- `backend/app/routes/session_context.py` - Bot context endpoint

**Frontend:**
- `frontend/src/hooks/useTasks.ts` - Tasks data hook
- `frontend/src/hooks/useProjectHistory.ts` - History data hook
- `frontend/src/components/world3d/TaskBoard.tsx` - Full task board
- `frontend/src/components/world3d/TaskBoardMini.tsx` - Collapsed task board
- `frontend/src/components/world3d/TaskCreateModal.tsx` - Task creation form
- `frontend/src/components/world3d/ProjectHistoryPanel.tsx` - Activity log
- `frontend/src/components/world3d/TaskWall3D.tsx` - 3D task visualization
- `frontend/src/components/world3d/TaskCard3D.tsx` - Individual 3D task card

### Modified Files

**Backend:**
- `backend/app/db/database.py` - Schema changes
- `backend/app/db/models.py` - New Pydantic models
- `backend/app/routes/__init__.py` - Register new routes
- `backend/app/routes/projects.py` - Add history endpoint
- `backend/app/routes/sse.py` - New SSE events

**Frontend:**
- `frontend/src/components/world3d/Room3D.tsx` - Add TaskWall3D
- `frontend/src/components/world3d/RoomInfoPanel.tsx` - Add task board section
- `frontend/src/contexts/RoomsContext.tsx` - Possibly extend with tasks

---

## 11. API Summary

### Tasks
```
GET    /tasks                    # List tasks (filterable)
GET    /tasks/{id}               # Get task
POST   /tasks                    # Create task
PUT    /tasks/{id}               # Update task
DELETE /tasks/{id}               # Delete/cancel task
POST   /tasks/{id}/assign        # Assign to agent
POST   /tasks/{id}/status        # Update status
```

### Room Tasks
```
GET    /rooms/{id}/tasks         # Get room's tasks
```

### Project History
```
GET    /projects/{id}/history    # Get activity log
POST   /projects/{id}/history    # Add note/event
```

### Bot Context
```
GET    /sessions/{key}/context   # Get session context for bot
```

---

## 12. Next Steps

1. **Review dit plan met Nicky** - Prioriteiten en scope bevestigen
2. **Start Phase 1** - Database schema en API foundation
3. **Parallel: Design mockups** - UI wireframes voor task board
4. **OpenClaw integration planning** - Afstemmen hoe context injection werkt

---

*Document generated by Dev subagent, 2026-02-06*
