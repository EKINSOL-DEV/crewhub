# AI Meetings UX Improvements Review (Phase 1+2)

## Summary
**Overall assessment: Good**

Phase 1+2 delivers clear UX improvements and keeps the flow incremental and practical. The Meeting dialog is simpler, participant defaults now match expected user behavior, and document-based context is integrated end-to-end. The main concern is filesystem security hardening around document path checks, plus a few UX/error-handling gaps before Phase 3.

## Strengths
- Renaming from **Stand-Up Meeting** to **Meeting** is applied consistently in the user-facing flow (dialog, progress labels, table tooltip, etc.).
- Participant selection defaulting to empty is a good UX correction; min-2 validation remains in place and works.
- Single topic field reduces cognitive load compared to multi-topic setup.
- Document support is integrated through the stack:
  - Frontend selector hook + optional additional context
  - Backend markdown file listing endpoint
  - Orchestrator prompt injection
- Guardrails exist for document handling:
  - File size cap (1MB)
  - Content truncation at 12k chars to protect token budget
  - Hidden folder and `node_modules` filtering during file scan
- Backward compatibility is preserved: meetings without document config still execute normally.

## Issues Found
### Critical
- **Path containment check is vulnerable to prefix-matching bypass** in both markdown listing and document loading.
  - Current check uses string `startswith()` on resolved paths.
  - Example class of bypass: sibling paths with same prefix (`/base/proj` vs `/base/proj-evil`) can pass string checks.
  - This is especially risky with symlinks.
  - **Fix:** use `Path.is_relative_to(base)` (or equivalent robust parent-chain check), not string prefix matching.

### Medium Priority
- **Project folder trust boundary is too open** for `/markdown-files` and document loading.
  - If `project.folder_path` points outside expected workspace roots, API may enumerate/read markdown files outside intended project areas.
  - **Fix:** enforce allowed roots (e.g., Synology project base + configured project base), reject others.

- **No explicit user feedback for document load failure after selection** (deleted/moved file, unreadable file, too large).
  - Backend silently drops document context and continues meeting.
  - **Fix:** return/emit a warning in meeting status/events and surface non-blocking UI notice.

- **No explicit UX state for "no markdown files found"**.
  - Dropdown just appears empty; users may think loading failed.
  - **Fix:** show helper text like “No .md files found in this project folder.”

- **Async endpoints perform blocking filesystem ops** (`rglob`, `stat`, `read_text`) on event loop.
  - Usually fine for small sets, but can stall under larger trees/concurrency.
  - **Fix:** move file scanning/reading to `asyncio.to_thread()` or bounded worker utility.

- **Meeting naming cleanup is incomplete in fallback synthesis path**.
  - Fallback still emits `# Stand-Up Meeting — ...`.
  - **Fix:** update fallback template to `Meeting` for consistency.

### Low Priority / Nice-to-have
- `useProjectMarkdownFiles` captures `error` but MeetingDialog does not display it.
- Document selector would benefit from filename search/filter when file list grows.
- Add server-side/file-scan tests for new endpoint and doc injection edge cases (currently coverage appears limited for this feature slice).
- Consider showing file metadata in selector (size/modified date) for better document choice confidence.

## Recommendations
1. Replace all path containment checks with robust path ancestry checks (`Path.resolve()` + `is_relative_to`).
2. Enforce allowlisted project roots for both markdown listing and document read paths.
3. Add explicit warning propagation when selected documents cannot be loaded (deleted/oversize/read errors).
4. Improve empty/error states in document selector UI (no files, fetch failed, no project selected).
5. Offload filesystem scanning and reads from event loop to thread executor for better scalability.
6. Patch remaining naming inconsistency in fallback synthesis output.
7. Add focused tests for:
   - path traversal/symlink escape attempts
   - no-files case
   - deleted file after selection
   - oversized file behavior

## UX Notes
- The single topic field is a clear usability win and likely faster for real users.
- Additional context textarea wording is good and understandable.
- Current selector flow is usable, but confidence could be improved with stronger empty/error messaging.
- Keeping document attachment optional is the right product decision for backward compatibility and speed.

## Conclusion
**Ready for Phase 3 after targeted fixes**, not a rewrite.

The feature direction is strong and implementation quality is generally solid, but I recommend fixing the path security checks before broader rollout. The remaining UX/performance items are medium polish and reliability improvements that can be done quickly in this iteration.
