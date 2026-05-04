# Graph-View Kind Chip — Split-Button Toggle

> Output of brainstorm session 2026-05-01. Refines the kind-filter row at the top of the graph view (`KindFilterToggler`) into a split-button chip with separate navigate and visibility actions.
>
> Status: **proposed** — pending review before transitioning to implementation plan.

## 1. Concept & problem

Today, each chip in the graph view's kind-filter row is a single button: clicking it toggles whether items of that kind are rendered in the structured list. The chip has no second function, so users who want to *jump to* a kind's section must scroll manually past kinds they're not interested in. The structured-list section headers themselves are not anchor targets.

The chip should do both things: act as a quick navigation control (scroll to that kind's section) and as a visibility filter (show/hide that kind from the page). The two actions need to be discoverable and independent — you should be able to navigate without affecting visibility, and toggle without scrolling.

## 2. Anatomy

Each chip is a single visual unit divided into two click zones by a thin internal border.

```
┌──────────────────────────┬────┐
│ [G] Goals · 12           │ 👁  │
└──────────────────────────┴────┘
   body → scroll-to-section  toggle → hide/show
```

- **Body** (kind swatch + label + count): primary action is *navigate*. Click → smooth-scroll to the kind's section header in the structured list.
- **Toggle** (eye-open / eye-slash icon): primary action is *show/hide*. Click → flip `hiddenKinds` membership for that kind. No scroll.

The two zones are independent click targets and independent tab stops. Hovering one does not highlight the other.

## 3. Visual states

| State            | Border    | Swatch     | Label / count | Toggle icon |
| ---------------- | --------- | ---------- | ------------- | ----------- |
| Visible          | solid 1px | full color | full color    | eye-open    |
| Hidden           | dashed 1px| greyed     | greyed        | eye-slash   |
| Hover (per zone) | unchanged | unchanged  | unchanged     | subtle bg fill on hovered zone only |
| Focus            | unchanged | unchanged  | unchanged     | focus ring on focused zone |

The dashed-border + greyed combination signals "this kind is off-screen." The eye-slash icon reinforces the same meaning at the toggle. Hover affordance is local to the zone the cursor is over so the user can see which click target they're about to hit.

## 4. Behavior

### 4.1 Body click

| Kind visible | Kind hidden |
| --- | --- |
| Smooth-scroll to the section containing that kind. No state change. | `flushSync` the kind out of `hiddenKinds` first, then `navigate({ hash })`. The unhide commits synchronously before the hash update triggers `useGraphHashAnchor`'s effect, so the target row/anchor is mounted by the time scroll runs. |

The `flushSync` wrapper is necessary because `useGraphHashAnchor` (lines 23–49 of `-structured-list-view.tsx` today) keys its effect on `targetRef` only — if the hash changes and the target isn't yet mounted, the anchor effect runs once, finds nothing, and won't retry when the row later appears. Wrapping the unhide in `flushSync` guarantees the row is in the DOM before navigate fires.

A parallel branch (FE-655, `ka/fe-655-re-land-orphaned-graph-prs`, commit `c37cdb4`) introduced the same pattern for `RelationChip` auto-unhide. If FE-655 lands first, the helper extracted there can be reused; otherwise this work introduces it. Either way, by the end of this work both the new top-chip body and the relation-chip click should call the same `unhideAndNavigate` helper.

### 4.2 Toggle click

Pure state mutation: flip `hiddenKinds` membership for that kind. No scroll, no hash change.

### 4.3 Bulk control — "Show all"

A trailing **Show all** text-link appears at the right end of the chip row only when `hiddenKinds.size > 0`. Clicking resets `hiddenKinds` to the empty set. When everything is visible the link is not rendered (zero footprint).

Solo / hide-others gestures (e.g. alt-click) are explicitly out of scope — undiscoverable, deferrable.

## 5. State & persistence

`hiddenKinds` stays as local React state on the structured-list component, as it is today. No URL search-param, no `localStorage`. Refresh resets the row to all-visible.

Rationale: the filter is a temporary visual reduction during a single graph-view session, not a saved preference. Persisting it would surprise users who hide a kind, navigate away, and return (or refresh) without remembering what they turned off. Upgrading to URL-state later, if shareable links become useful, is a small change to one component.

## 6. Accessibility

- **Body button**: `<button type="button">` with accessible name `"Scroll to {Label}"` when visible, `"Show {Label} and scroll to it"` when hidden.
- **Toggle button**: `<button type="button" aria-pressed={!isHidden}>` with accessible name `"Hide {Label}"` when visible, `"Show {Label}"` when hidden.
- **Show all** button (when present): `<button type="button">` with name `"Show all kinds"`.
- Tab order within a chip: body → toggle. Tab order across the row: chip 1 body → chip 1 toggle → chip 2 body → chip 2 toggle → … → "Show all" (when present).
- The `aria-pressed` state on the toggle gives screen-reader users the visibility status without relying on the dashed-vs-solid border.

## 7. Implementation outline

### 7.1 Files

- `src/client/routes/specification/$id/-structured-list-view.tsx` — replace the single-button `KindFilterToggler` (currently lines 141–180) with a split-button row. Extract a small `KindToggleChip` component (~40 lines) for clarity.
- Same file — add a kind-level anchor target inside each display-group section. Today sections are marked `data-graph-section={group.label}` (line 513) and rows are marked `data-graph-row-ref={referenceCode}` (read by `useGraphHashAnchor`). Display groups bundle multiple kinds, so a per-kind anchor is needed: e.g. add a marker on the first row of each kind within a group, keyed `data-graph-kind-anchor={kind}`. Body click scrolls to that marker.
- Same file — introduce an `unhideAndNavigate(kind, hashTarget)` helper that does `flushSync(() => setHiddenKinds(...)); navigate({ hash: hashTarget })`. The chip body uses it for hash="kind anchor" and (when FE-655 lands or as part of this work's scope) `RelationChip`'s click handler reuses it for hash="referenceCode".
- `useGraphHashAnchor` already handles smooth-scroll to a row by `data-graph-row-ref`. It needs a small extension (or a sibling effect) to also resolve hashes that target kind anchors (`data-graph-kind-anchor`). Two anchor schemes, one effect.

### 7.2 Approximate component shape

```tsx
function KindToggleChip({ entry, count, isHidden, onNavigate, onToggle }: Props) {
  const swatchClass = isHidden ? kindTextColor[entry.kind] : kindColor[entry.kind];
  return (
    <span data-graph-kind-chip={entry.kind} className={chipShellClass(isHidden)}>
      <button
        type="button"
        data-graph-kind-body={entry.kind}
        onClick={() => onNavigate(entry.kind)}
        className={bodyClass(isHidden)}
      >
        <span className={`inline-flex items-center rounded px-1 py-0.5 font-mono text-[10px] font-medium ${swatchClass}`}>
          {entry.label}
        </span>
        <span className="font-mono text-[10px] opacity-70">{count}</span>
      </button>
      <button
        type="button"
        data-graph-kind-toggle={entry.kind}
        aria-pressed={!isHidden}
        onClick={() => onToggle(entry.kind)}
        className={toggleClass}
      >
        {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  );
}
```

The swatch reuses the existing `kindColor` / `kindTextColor` maps from `@/client/components/knowledge-card`, matching how the row badges and the current chip render today. `Eye`/`EyeOff` come from `lucide-react` (already used elsewhere in this file). The `data-graph-kind-body` and `data-graph-kind-toggle` attributes keep test selectors compositional and let `useGraphHashAnchor` discover the anchor target if needed.

## 8. Out of scope

- Solo / alt-click hide-others.
- Per-relation-type filtering (chips here are kind-level, not relation-level).
- Persisting filter state across refresh / across sessions.
- URL-state for hidden kinds.
- Animated transitions between visible/hidden states beyond the CSS color/border transition.
- Right-sidebar bundle filtering (separate concern from the kind-row chips).

## 9. Verification approach

- **F1 component tests**: render `KindToggleChip` in visible/hidden states; assert body click invokes `onNavigate(kind)` only, toggle click invokes `onToggle(kind)` only; assert `aria-pressed` flips with `isHidden`.
- **F2 router-integrated tests**:
  - Body click on visible chip → URL hash updates → smooth-scroll triggered to matching anchor element.
  - Body click on hidden chip → `hiddenKinds` drops the kind in the same render pass (`flushSync`), then scroll lands on the now-visible section.
  - Toggle click → `hiddenKinds` flips, no hash change, no scroll.
  - "Show all" appears iff `hiddenKinds.size > 0`; clicking resets the set.
- **A11y**: keyboard tab order matches §6; toggle's `aria-pressed` reflects state; both buttons have non-empty accessible names.

## 10. Open questions

- **Anchor granularity.** §7.1 proposes per-kind anchors inside display-group sections. Implementation could instead scroll to the display-group header (coarser — multiple chips would scroll to the same place) or to the first row of each kind (finer — current proposal). First-row-of-kind is more precise but requires marking the boundary; group-header is simpler but feels imprecise. Default: per-kind anchor.
- **FE-655 ordering.** The `unhideAndNavigate` helper described in §7.1 is also being added on `ka/fe-655-re-land-orphaned-graph-prs` for `RelationChip`. If FE-655 merges first, this work imports the helper; otherwise this work introduces it and FE-655 reuses it on rebase. Either order is fine — captured here so the author knows to coordinate, not duplicate.

Persistence (§5) was confirmed as local-state-only. Bulk gesture beyond "Show all" was confirmed as deferred.
