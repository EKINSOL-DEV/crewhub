# AI Meetings - Document Selector Improvements

> **Date:** 2026-02-13
> **Goal:** Fix + improve document selector based on user feedback
> **Strategy:** Opus implementation + GPT-5.2 review

---

## 🐛 Current Issue

**Markdown file selector is empty** - User cannot see any files from project.

**Root Cause:** Backend needs restart after code deployment. The `/markdown-files` endpoint was added but backend still running old code.

**Immediate Fix:** Restart backend → Test endpoint → Verify files appear

---

## 🎯 User Requirements (Voice Feedback)

### 1. **Backend Restart + Endpoint Verification**
- Restart backend to load new markdown-files endpoint
- Test: `GET /api/projects/{id}/markdown-files` should return list
- Verify frontend receives and renders files

### 2. **Better File Picker UI - Modal Dialog**
**Current:** Simple dropdown (hard to browse, no folder structure)

**New:** Modal dialog with file tree
```
┌─────────────────────────────────────────┐
│  Select Document from Project       ✕  │
├─────────────────────────────────────────┤
│  📁 CrewHub                             │
│    📁 features/                         │
│      📄 spatial-awareness-design.md     │
│      📄 bot-navigation-analysis.md      │
│    📁 releases/                         │
│      📄 v0.13.0-announcement.md         │
│      📄 v0.14.0-announcement.md         │
│    📁 zones/                            │
│      📄 creator-center-vision.md        │
│      📄 academy-vision.md               │
│    📄 CHANGELOG.md                      │
│    📄 brand-guidelines.md               │
│                                         │
│  Selected: releases/v0.14.0-announ...  │
│                                         │
│         ┌────────┐  ┌────────────┐      │
│         │ Cancel │  │   Select   │      │
│         └────────┘  └────────────┘      │
└─────────────────────────────────────────┘
```

**Features:**
- Expandable folder tree
- Shows full folder structure (not flat list)
- Search/filter files
- Preview selected file path
- Click to select

### 3. **Upload/Drag & Drop Support**
**Goal:** Can upload markdown file from local filesystem

**UI:**
```
┌─────────────────────────────────────────┐
│  Meeting Document                       │
├─────────────────────────────────────────┤
│  Choose from project:                   │
│  [Select document...] 📁                │
│                                         │
│  Or upload new:                         │
│  ┌───────────────────────────────────┐  │
│  │  Drag & drop .md file here        │  │
│  │  or click to browse                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Uploaded files save to:                │
│  {project}/meetings/YYYY-MM-DD/         │
└─────────────────────────────────────────┘
```

**Backend:**
- POST `/api/projects/{id}/upload-document`
- Accepts multipart/form-data
- Validates .md extension
- Saves to `{project}/meetings/{YYYY-MM-DD}/`
- Auto-creates meetings folder if not exists
- Returns file path

**Frontend:**
- Drag & drop zone component
- File input fallback
- Upload progress indicator
- After upload: auto-select uploaded file

### 4. **Topic Field: Textarea (5 lines)**
**Current:** Single-line text input

**New:** Textarea with 5 rows
```
Meeting Topic
┌─────────────────────────────────────────┐
│ Discuss Phase 4 features for markdown  │
│ viewer:                                 │
│ - Side-by-side mode                     │
│ - Search functionality                  │
│ - Favorites system                      │
└─────────────────────────────────────────┘
```

**Implementation:**
```tsx
<textarea
  rows={5}
  placeholder="What should we discuss?"
  className="w-full border rounded p-2"
/>
```

---

## 📦 Implementation Plan

### Phase 1: Fix Current Issues (30m)
**Tasks:**
1. Restart backend
2. Test `/markdown-files` endpoint
3. Verify frontend receives files
4. Debug if still issues

### Phase 2: Textarea Topic Field (15m)
**Tasks:**
1. Replace `<input>` with `<textarea rows={5}>`
2. Update styling
3. Test multi-line input
4. Verify works with meeting start

### Phase 3: File Tree Modal (2-3h)
**Tasks:**
1. Create `DocumentSelectorModal.tsx` component
2. Implement folder tree (recursive component)
3. Show/hide folders (expand/collapse)
4. File selection state
5. Search/filter functionality
6. Replace dropdown with "Select document..." button → opens modal
7. Test with nested folders

**Libraries to consider:**
- `react-tree-walker` or custom recursive component
- Icons from existing icon library

### Phase 4: Upload/Drag & Drop (2-3h)
**Backend:**
1. Create `POST /api/projects/{id}/upload-document`
2. Handle multipart file upload
3. Validate .md extension, file size (<5MB)
4. Save to `{project}/meetings/{YYYY-MM-DD}/`
5. Return file metadata

**Frontend:**
1. Create `DocumentUploadZone.tsx`
2. Implement drag & drop (HTML5 Drag API)
3. File input fallback
4. Upload via fetch to backend
5. Progress indicator
6. Auto-select after upload
7. Error handling

**File organization:**
```
~/SynologyDrive/ekinbot/01-Projects/
  CrewHub/
    meetings/
      2026-02-13/
        discussion-phase4.md
        brainstorm-notes.md
      2026-02-14/
        standup-summary.md
```

---

## 🔍 Technical Decisions

### 1. File Tree Implementation
**Option A:** Recursive React component
```tsx
const FolderNode = ({ folder }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div onClick={() => setExpanded(!expanded)}>
        {expanded ? '📂' : '📁'} {folder.name}
      </div>
      {expanded && folder.children.map(child =>
        child.type === 'folder'
          ? <FolderNode folder={child} />
          : <FileNode file={child} />
      )}
    </div>
  );
};
```

**Option B:** Use library (react-complex-tree, etc.)

**Recommendation:** Option A (more control, lighter weight)

### 2. Backend File Structure
**Endpoint should return tree structure:**
```json
{
  "tree": {
    "name": "CrewHub",
    "type": "folder",
    "children": [
      {
        "name": "features",
        "type": "folder",
        "children": [
          {
            "name": "spatial-awareness-design.md",
            "type": "file",
            "path": "features/spatial-awareness-design.md"
          }
        ]
      },
      {
        "name": "CHANGELOG.md",
        "type": "file",
        "path": "CHANGELOG.md"
      }
    ]
  }
}
```

**OR keep flat list + parse folders in frontend?**

**Recommendation:** Backend returns tree structure (easier for frontend)

### 3. Upload File Naming
**Auto-generate unique names?**
- User uploads "notes.md"
- Backend saves as "notes.md" or "notes-1.md" if exists?

**Recommendation:** Keep original name, add suffix if conflict

### 4. Uploaded Files Persistence
Files saved to `{project}/meetings/{date}/` persist:
- ✅ Available for future meetings
- ✅ Can browse in file picker
- ✅ Part of project documentation
- ✅ Backed up via Synology Drive

---

## 🧪 Testing Checklist

### Phase 1: Endpoint Fix
- [ ] Backend restarts successfully
- [ ] `GET /markdown-files` returns file list
- [ ] Frontend dropdown populates
- [ ] Can select file
- [ ] Meeting starts with document

### Phase 2: Textarea
- [ ] Topic field shows 5 rows
- [ ] Can type multi-line text
- [ ] Text preserved in meeting
- [ ] Styling consistent with theme

### Phase 3: File Tree Modal
- [ ] Modal opens when clicking "Select document"
- [ ] Shows folder structure
- [ ] Can expand/collapse folders
- [ ] Can select file
- [ ] Search filters correctly
- [ ] Selected file path shown
- [ ] Modal closes on select/cancel

### Phase 4: Upload
- [ ] Drag & drop works
- [ ] File input fallback works
- [ ] Upload progress shows
- [ ] File saved to correct path
- [ ] Meetings folder auto-created
- [ ] Uploaded file appears in tree
- [ ] Can select uploaded file
- [ ] Meeting uses uploaded document

---

## 📁 Files to Create/Modify

**Backend:**
- `backend/app/routes/projects.py`
  - Fix/verify markdown-files endpoint
  - Modify to return tree structure (not flat list)
  - Add upload-document endpoint

**Frontend:**
- `frontend/src/components/meetings/MeetingDialog.tsx`
  - Replace topic input with textarea
  - Replace dropdown with modal button
  - Add upload zone

- `frontend/src/components/meetings/DocumentSelectorModal.tsx` (NEW)
  - Modal component
  - File tree rendering
  - Search functionality

- `frontend/src/components/meetings/DocumentUploadZone.tsx` (NEW)
  - Drag & drop zone
  - File upload logic

- `frontend/src/components/meetings/FolderTreeNode.tsx` (NEW)
  - Recursive folder/file component
  - Expand/collapse logic

---

## 🚀 Success Criteria

**Phase 1 Success:**
- Dropdown shows markdown files from project
- Can select and use in meeting

**Phase 2 Success:**
- Topic field is textarea with 5 lines
- Multi-line input works smoothly

**Phase 3 Success:**
- File tree modal shows nested folders
- Easy to browse and select files
- Better UX than dropdown

**Phase 4 Success:**
- Can drag .md file onto zone → uploads
- File saved to meetings folder
- Can use uploaded file in meeting
- Files persist for future use

---

## 💡 Future Enhancements (Phase 5+)

1. **Rich text editor** for topic field (markdown support)
2. **File preview** in modal (show first few lines)
3. **Recent documents** quick access
4. **Favorites** system
5. **Templates** - pre-filled meeting documents
6. **Multi-file selection** - attach multiple docs
7. **Document versioning** - track changes
8. **Collaborative editing** - edit doc during meeting

---

**Next:** Spawn dev agent for all 4 phases! 🎯
