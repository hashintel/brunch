# Shared execution and interoperability baseline

This baseline is visible to both elicitation targets before they begin. It controls delivery and
mechanical addressability so the same black-box browser journeys can exercise independently produced
applications. A requirement copied from this baseline is not an elicitation gain.

## Delivery

- Build a pure client-side browser application from a fresh empty Git repository.
- `npm test` must run the implementation's own tests.
- `npm run build` must write a static production application to `dist/`.
- The built application must not require runtime network access.
- Dependency installation may use the package registry.

## Accessible application surface

- Expose one `application` named `Petri net editor`.
- Expose one `region` named `Petri net canvas`.
- Expose buttons named `Add place`, `Add transition`, `Draw arc`,
  `Fire selected transition`, `Delete selection`, `New net`, `Reset marking`,
  `Export JSON`, and `Import JSON`.
- Expose dynamic items as buttons named `Place: <label>`,
  `Transition: <label> (enabled|disabled)`, and `Arc: <source> to <target>`.
- Applicable selected-item fields use the accessible names `Label`, `Initial tokens`,
  `Current tokens`, and `Arc weight`.
- Invalid input and import feedback uses a `status` or `alert` role.

## Mechanical interaction vocabulary

- Activate `Add place` or `Add transition` to create exactly one selectable node.
- Select a place, transition, or arc to expose its applicable fields.
- Pointer-drag a place or transition from its rendered center to move it.
- Activate `Draw arc`, then pointer-drag from the source node to the destination node.
- Select a transition, then activate `Fire selected transition`.
- Select a node or arc, then activate `Delete selection`.
- Change a named inspector field with input followed by change/blur.
- Set a JSON file on the file input exposed by `Import JSON`.
- Activate `Export JSON` to download the current net.

This baseline intentionally does not settle Petri-net semantics, validation rules, persistence
behavior, malformed-input handling, cascade behavior, or the meaning of reset/new/reload. Those
remain specification material and controller-oracle concerns.
