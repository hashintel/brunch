# petri-net-editor

## Intent

### CON1 Static dist/ build — no runtime network

The application must ship as a static dist/ directory and must not make any network requests at runtime.

- basis: implicit
- source: stakeholder

### CON2 npm test is the test entry point

All automated verification must be invokable via `npm test`.

- basis: implicit
- source: stakeholder

### D1 Firing semantics: standard P/T

- basis: implicit
- source: stakeholder

### D2 Cascade deletion of arcs when a node is deleted

- basis: implicit
- source: stakeholder

### D3 New net prompts for confirmation

- basis: implicit
- source: stakeholder

### D4 No session persistence — Export JSON is the save path

- basis: implicit
- source: stakeholder

### D5 Block structurally invalid arcs

- basis: implicit
- source: stakeholder

### D6 Malformed JSON import: alert and abort

- basis: implicit
- source: stakeholder

### G1 Minimal browser-based Petri-net editor

A self-contained web application that lets users compose, simulate, and export Petri nets entirely in the browser — no server, no runtime network.

- basis: implicit
- source: stakeholder

### INV1 Arcs only connect places to transitions or transitions to places

The bipartite structure of a P/T net must be maintained: every arc connects a place to a transition or a transition to a place. Place-to-place and transition-to-transition arcs are structurally illegal and must be blocked.

- basis: implicit
- source: stakeholder

### REQ1 Canvas region with Add place, Add transition, Draw arc controls

The application exposes a 'Petri net canvas' region with controls: Add place, Add transition, Draw arc.

- basis: implicit
- source: stakeholder

### REQ2 Fire selected transition, Delete selection, New net, Reset marking controls

Controls for firing the selected transition, deleting the selection, creating a new net, and resetting the marking to initial tokens.

- basis: implicit
- source: stakeholder

### REQ3 Export JSON and Import JSON controls

Controls to export the current net as a JSON file (download) and to import a net from a JSON file (file-input).

- basis: implicit
- source: stakeholder

### REQ4 Accessible names for places, transitions, and arcs

Dynamic accessible names: 'Place: <label>', 'Transition: <label> (enabled|disabled)', 'Arc: <source> to <target>'.

- basis: implicit
- source: stakeholder

### REQ5 Property fields: Label, Initial tokens, Current tokens, Arc weight

Editable fields exposed when a node/arc is selected: Label, Initial tokens, Current tokens, Arc weight.

- basis: implicit
- source: stakeholder

### REQ6 Status and alert feedback

The UI provides live status and alert feedback (e.g. transition firing result, validation errors).

- basis: implicit
- source: stakeholder

### REQ7 Selectable and movable nodes

Nodes (places and transitions) can be selected and repositioned by dragging on the canvas.

- basis: implicit
- source: stakeholder

### REQ8 Source-to-destination pointer arc drawing

Arcs are drawn by activating Draw arc mode, clicking the source node, then clicking the destination node.

- basis: implicit
- source: stakeholder

### REQ9 Selected firing and deletion

Fire selected transition fires the currently selected transition; Delete selection removes the selected node(s) or arc(s).

- basis: implicit
- source: stakeholder

### REQ10 Default arc weight is 1, default initial tokens is 0

When a new arc or place is created, arc weight defaults to 1 and initial tokens defaults to 0.

- basis: implicit
- source: stakeholder

### REQ11 Fire alert when selected transition is not enabled

When the user activates 'Fire selected transition' and the selected transition is not enabled (insufficient tokens), a status alert is shown explaining the transition cannot fire.

- basis: implicit
- source: stakeholder

### REQ12 JSON export schema: places, transitions, arcs arrays

Export/import JSON schema: {places:[{id,label,x,y,initialTokens}], transitions:[{id,label,x,y}], arcs:[{id,source,target,weight}]}. currentTokens is not persisted; import restores from initialTokens. x/y are canvas pixel coordinates. id values are opaque unique strings.

- basis: implicit
- source: stakeholder
