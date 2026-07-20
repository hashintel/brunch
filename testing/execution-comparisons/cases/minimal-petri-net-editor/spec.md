# Minimal browser-based Petri-net editor

## Intent

### CON1 Pure client-side static web app (no backend)

The editor runs entirely in the browser as a static web application. No server component; all net state lives in the browser.

- basis: explicit
- source: stakeholder

### CON2 v1 out-of-scope / non-goals

Explicitly excluded from v1: analysis features (reachability, invariants, deadlock detection); extended net types (inhibitor arcs, colored tokens, timing); automatic run/play engine; collaboration and user accounts; backend services; image (PNG/SVG) export; place capacities.

- basis: explicit
- source: stakeholder

### AC14 App mounts through its real browser entry point

Verifiable by building the app and loading its real production entry point (the served index.html / bundled entry) in a real or headless browser - not a hand-written harness or mocked root. Pass: the editor UI mounts and renders a usable, empty canvas with its controls visible, and the browser console reports no uncaught errors or failed module loads during startup.

- basis: explicit

### AC15 Full node drag lifecycle is clean; nodes can be created, moved, renamed, deleted

Covers the complete pointer drag lifecycle (pointer-down, pointer-move, pointer-up) for creating and moving nodes, verifiable by driving pointer events. Pass conditions: (1) adding a place or transition creates exactly one node; (2) dragging a node moves it to the drop position; (3) on pointer-up the drag ends cleanly - the node is released at its final position, is not still following the cursor, and is not left in an active-drag or immediately-reselected state that needs a second click to deselect; (4) renaming updates the node's label; (5) deleting removes the correct node. No ghost or duplicate nodes remain after any operation.

- basis: explicit

### AC16 Arcs connect place<->transition; invalid arcs rejected

Verifiable by attempting arc creation via drag. Pass: a drag from a place to a transition, or transition to a place, creates exactly one arc with default weight 1; a drag between two places or two transitions creates no arc and surfaces the place<->transition message; the canvas is left with no partial arc.

- basis: explicit

### AC17 Initial tokens and arc weights are editable and validated

Verifiable by editing values through the UI. Pass: a place accepts a non-negative integer initial token count and rejects negative or non-integer input; an arc accepts a positive integer weight (>=1, default 1) and rejects zero, negative, or non-integer input; the displayed token and weight values update to the accepted value.

- basis: explicit

### AC18 Enabled transitions are visibly indicated

Verifiable by inspecting rendered transition state against the current marking. Pass: every transition enabled under INV1 for the current marking is visually distinguished (e.g. highlighted) from disabled transitions, and the indication is recomputed and updated after each firing and after any edit that changes enablement.

- basis: explicit

### AC19 Firing updates the marking correctly

Verifiable by firing a transition and comparing markings before and after. Pass: after firing an enabled transition, each input place has decreased by its input arc weight and each output place increased by its output arc weight, with all other places unchanged; attempting to fire a disabled transition leaves the marking unchanged.

- basis: explicit

### AC20 Reset restores the initial marking

Verifiable by advancing the marking via firing, then resetting. Pass: after reset, every place's token count equals the saved initial marking, and the enabled-transition indication reflects that initial marking.

- basis: explicit

### AC21 Net persists across reloads

Verifiable by building a net, reloading the page, and comparing. Pass: after reload the net's structure (places, transitions, arcs, arc weights, labels) and its initial marking are identical to before the reload.

- basis: explicit

### AC22 JSON export/import round-trips

Verifiable by exporting to JSON, then importing that file into a fresh editor instance. Pass: the reconstructed net is structurally identical - same places, transitions, arcs, arc directions, arc weights, and initial marking.

- basis: explicit

### AC23 After firing then reload, the net is at its initial marking

Verifiable by firing to change the current marking, then reloading. Pass: after reload the displayed marking equals the initial marking (not the pre-reload current marking), and structure plus initial marking are preserved.

- basis: explicit

### AC24 Deleting a node removes its connected arcs

Verifiable by deleting a node that has connected arcs. Pass: the node and every arc attached to it are removed together; no arc referencing a missing endpoint remains in the net or in a subsequent export.

- basis: explicit

### AC25 Malformed import is rejected without corrupting the current net

Verifiable by importing invalid files (both non-JSON and schema-invalid variants) while a valid net is loaded. Pass: each invalid import is rejected with a clear error message, and the previously loaded net remains intact and editable.

- basis: explicit

### AC26 New/clear resets to an empty net

Verifiable by activating new/clear on a non-empty net. Pass: the canvas is reset to an empty net and the stored single net is replaced; a subsequent reload restores the empty net.

- basis: explicit

### D1 Net flavor: classic P/T, weighted arcs, unbounded places

- basis: explicit
- source: stakeholder

### D2 Simulation: manual step firing with reset

- basis: explicit
- source: stakeholder

### D3 Canvas interaction: direct manipulation

- basis: explicit
- source: stakeholder

### G1 Browser-based editor to draw and simulate classic P/T Petri nets

A minimal web application, running entirely in the browser, that lets a user construct a classic place/transition Petri net (places, transitions, weighted arcs), set an initial marking, and simulate token flow by manually firing enabled transitions. Kept coherent and generally useful rather than exhaustive for v1.

- basis: explicit
- source: stakeholder

### INV1 P/T enabling and firing rule

A transition is enabled iff every input place holds at least the weight of its input arc. Firing an enabled transition removes each input arc's weight from the corresponding input place and adds each output arc's weight to the corresponding output place. Places are unbounded; no capacity limits are checked.

- basis: explicit
- source: derived

### REQ1 Create and edit net on a canvas

The user can add, move, label, and delete places and transitions on a canvas, and draw arcs connecting a place to a transition or a transition to a place (never place-place or transition-transition).

- basis: explicit
- source: stakeholder

### REQ2 Integer arc weights

Each arc carries a positive integer weight (default 1) that the user can edit.

- basis: explicit
- source: stakeholder

### REQ3 Set initial marking

The user can set the token count (non-negative integer) of each place, defining the net's initial marking.

- basis: explicit
- source: stakeholder

### REQ5 Reset to initial marking

A control restores the net's current marking to the saved initial marking.

- basis: explicit
- source: stakeholder

### REQ6 In-browser persistence across reloads

The current net (structure and initial marking) persists in browser local storage and is restored on reload.

- basis: explicit
- source: stakeholder

### REQ7 JSON export and import

The user can export the current net as a downloadable JSON file and import a net from such a file.

- basis: explicit
- source: stakeholder

### REQ9 Reload restores the net at its initial marking

Persistence stores net structure and the initial marking only. The current (simulation) marking is not persisted, so after a reload the net is presented at its initial marking.

- basis: explicit

### REQ10 Deleting a node removes its connected arcs

Deleting a place or transition also removes every arc attached to it, so the net never contains a dangling arc referencing a missing endpoint.

- basis: explicit

### REQ12 Single-net model with new/clear action

The editor holds exactly one net at a time, with no multi-net management or naming. A new/clear action resets the canvas to an empty net, replacing the stored net.

- basis: explicit

### REQ13 Manual firing of enabled transitions

During simulation the user fires transitions one step at a time by selecting a transition. If the selected transition is enabled under the P/T firing rule (INV1) - every input place holds at least its input arc's weight in tokens - it fires: the editor subtracts each input arc's weight from the corresponding input place and adds each output arc's weight to the corresponding output place, yielding a new current marking. The new marking renders immediately and the enabled set is recomputed and re-indicated. Selecting a transition that is not enabled has no effect. Firing is manual only (the editor never fires automatically); when several transitions are enabled the user resolves the choice by selecting one.

- basis: explicit

### REQ14 Reject invalid arcs with feedback

When the user drags to create an arc, the editor permits the connection only between a place and a transition, in either direction. If the drag would connect two places or two transitions, the editor does not create the arc and shows a clear, non-blocking message stating that arcs must connect a place to a transition. The in-progress drag is cancelled and the canvas returns to its prior state with no partial or dangling arc left behind.

- basis: explicit

### REQ15 Reject malformed net files on import

On import the editor parses the selected file and validates it against the net JSON schema: expected places, transitions, and arcs, with each arc referencing existing endpoints of opposite type, positive integer arc weights, and non-negative integer token counts. If the file is not valid JSON or does not conform to the schema, the import is rejected: a clear error message is shown and the currently loaded net is left completely unchanged. Only a file that passes validation replaces the current net.

- basis: explicit

### T3 Classic P/T net

A classic place/transition (P/T) net is a directed bipartite graph with two node types: places (drawn as circles), each holding a non-negative integer number of tokens, and transitions (drawn as bars), representing events. Directed arcs connect them; an arc always runs place->transition (input arc) or transition->place (output arc), never place-place or transition-transition. Each arc carries a positive integer weight (default 1). The token distribution across all places is the net's marking. A transition is enabled when every input place holds at least its input arc's weight in tokens; firing removes those tokens from input places and adds each output arc's weight to output places. Places are unbounded (no capacity limit) in this editor.

- basis: explicit

### T4 Marking (initial vs current)

A marking assigns a non-negative integer token count to every place. The initial marking is the saved starting assignment that defines the net's initial state; it is what reset restores and what persistence and JSON export store. The current marking is the live assignment during simulation, produced by firing transitions from the initial marking. The current marking is transient: it is not persisted, so a page reload presents the net at its initial marking.

- basis: explicit
