# Knowledge-Graph Revisit Module Design

> Design exploration from 2026-04-12. Referenced historically by SPEC.md D80.
> Status: archived. The user-facing revisit/cascade goal remains live, but the side-chat V2/V3 framing and the `revisit_session` persistence shape are superseded by the chat + reconciliation-need substrate in `docs/design/MULTI_CHAT.md` and the later semantic mutation history in `docs/design/PATCH_LEDGER.md`.
> Canonicality: this is a historical module design note, not the live frontier authority. For what is true now and what should happen next, prefer `memory/SPEC.md` and `memory/PLAN.md`.

## Shape

State machine lifecycle reconstructed from DB state on each HTTP request. No in-memory state survives between requests.

### Persisted state (new `revisit_session` table)

```typescript
interface RevisitSession {
  id: number
  specificationId: number
  status: 'planned' | 'active' | 'closing' | 'done' | 'aborted'
  rootItemIds: number[]          // items the user invalidated
  affectedItemIds: number[]      // cascade result
  phasesToReopen: Phase[]        // derived from affected items
  anchorTurnId: number           // highest primary-tree turn linked to affected items
  threadRootTurnId: number | null // set when thread opens
  createdAt: string
  completedAt: string | null
}
```

### Projected state (read-only, reconstructed per request)

```typescript
type RevisitState =
  | { status: 'none' }
  | { status: 'planned'; session: RevisitSession; preview: CascadePreview }
  | { status: 'active';  session: RevisitSession; resolved: number[]; remaining: number[] }
  | { status: 'closing'; session: RevisitSession }
  | { status: 'done';    session: RevisitSession }
```

### Module boundary (5 functions)

```typescript
/** Read-only: compute cascade without writing anything */
function previewCascade(specificationId: number, itemIds: number[]): CascadePreview

/** planned: write the session, mark items invalidated */
function beginRevisit(specificationId: number, itemIds: number[]): RevisitSession

/** active: open the secondary thread, reopen phases */
function openRevisitThread(sessionId: number, anchorTurnId: number): RevisitSession

/** active: mark one item resolved (called per-item as conversation progresses) */
function resolveRevisitItem(sessionId: number, itemId: number, outcome: 'confirmed' | 'edited' | 'removed'): RevisitState

/** closing → done: finalize when all items resolved */
function completeRevisit(sessionId: number): RevisitSession
```

## What it hides

- Graph traversal (BFS over all edge types, cycle detection)
- Which phases to reopen (derived from affected items' kind → phase mapping)
- Phase outcome supersession writes
- Review state reset for affected items
- Secondary thread turn creation with correct phase/ancestry
- Resolution completeness checking
- Anchor turn calculation (highest primary-turn provenance among affected items)

## HTTP mapping

| Step | Trigger | Writes |
|---|---|---|
| `previewCascade` | User selects items in edit mode | None (read-only) |
| `beginRevisit` | User confirms cascade | `revisit_session` + `turnKnowledgeItem(invalidated)` |
| `openRevisitThread` | Immediately after begin | Thread root turn + phase outcome supersession |
| `resolveRevisitItem` | Chat handler after each secondary turn | `turnKnowledgeItem(confirmed/edited)` per item |
| `completeRevisit` | When `remaining` reaches zero | Session status → done |

## Design alternatives considered

- **A (Minimal):** 2-method surface (`preview` + `invalidate`). Too coarse — doesn't model the interactive conversation lifecycle that spans many HTTP requests.
- **B (Event-driven):** Discrete event pipeline. Good auditability but ordering enforcement is runtime-only, not compile-time. Implementation style adopted (each step is stateless, state from DB).
- **C (Pure state machine):** In-memory stateful machine. Doesn't fit HTTP-per-request model without external persistence. Shape adopted, implementation adapted to DB-projected state.

## Open questions

- How does the secondary thread's chat endpoint differ from the primary? Same `/api/specifications/:id/chat` with a `threadId` param, or separate route?
- Does `resolveRevisitItem` happen automatically when the observer processes a secondary-thread turn, or does it require explicit user action?
- What happens if the user closes the browser mid-revisit? The session stays `active` in DB — next launch should resume.
