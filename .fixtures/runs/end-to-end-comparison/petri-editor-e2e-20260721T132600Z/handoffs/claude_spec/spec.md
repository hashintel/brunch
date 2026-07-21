# Petri Net Editor — Specification

A minimal browser-based editor for classical weighted Place/Transition (P/T) nets. Runs entirely client-side; ships as a static `dist/` bundle; verified by `npm test`; makes no runtime network calls.

## 1. Scope

### In scope (v1)

- Model, edit, save, load, and simulate a classical weighted P/T net in a single browser tab.
- Place/transition/arc CRUD with pointer + keyboard-accessible controls.
- Interactive firing of enabled transitions.
- JSON export (download) and JSON import (file input).
- Automatic per-mutation persistence to `localStorage`.
- Accessible names, live status region, and alert region as required by the shared baseline.

### Non-goals (v1)

- Undo/redo history.
- Multi-select and box-select.
- Confirmation dialogs on destructive actions.
- Place capacities, inhibitor arcs, reset arcs, read arcs, coloured tokens, timed/stochastic semantics.
- Partial-import merge, "list all failures" import error mode.
- Server-side persistence, sharing, multi-user collaboration, any network I/O.
- Auto-layout / graph drawing algorithms — nodes are placed and moved by the user only.

## 2. Baseline compliance

The following behaviours are fixed by the shared baseline and reproduced here for completeness:

| Baseline item | Realisation in this spec |
|---|---|
| Static `dist/` build | Any bundler that emits a self-contained `dist/index.html` plus assets. |
| `npm test` | Runs the test suite defined in §12. |
| No runtime network | No `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, or dynamic `import()` of remote URLs at runtime. `localStorage` is permitted. |
| Application name `Petri net editor` | Root landmark: `<main aria-label="Petri net editor">`. Also set as `<title>`. |
| Region name `Petri net canvas` | Canvas element: `<div role="region" aria-label="Petri net canvas">` wrapping the SVG. |
| Controls | Buttons with visible text and matching accessible name: `Add place`, `Add transition`, `Draw arc`, `Fire selected transition`, `Delete selection`, `New net`, `Reset marking`, `Export JSON`, `Import JSON`. |
| Dynamic accessible names | Places: `Place: <label>`. Transitions: `Transition: <label> (enabled)` or `Transition: <label> (disabled)`. Arcs: `Arc: <sourceLabel> to <targetLabel>`. Updated live whenever the underlying data changes. |
| Fields | `Label`, `Initial tokens`, `Current tokens`, `Arc weight` — rendered as labelled inputs in the inspector panel (§9). |
| Status / alert feedback | Two live regions: polite `role="status" aria-live="polite"` for informational messages; assertive `role="alert"` for errors and destructive-side-effect notices (§10). |
| Selectable / movable nodes | Single-select model (§8). Nodes are draggable with the pointer. |
| Source-to-destination pointer arc drawing | Two-click gesture (§8.1). |
| Selected firing/deletion | `Fire selected transition` and `Delete selection` operate on the current single selection (§8.3, §5). |
| File-input import / download export | Import via `<input type="file" accept="application/json">`. Export via a synthesised `<a download>` click on a `Blob` URL. |

## 3. Data model

### 3.1 In-memory shape

```ts
type NodeId = string; // opaque; stable for the lifetime of a node
type ArcId  = string;

interface Place {
  id: NodeId;
  label: string;         // non-empty after trim; unique among places
  x: number; y: number;  // canvas coordinates in CSS pixels
  initialTokens: number; // integer, >= 0
  currentTokens: number; // integer, >= 0
}

interface Transition {
  id: NodeId;
  label: string;         // non-empty after trim; unique among transitions
  x: number; y: number;
}

interface Arc {
  id: ArcId;
  sourceId: NodeId;      // must resolve to an existing Place or Transition
  targetId: NodeId;      // must resolve to the *opposite* kind of node
  weight: number;        // integer, >= 1
}

interface Net {
  schemaVersion: 1;
  places: Place[];
  transitions: Transition[];
  arcs: Arc[];
}
```

### 3.2 Identifier and label conventions

- `id` values are opaque strings, generated at node/arc creation and never reused. Recommended generator: `crypto.randomUUID()`.
- Labels default to `P1, P2, …` for places and `T1, T2, …` for transitions on creation, choosing the lowest positive integer suffix not already in use within the kind. Users may then edit them to any non-empty trimmed string that remains unique within the kind.
- Place labels and transition labels share no uniqueness constraint with each other; `P1` and `T1` may coexist. `Place: P1` and `Transition: P1` are unambiguous accessible names because of the `Place:` / `Transition:` prefix mandated by the baseline.

## 4. Firing semantics — classical weighted P/T

Given a transition `t`:

- Let `in(t)  = { (p, w) | Arc a with a.targetId = t.id, a.sourceId = p.id (p a Place), a.weight = w }`.
- Let `out(t) = { (p, w) | Arc a with a.sourceId = t.id, a.targetId = p.id (p a Place), a.weight = w }`.

**Enablement.** `t` is *enabled* iff for every `(p, w) ∈ in(t)`, `p.currentTokens ≥ w`. A transition with no input arcs is trivially enabled (its accessible name reads `... (enabled)`).

**Firing.** Firing `t` is atomic and consists of:

1. For every `(p, w) ∈ in(t)`: `p.currentTokens := p.currentTokens - w`.
2. For every `(p, w) ∈ out(t)`: `p.currentTokens := p.currentTokens + w`.

Firing a disabled transition is a no-op that does not modify any place; it is prevented at the UI level (§8.3).

Self-loops via a transition (a place `P` appears in both `in(t)` and `out(t)`) are permitted and behave as classical P/T self-loops: net token change on `P` is `w_out − w_in`, and enablement still requires `P.currentTokens ≥ w_in`.

## 5. Validation rules

Applied wherever data enters the model — user input, JSON import, and localStorage rehydration. Rejected input is refused wholesale; the current model is not partially mutated.

| # | Rule | Rejection behaviour |
|---|------|---------------------|
| V1 | Arc endpoints must be place↔transition. `place→place`, `transition→transition`, or a self-loop on a single node are rejected. | UI: refuse the second click and emit status `Arcs must connect a place to a transition.`, stay in draw mode. Import: reject file per §7.3. |
| V2 | An arc `(sourceId, targetId)` pair is unique — a second arc with the same source and same target and same direction is rejected. To change its weight, edit the existing arc. | UI: refuse the second click and emit `An arc from <src> to <tgt> already exists.`, stay in draw mode. Import: reject file. |
| V3 | Self-loop *via a transition* (place `P` → transition `T` and `T` → same `P`) is **allowed** (two distinct arcs). | n/a |
| V4 | `label` is required, non-empty after `.trim()`, and unique within its kind (place vs transition). | UI: revert the input to its last valid value and emit `Label must be non-empty and unique among <places\|transitions>.`. Import: reject file. |
| V5 | `initialTokens` and `currentTokens` are integers in `[0, Number.MAX_SAFE_INTEGER]`. Non-integer, negative, or non-finite values are rejected. | UI: revert the input and emit `Tokens must be a non-negative integer.`. Import: reject file. |
| V6 | `weight` is an integer in `[1, Number.MAX_SAFE_INTEGER]`. Zero, negative, non-integer, and non-finite values are rejected. | UI: revert and emit `Arc weight must be a positive integer.`. Import: reject file. |
| V7 | Editing `Current tokens` on a place is allowed and does **not** modify `Initial tokens`. | n/a |
| V8 | `Reset marking` sets `currentTokens := initialTokens` for every place. Structure, positions, labels, and selection are untouched. | n/a |

Input commit on the inspector panel: field edits commit on `blur` or on `Enter`. `Escape` while an input is focused reverts the pending edit to the last committed value without emitting a status message.

## 6. Delete cascade

| # | Trigger | Behaviour |
|---|---------|-----------|
| D1 | Delete a **place** or **transition** | Also delete every arc `a` such that `a.sourceId` or `a.targetId` equals the deleted node's id. Status: `Deleted <label> and N connected arc(s).` (Where `N` may be `0`, in which case the message drops the "and 0 connected arc(s)" clause: `Deleted <label>.`). |
| D2 | Delete an **arc** | Delete the arc only. Endpoints are not modified. Status: `Deleted arc <sourceLabel> to <targetLabel>.` |
| D3 | Delete with nothing selected | No-op. Status: `Nothing selected.` |
| D4 | Confirmation | None. Delete is immediate. Recovery is via `Export JSON` (before) or `Import JSON` (after). |
| D5 | Undo stack | Not supported in v1. |

## 7. Session-state lifecycle

### 7.1 localStorage persistence

- Storage key: `petri-net-editor:v1`.
- Value: the JSON string produced by the same serialiser as `Export JSON` (§7.2).
- Written on every state mutation: add/delete a node or arc, move a node, edit any field, fire a transition, `Reset marking`, `New net`.
- **Not** written on pure selection changes.
- On page load: if the key is present, parse and validate. If it passes §5, hydrate the model from it. If it is absent, start with an empty net. If it is present but fails parse or validation, discard it, start empty, and emit an alert (§7.3).

### 7.2 Export JSON

- Triggered by the `Export JSON` control.
- Produces `Blob` with MIME type `application/json`, filename `petri-net-<yyyy-mm-dd>-<HHMMSS>.json` (local time), downloaded via a synthesised `<a download>` click.
- Payload: the current `Net` value, exactly matching the schema in §3.1.
- Places, transitions, and arcs are emitted in a **stable order**: creation order within each collection. This makes exports diff-friendly.
- Status: `Exported net (<P> places, <T> transitions, <A> arcs).`

### 7.3 Import JSON

- Triggered by choosing a file in the `Import JSON` file input.
- The file is read as text and passed through the same load/validate path as localStorage rehydration.
- **All-or-nothing.** On any failure — `JSON.parse` throw, schema shape mismatch, unknown field types, unknown arc endpoints, duplicate ids, endpoint-kind violation, non-positive weight, negative tokens, non-unique labels, `schemaVersion !== 1`, missing `schemaVersion` — the current model is unchanged and one **alert** is emitted with the first concrete reason found. Examples:
  - `Import failed: file is not valid JSON.`
  - `Import failed: schemaVersion must be 1.`
  - `Import failed: arc "a3" references unknown node "p9".`
  - `Import failed: arc "a5" connects two places; arcs must connect a place to a transition.`
  - `Import failed: place label "P1" is not unique.`
  - `Import failed: arc weight must be a positive integer.`
- On success: the imported net **replaces** the current one wholesale. Selection is cleared. Status: `Imported net (<P> places, <T> transitions, <A> arcs).`
- No confirmation dialog when the current net is non-empty. Users export first if they want a recovery point.
- After a successful import, the imported net is immediately persisted to localStorage.

### 7.4 `New net`

- Clears all places, transitions, arcs, and selection.
- Overwrites localStorage with the empty net so the state does not resurrect on reload.
- Status: `New net created.`

### 7.5 `Reset marking`

- For every place: `currentTokens := initialTokens`.
- Does not modify structure, positions, labels, `initialTokens`, or selection.
- Status: `Marking reset.`

## 8. Interaction model

### 8.1 Arc drawing

Two-click modal gesture:

1. User activates `Draw arc`. Application enters *draw-arc* mode. Status: `Draw arc: click source, then click target.` `Draw arc` button reflects mode with `aria-pressed="true"`.
2. First click on a node marks it as the pending source and visually highlights it. Status: `Draw arc: source <label> selected, click target.`
3. Second click:
   - On a node of the *opposite* kind, not already the target of an arc from this source: commit the arc with `weight = 1`, exit draw-arc mode, select the new arc. Status: `Arc <sourceLabel> to <targetLabel> created.`
   - On a node of the *same* kind or the source itself: refuse (V1), stay in draw-arc mode with the same pending source, status per V1.
   - On a duplicate target: refuse (V2), stay in draw-arc mode, status per V2.
4. Clicking empty canvas at any point in draw-arc mode cancels: exit mode, no arc created, status `Arc drawing cancelled.`.
5. Pressing `Escape` at any point in draw-arc mode cancels identically.
6. Activating any other control (or clicking `Draw arc` again) cancels first, then performs the new action.

### 8.2 Selection

- **Single-select only.** Exactly zero or one item (a place, a transition, or an arc) is selected at any time.
- Clicking a node or arc selects it. Clicking empty canvas clears the selection. There is no shift-click, ctrl-click, or drag-box selection.
- The selected item is visually distinguished (e.g. thicker stroke) and reflected in the inspector panel (§9).
- Dragging a *selected* node with the pointer moves it. Dragging an unselected node selects it first, then moves it in the same gesture. Arcs are not draggable.
- Movement is unconstrained (no snap-to-grid in v1) and clamped to the visible canvas bounds.

### 8.3 `Fire selected transition`

| Selection state | Behaviour | Status |
|-----------------|-----------|--------|
| Nothing selected | No-op | `Nothing selected.` (alert) |
| Place or arc selected | No-op | `Select a transition to fire.` (alert) |
| Transition selected, disabled | No-op | `Transition <label> is not enabled.` (alert) |
| Transition selected, enabled | Fire per §4 | `Fired <label>.` (status) |

The button is **never** set to the HTML `disabled` state — that would suppress the click event and deny screen-reader users the alert. It uses `aria-disabled="true"` when the current selection is not an enabled transition, remains focusable and activatable, and its click handler emits the appropriate alert in each of the "no-op" rows above without mutating the model.

## 9. UI regions

Layout (top to bottom, left to right):

1. **Application landmark.** `<main aria-label="Petri net editor">`, wrapping everything.
2. **Toolbar.** A horizontal `<div role="toolbar" aria-label="Editor controls">` containing the nine baseline controls in the order listed in §2. Eight are `<button>` elements (`Add place`, `Add transition`, `Draw arc`, `Fire selected transition`, `Delete selection`, `New net`, `Reset marking`, `Export JSON`) with visible text matching the accessible name. `Import JSON` is a `<label>` styled as a button that wraps a visually-hidden `<input type="file" accept="application/json">`; the label's text `Import JSON` supplies the accessible name and the wrapping-label association keeps the native file-input interaction (browser file picker) intact — this satisfies the baseline's "file-input import" requirement while preserving control-name parity with the other eight.
3. **Canvas region.** `<div role="region" aria-label="Petri net canvas">` wrapping an `<svg>` that renders the net. Nodes and arcs are rendered as SVG elements with `role="button"` (nodes) or `role="img"` (arcs) and the dynamic accessible names from §2.
4. **Inspector panel.** A right-hand `<aside aria-label="Inspector">`. Contents depend on the selection:
   - No selection → short text hint: `Select a place, transition, or arc to edit its properties.`
   - Place → labelled inputs `Label`, `Initial tokens`, `Current tokens`. Read-only summary `Incoming arcs`, `Outgoing arcs` (counts).
   - Transition → labelled input `Label`. Read-only summary of `Enabled` state plus `Incoming arcs`, `Outgoing arcs`.
   - Arc → labelled input `Arc weight`. Read-only `Source`, `Target` (labels).
5. **Feedback region.** Two invisible-to-sighted-but-live-to-AT live regions at the bottom of the DOM: `<div role="status" aria-live="polite">` for informational messages and `<div role="alert">` for errors. Only one message at a time; each new message replaces the previous within its region.

Keyboard support:

- All toolbar controls are in the natural tab order.
- Focus can be moved between nodes and arcs on the canvas via `Tab` / `Shift+Tab`. Focus is visible.
- `Enter` / `Space` on a focused node or arc selects it.
- `Delete` / `Backspace` while focus is on a node/arc or the canvas triggers `Delete selection` on the current selection.
- `Escape` cancels an in-progress arc-drawing gesture; also reverts a pending inspector edit without committing.
- Arc *drawing* itself is pointer-driven, as required by the baseline ("source-to-destination pointer arc drawing"). Keyboard equivalence is not required by the baseline and is not provided in v1.

## 10. Status and alert message catalogue

The `role="status"` region carries informational messages, one at a time; each replaces the previous. The `role="alert"` region carries messages the user must be told about even if they missed the visual change.

**Informational (status):**

- `Draw arc: click source, then click target.`
- `Draw arc: source <label> selected, click target.`
- `Arc drawing cancelled.`
- `Arc <sourceLabel> to <targetLabel> created.`
- `Deleted <label>.` / `Deleted <label> and N connected arc(s).`
- `Deleted arc <sourceLabel> to <targetLabel>.`
- `Fired <label>.`
- `Marking reset.`
- `New net created.`
- `Exported net (<P> places, <T> transitions, <A> arcs).`
- `Imported net (<P> places, <T> transitions, <A> arcs).`

**Alert:**

- `Nothing selected.`
- `Select a transition to fire.`
- `Transition <label> is not enabled.`
- `Arcs must connect a place to a transition.`
- `An arc from <src> to <tgt> already exists.`
- `Label must be non-empty and unique among <places|transitions>.`
- `Tokens must be a non-negative integer.`
- `Arc weight must be a positive integer.`
- `Import failed: <reason>.`
- `Saved net could not be loaded; starting with a new net.`

## 11. Persisted JSON schema

Every export and every localStorage payload conforms to this shape:

```json
{
  "schemaVersion": 1,
  "places": [
    {
      "id": "p-9b1e",
      "label": "P1",
      "x": 120,
      "y": 80,
      "initialTokens": 1,
      "currentTokens": 1
    }
  ],
  "transitions": [
    {
      "id": "t-3a7c",
      "label": "T1",
      "x": 260,
      "y": 80
    }
  ],
  "arcs": [
    {
      "id": "a-4f22",
      "sourceId": "p-9b1e",
      "targetId": "t-3a7c",
      "weight": 1
    }
  ]
}
```

Import treats any missing or extra top-level key, any missing per-record key, any wrong type, and any `schemaVersion !== 1` as a schema failure and rejects the file.

## 12. Test plan

`npm test` runs a test suite that covers:

**Semantics (§4):**
- A transition with no input arcs is enabled and, when fired, adds `weight` tokens to each output place.
- A transition is enabled iff every input place has at least the arc weight in tokens (boundary: exactly equal → enabled; one below → disabled).
- Firing is atomic: input places decrement and output places increment in one commit; a self-loop `P→T→P` with weights `w_in`, `w_out` results in `P.currentTokens += (w_out − w_in)`.
- Firing a disabled transition is a no-op.

**Validation (§5):**
- Rejecting place→place, transition→transition, and same-endpoint arcs.
- Rejecting duplicate `(sourceId, targetId)` arcs.
- Rejecting empty, whitespace-only, and non-unique labels (within kind); accepting a `P1`/`T1` coexistence.
- Rejecting negative, non-integer, non-finite, and `NaN` token values.
- Rejecting zero, negative, non-integer, and non-finite arc weights.
- `Reset marking` restores `currentTokens := initialTokens` without touching structure or `initialTokens`.

**Cascade (§6):**
- Deleting a node removes all incident arcs and only those arcs.
- Deleting an arc leaves its endpoints untouched.
- Deleting with empty selection is a no-op.

**Persistence (§7):**
- A round trip through Export → Import reproduces the exact same `Net` (deep-equal, including ids, order, and coordinates).
- Every mutation in a scripted session ends with a localStorage entry that, when re-parsed, equals the current in-memory net.
- `New net` clears localStorage (subsequent reload starts empty).
- Corrupt localStorage (garbage string, wrong `schemaVersion`, missing field) starts the app empty and emits the load-failure alert.

**Import failure surface (§7.3):**
- Non-JSON file → `Import failed: file is not valid JSON.`
- Missing `schemaVersion` → schema failure.
- Arc referencing unknown node id → specific "unknown node" reason.
- Duplicate ids → schema failure.
- Endpoint-kind violation → specific reason.
- Any failure leaves the current in-memory net unchanged.

**Accessibility (§2, §9):**
- Root has `aria-label="Petri net editor"`; canvas region has `aria-label="Petri net canvas"`.
- Every baseline control button is present with matching accessible name.
- After creating a place labelled `P1`, a DOM node with accessible name `Place: P1` exists.
- After creating a transition `T1` with no input arcs, an element with accessible name `Transition: T1 (enabled)` exists; after adding an input place with initial `0` tokens and an arc of weight `1`, the accessible name becomes `Transition: T1 (disabled)`.
- After creating an arc from `P1` to `T1`, an element with accessible name `Arc: P1 to T1` exists.
- The `role="status"` and `role="alert"` regions exist and receive the messages catalogued in §10 for their respective triggers.

**Interaction (§8):**
- Two-click arc drawing creates one arc; canvel via `Escape` and via empty-canvas click both leave zero arcs and clear draw-mode.
- Firing a disabled transition via `Fire selected transition` is a no-op and emits the correct alert; firing an enabled one emits `Fired <label>.`.

Test framework choice is not fixed by this spec; any runner invoked by `npm test` and capable of DOM assertions (e.g. Vitest + `@testing-library/dom`, Jest + jsdom, or Playwright's component-test mode) satisfies the baseline. No test may make a network call.

## 13. Build

- `npm run build` produces a self-contained `dist/` directory: an `index.html`, JavaScript, CSS, and any static assets. Opening `dist/index.html` directly from the filesystem (`file://`) loads a fully functional editor.
- No runtime code performs network I/O. Build-time dependencies are unconstrained.
- Bundler choice is not fixed by this spec.

## 14. Traceability

Every baseline requirement maps to a numbered section:

| Baseline requirement | Sections |
|---|---|
| Static `dist/` build | §13 |
| `npm test` | §12 |
| No runtime network | §2, §13 |
| Application name | §2, §9.1 |
| Region name | §2, §9.3 |
| Nine controls | §2, §9.2 |
| Dynamic accessible names | §2, §9.3, §12 (Accessibility) |
| Four fields | §3.1, §9.4 |
| Status/alert feedback | §9.5, §10 |
| Selectable/movable nodes | §8.2 |
| Source-to-destination pointer arc drawing | §8.1 |
| Selected firing/deletion | §6, §8.3 |
| File-input import / download export | §7.2, §7.3 |

Every baseline area the shared baseline explicitly left open maps to a resolved decision:

| Open area | Resolution | Section |
|---|---|---|
| Semantics | Classical weighted P/T, no capacities. | §4 |
| Validation | V1–V8 as tabulated. | §5 |
| Persistence | localStorage on, `petri-net-editor:v1`. | §7.1 |
| Malformed-input handling | All-or-nothing, first concrete reason, one alert. | §7.3 |
| Cascade behaviour | Node delete cascades to incident arcs; no undo. | §6 |
| Reset / new / reload semantics | Defined in §7.1, §7.4, §7.5. | §7 |
