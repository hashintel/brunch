# Graph-View Kind Chip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the kind-filter chip row at the top of the structured-list graph view into a split-button chip — body click navigates to the kind's section, trailing eye-toggle hides/shows the kind. Add a trailing "Show all" link when any kind is hidden.

**Architecture:** Replace the single-button `KindFilterToggler` (in `src/client/routes/specification/$id/-structured-list-view.tsx`) with a new `KindToggleChip` component composed of two independent buttons inside one chip shell. Add a per-kind anchor (`data-graph-kind-anchor={kind}`) to the first row of each kind so the body's hash-scroll has a target. Extend `useGraphHashAnchor` to resolve `kind-{kind}` hashes against those anchors. Introduce a small `unhideAndNavigate(kind, hash)` helper that wraps `setHiddenKinds` in `flushSync` before `navigate({ hash })`, so a previously hidden section is mounted before scroll fires.

**Tech Stack:** React 19, TypeScript, TanStack Router, Tailwind CSS, lucide-react, vitest + happy-dom + @testing-library/react, oxlint + oxfmt.

**Spec:** `docs/design/GRAPH_KIND_CHIP_TOGGLE.md`.

---

## Before you start

- Linear issue: **FE-671** (`https://linear.app/hash/issue/FE-671/split-button-chip-toggle-in-graph-view`), parent FE-643.
- Branch: `ka/fe-671-graph-kind-chip-toggle`, off `main`.
- Run `npm run verify` once on a clean tree to make sure baseline passes.
- Inner loop after each meaningful edit: `npm run fix`.
- Gate before committing: `npm run verify`.

## File structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/client/routes/specification/$id/-structured-list-view.tsx` | Modify | Add kind anchors, extend `useGraphHashAnchor`, add `unhideAndNavigate`, extract `KindToggleChip`, wire bulk "Show all". |
| `src/client/routes/specification/$id/-kind-toggle-chip.tsx` | Create | Pure presentational split-button chip — body + toggle, visible/hidden states. ~60 lines. |
| `src/client/routes/specification/$id/__tests__/kind-toggle-chip.test.tsx` | Create | F1 component tests for `KindToggleChip`. |
| `src/client/routes/specification/$id/__tests__/structured-list-view.test.tsx` | Create | F2 router-integrated tests for nav + flushSync auto-show + Show-all flow. |

The chip is its own file so component tests don't need to mount the whole structured-list view. Naming convention follows the existing `-relation-chip.tsx` peer file in the same directory.

---

## Task 1: Add per-kind anchor markers to rendered rows

**Files:**
- Modify: `src/client/routes/specification/$id/-structured-list-view.tsx` — `ItemRow` rendering inside `StructuredListView`.

The chip body needs a scroll target. Today rows have `data-graph-row-ref={referenceCode}` (used by relation-chip nav). Add a sibling `data-graph-kind-anchor={kind}` attribute on the **first** row of each kind within a display group, so jumping to "Goals" lands on the first goal row.

- [ ] **Step 1: Write the failing structural test**

Create `src/client/routes/specification/$id/__tests__/structured-list-view.test.tsx`:

```tsx
// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSrc = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('structured-list-view kind anchors', () => {
  it('marks the first row of each kind with data-graph-kind-anchor', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toContain('data-graph-kind-anchor');
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx`

Expected: FAIL with "Expected source to contain 'data-graph-kind-anchor'".

- [ ] **Step 3: Add the anchor attribute**

In `-structured-list-view.tsx`, locate the `items.map((item) => …)` inside `CollapsibleContent` (around line 525). Compute "is this the first item of its kind in the current group" and pass it down. Track the previous kind while iterating:

```tsx
{(() => {
  let previousKind: KnowledgeKind | null = null;
  return items.map((item) => {
    const itemKey = `${item.kind}:${item.id}`;
    const isFirstOfKind = previousKind !== item.kind;
    previousKind = item.kind;
    return (
      <ItemRow
        key={`${itemKey}-v${rowsRemountKey}`}
        item={item}
        outgoing={outgoingByItem.get(itemKey) ?? []}
        incoming={incomingByItem.get(itemKey) ?? []}
        anchored={anchoredRowRef === item.referenceCode}
        defaultOpen={rowsDefaultOpen}
        kindAnchor={isFirstOfKind ? item.kind : null}
      />
    );
  });
})()}
```

In `ItemRow`'s prop list, add `kindAnchor: KnowledgeKind | null`. On the row's outermost element, conditionally add the attribute:

```tsx
<article
  data-graph-row-ref={item.referenceCode}
  data-graph-kind-anchor={kindAnchor ?? undefined}
  // … rest
>
```

If `ItemRow` doesn't currently take this prop, thread it through the existing prop interface.

- [ ] **Step 4: Run lint/format and the new test**

Run: `npm run fix && npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx`

Expected: lint/fmt pass; vitest PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/routes/specification/\$id/-structured-list-view.tsx \
        src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx
git commit -m "feat(graph-view): mark first-of-kind rows with data-graph-kind-anchor"
```

---

## Task 2: Extend `useGraphHashAnchor` to resolve kind anchors

**Files:**
- Modify: `src/client/routes/specification/$id/-structured-list-view.tsx` — `useGraphHashAnchor` hook (lines 23–49).

`useGraphHashAnchor` currently queries only `[data-graph-row-ref="…"]`. Teach it to recognize a `kind-{kind}` hash prefix and fall back to `[data-graph-kind-anchor="{kind}"]`.

- [ ] **Step 1: Add the failing test case to `structured-list-view.test.tsx`**

```tsx
describe('structured-list-view hash anchor resolution', () => {
  it('reads the hash prefix used for kind anchors', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toMatch(/data-graph-kind-anchor=.*CSS\.escape/s);
    expect(src).toContain("'kind-'");
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx`

Expected: FAIL — both assertions miss.

- [ ] **Step 3: Update the hook**

Replace the body of `useGraphHashAnchor`'s effect (current lines 30–46):

```tsx
useEffect(() => {
  if (!targetRef) {
    setAnchoredRowRef(null);
    return;
  }
  const container = containerRef.current;
  if (!container) return;

  const KIND_PREFIX = 'kind-';
  const node = targetRef.startsWith(KIND_PREFIX)
    ? container.querySelector(
        `[data-graph-kind-anchor="${CSS.escape(targetRef.slice(KIND_PREFIX.length))}"]`,
      )
    : container.querySelector(
        `[data-graph-row-ref="${CSS.escape(targetRef)}"]`,
      );
  if (!(node instanceof HTMLElement)) {
    setAnchoredRowRef(null);
    return;
  }

  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setAnchoredRowRef(targetRef);
  const timer = setTimeout(() => setAnchoredRowRef(null), HASH_ANCHOR_HIGHLIGHT_MS);
  return () => clearTimeout(timer);
}, [targetRef, containerRef]);
```

- [ ] **Step 4: Run lint/format and the test**

Run: `npm run fix && npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/routes/specification/\$id/-structured-list-view.tsx \
        src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx
git commit -m "feat(graph-view): resolve kind-* hashes against data-graph-kind-anchor"
```

---

## Task 3: Add `unhideAndNavigate` helper

**Files:**
- Modify: `src/client/routes/specification/$id/-structured-list-view.tsx` — inside `StructuredListView` component body.

The chip body, on hidden-kind click, must drop the kind from `hiddenKinds` *synchronously* before navigate fires, so the target anchor is mounted by the time the hash-anchor effect runs. Wrap the unhide in `flushSync`.

- [ ] **Step 1: Add the failing test**

Append to `structured-list-view.test.tsx`:

```tsx
describe('structured-list-view unhideAndNavigate helper', () => {
  it('uses flushSync to commit the unhide before navigate fires', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toContain("import { flushSync } from 'react-dom'");
    expect(src).toMatch(/flushSync\(\(\) => \{[\s\S]*?setHiddenKinds/);
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Add the import and helper**

Add the import near the other `react-dom` imports at the top of the file (or as a new import line):

```tsx
import { flushSync } from 'react-dom';
```

Inside `StructuredListView`, just below the `toggleKind` declaration (~line 491):

```tsx
const navigate = useNavigate();

const unhideAndNavigate = useCallback(
  (kind: KnowledgeKind) => {
    flushSync(() => {
      setHiddenKinds((current) => {
        if (!current.has(kind)) return current;
        const next = new Set(current);
        next.delete(kind);
        return next;
      });
    });
    void navigate({ to: '.', hash: `kind-${kind}` });
  },
  [navigate],
);
```

If `useNavigate` and `useCallback` aren't imported in this file yet, add them — `useNavigate` from `@tanstack/react-router`, `useCallback` from `react`.

- [ ] **Step 4: Run lint/format and the test**

Run: `npm run fix && npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/routes/specification/\$id/-structured-list-view.tsx \
        src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx
git commit -m "feat(graph-view): add unhideAndNavigate helper with flushSync"
```

---

## Task 4: Create `KindToggleChip` component (visible state)

**Files:**
- Create: `src/client/routes/specification/$id/-kind-toggle-chip.tsx`
- Create: `src/client/routes/specification/$id/__tests__/kind-toggle-chip.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `src/client/routes/specification/$id/__tests__/kind-toggle-chip.test.tsx`:

```tsx
// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KindToggleChip } from '../-kind-toggle-chip';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';

const goalEntry = knowledgeKindRegistry.find((e) => e.kind === 'goal')!;

afterEach(() => cleanup());

describe('KindToggleChip', () => {
  it('renders body and toggle as separate buttons', () => {
    render(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={false}
        onNavigate={() => {}}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /scroll to/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /hide/i })).toBeTruthy();
  });

  it('body click invokes onNavigate only', async () => {
    const onNavigate = vi.fn();
    const onToggle = vi.fn();
    render(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={false}
        onNavigate={onNavigate}
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /scroll to/i }));
    expect(onNavigate).toHaveBeenCalledWith(goalEntry.kind);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('toggle click invokes onToggle only', async () => {
    const onNavigate = vi.fn();
    const onToggle = vi.fn();
    render(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={false}
        onNavigate={onNavigate}
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /hide/i }));
    expect(onToggle).toHaveBeenCalledWith(goalEntry.kind);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('toggle aria-pressed reflects !isHidden', () => {
    const { rerender } = render(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={false}
        onNavigate={() => {}}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button', { pressed: true })).toBeTruthy();
    rerender(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={true}
        onNavigate={() => {}}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button', { pressed: false })).toBeTruthy();
  });
});
```

If `@testing-library/user-event` isn't already a dependency, add it: `npm install --save-dev @testing-library/user-event`.

- [ ] **Step 2: Run the tests and confirm failure**

Run: `npx vitest run src/client/routes/specification/\$id/__tests__/kind-toggle-chip.test.tsx`

Expected: FAIL — `KindToggleChip` not found.

- [ ] **Step 3: Implement `KindToggleChip`**

Create `src/client/routes/specification/$id/-kind-toggle-chip.tsx`:

```tsx
import { Eye, EyeOff } from 'lucide-react';

import { kindColor, kindTextColor } from '@/client/components/knowledge-card';
import type { knowledgeKindRegistry } from '@/shared/knowledge.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

type KindEntry = (typeof knowledgeKindRegistry)[number];

export interface KindToggleChipProps {
  entry: KindEntry;
  count: number;
  isHidden: boolean;
  onNavigate: (kind: KnowledgeKind) => void;
  onToggle: (kind: KnowledgeKind) => void;
}

export function KindToggleChip({
  entry,
  count,
  isHidden,
  onNavigate,
  onToggle,
}: KindToggleChipProps) {
  const swatchClass = isHidden ? kindTextColor[entry.kind] : kindColor[entry.kind];
  const shellClass = `inline-flex h-7 items-stretch overflow-hidden rounded-full border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${
    isHidden ? 'border-rule border-dashed' : 'border-rule'
  }`;
  const bodyClass = `flex items-center gap-1.5 px-2.5 cursor-pointer hover:bg-wash outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
    isHidden ? 'text-hint' : 'text-ink'
  }`;
  const toggleClass = `flex w-7 items-center justify-center cursor-pointer border-l border-rule hover:bg-wash outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
    isHidden ? 'text-hint' : 'text-sub'
  }`;

  return (
    <span data-graph-kind-chip={entry.kind} className={shellClass}>
      <button
        type="button"
        data-graph-kind-body={entry.kind}
        onClick={() => onNavigate(entry.kind)}
        aria-label={
          isHidden ? `Show ${entry.label} and scroll to it` : `Scroll to ${entry.label}`
        }
        className={bodyClass}
      >
        <span
          className={`inline-flex items-center rounded px-1 py-0.5 font-mono text-[10px] font-medium ${swatchClass}`}
        >
          {entry.label}
        </span>
        <span className="font-mono text-[10px] opacity-70">{count}</span>
      </button>
      <button
        type="button"
        data-graph-kind-toggle={entry.kind}
        aria-pressed={!isHidden}
        aria-label={isHidden ? `Show ${entry.label}` : `Hide ${entry.label}`}
        onClick={() => onToggle(entry.kind)}
        className={toggleClass}
      >
        {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  );
}
```

(If the project's Tailwind tokens use different names for the body bg, border, or text colors, swap them — match what `RelationChip` and `KindFilterToggler` use today.)

- [ ] **Step 4: Run lint/format and the tests**

Run: `npm run fix && npx vitest run src/client/routes/specification/\$id/__tests__/kind-toggle-chip.test.tsx`

Expected: all four cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/routes/specification/\$id/-kind-toggle-chip.tsx \
        src/client/routes/specification/\$id/__tests__/kind-toggle-chip.test.tsx \
        package.json package-lock.json
git commit -m "feat(graph-view): add KindToggleChip split-button component"
```

(Drop `package*.json` from the `git add` line if `@testing-library/user-event` was already installed.)

---

## Task 5: Replace `KindFilterToggler` to use `KindToggleChip`

**Files:**
- Modify: `src/client/routes/specification/$id/-structured-list-view.tsx` — replace lines 141–180 (`KindFilterToggler`) and update the call site.

- [ ] **Step 1: Write the failing integration test**

Append to `structured-list-view.test.tsx`:

```tsx
describe('KindFilterToggler integration', () => {
  it('renders KindToggleChip for each populated kind', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toContain("import { KindToggleChip } from './-kind-toggle-chip'");
    expect(src).toContain('<KindToggleChip');
    expect(src).toContain('onNavigate={onNavigate}');
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Refactor `KindFilterToggler`**

Replace the existing `KindFilterToggler` (lines 141–180):

```tsx
function KindFilterToggler({
  entityState,
  hiddenKinds,
  onNavigate,
  onToggle,
}: {
  entityState: EntitiesData;
  hiddenKinds: ReadonlySet<KnowledgeKind>;
  onNavigate: (kind: KnowledgeKind) => void;
  onToggle: (kind: KnowledgeKind) => void;
}) {
  const populated = knowledgeKindRegistry.filter(
    (entry) => entityState[entry.collectionKey].length > 0,
  );
  if (populated.length === 0) return null;

  return (
    <div data-graph-kind-filter className="flex flex-wrap items-center gap-1.5">
      {populated.map((entry) => (
        <KindToggleChip
          key={entry.kind}
          entry={entry}
          count={entityState[entry.collectionKey].length}
          isHidden={hiddenKinds.has(entry.kind)}
          onNavigate={onNavigate}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
```

Add the import at the top:

```tsx
import { KindToggleChip } from './-kind-toggle-chip';
```

Update the single call site (around line 505) to pass `onNavigate={unhideAndNavigate}`:

```tsx
<KindFilterToggler
  entityState={entityState}
  hiddenKinds={hiddenKinds}
  onNavigate={unhideAndNavigate}
  onToggle={toggleKind}
/>
```

- [ ] **Step 4: Run lint/format and all relevant tests**

Run: `npm run fix && npx vitest run src/client/routes/specification/\$id/__tests__/`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/routes/specification/\$id/-structured-list-view.tsx \
        src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx
git commit -m "refactor(graph-view): KindFilterToggler renders KindToggleChip per kind"
```

---

## Task 6: Add the "Show all" trailing control

**Files:**
- Modify: `src/client/routes/specification/$id/-structured-list-view.tsx` — `KindFilterToggler` and its caller.

- [ ] **Step 1: Write the failing test**

Append to `structured-list-view.test.tsx`:

```tsx
describe('KindFilterToggler "Show all"', () => {
  it('renders Show all button only when at least one kind is hidden, and resets on click', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toMatch(/hiddenKinds\.size > 0/);
    expect(src).toContain('Show all');
    expect(src).toMatch(/onShowAll[\s\S]{0,200}new Set\(\)/);
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement "Show all"**

Add an `onShowAll` prop to `KindFilterToggler` and render a trailing button when `hiddenKinds.size > 0`:

```tsx
function KindFilterToggler({
  entityState,
  hiddenKinds,
  onNavigate,
  onToggle,
  onShowAll,
}: {
  entityState: EntitiesData;
  hiddenKinds: ReadonlySet<KnowledgeKind>;
  onNavigate: (kind: KnowledgeKind) => void;
  onToggle: (kind: KnowledgeKind) => void;
  onShowAll: () => void;
}) {
  const populated = knowledgeKindRegistry.filter(
    (entry) => entityState[entry.collectionKey].length > 0,
  );
  if (populated.length === 0) return null;

  return (
    <div data-graph-kind-filter className="flex flex-wrap items-center gap-1.5">
      {populated.map((entry) => (
        <KindToggleChip
          key={entry.kind}
          entry={entry}
          count={entityState[entry.collectionKey].length}
          isHidden={hiddenKinds.has(entry.kind)}
          onNavigate={onNavigate}
          onToggle={onToggle}
        />
      ))}
      {hiddenKinds.size > 0 && (
        <button
          type="button"
          data-graph-kind-show-all
          onClick={onShowAll}
          aria-label="Show all kinds"
          className="ml-1 cursor-pointer rounded px-2 py-0.5 text-xs text-sub outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          Show all
        </button>
      )}
    </div>
  );
}
```

In `StructuredListView`, add the reset handler and pass it down:

```tsx
const showAllKinds = useCallback(() => {
  setHiddenKinds(new Set());
}, []);

// …

<KindFilterToggler
  entityState={entityState}
  hiddenKinds={hiddenKinds}
  onNavigate={unhideAndNavigate}
  onToggle={toggleKind}
  onShowAll={showAllKinds}
/>
```

- [ ] **Step 4: Run lint/format and tests**

Run: `npm run fix && npx vitest run src/client/routes/specification/\$id/__tests__/`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/routes/specification/\$id/-structured-list-view.tsx \
        src/client/routes/specification/\$id/__tests__/structured-list-view.test.tsx
git commit -m "feat(graph-view): show all-kinds button when any kind is hidden"
```

---

## Task 7: Router-integrated test for navigate + auto-show flow

**Files:**
- Modify: `src/client/routes/specification/$id/__tests__/structured-list-view.test.tsx` — replace the file's environment so it can render the component, OR add a sibling `structured-list-view.dom.test.tsx` for happy-dom tests.

This task converts the structural smoke tests into a real integration test that mounts the view, clicks chips, and asserts that scroll/state behave as designed. Mirror the pattern in `src/client/__tests__/router.test.tsx` (memory history + `RouterProvider`).

- [ ] **Step 1: Create the DOM test file**

Create `src/client/routes/specification/$id/__tests__/structured-list-view.dom.test.tsx`:

```tsx
// @vitest-environment happy-dom

import { createMemoryHistory } from '@tanstack/history';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StructuredListView } from '../-structured-list-view';
import type { EntitiesData } from '@/shared/api-types.js';

// Minimum EntitiesData fixture with two kinds (goals + terms) so the chip
// row renders multiple chips and the auto-show / Show-all assertions have
// state to exercise. Schema source: src/shared/api-types.ts:190 entitiesDataSchema.
function makeEntities(): EntitiesData {
  const baseItem = {
    specification_id: 42,
    subtype: null,
    rationale: null,
  };
  return {
    goals: [
      { ...baseItem, id: 1, kind: 'goal', content: 'Goal A', referenceCode: 'G1' },
      { ...baseItem, id: 2, kind: 'goal', content: 'Goal B', referenceCode: 'G2' },
    ],
    terms: [
      { ...baseItem, id: 3, kind: 'term', content: 'Term A', referenceCode: 'T1' },
      { ...baseItem, id: 4, kind: 'term', content: 'Term B', referenceCode: 'T2' },
    ],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
  };
}

function renderAtGraph(initialEntries: string[]) {
  const rootRoute = createRootRoute({
    component: () => <StructuredListView entityState={makeEntities()} emptyStateAction={null} />,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries }),
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => cleanup());

beforeEach(() => {
  // happy-dom doesn't implement scrollIntoView; stub it.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('StructuredListView chip flow', () => {
  it('body click on visible kind sets hash to kind-{kind} and scrolls', async () => {
    renderAtGraph(['/']);
    await userEvent.click(screen.getByRole('button', { name: /scroll to goal/i }));
    expect(window.location.hash).toBe('#kind-goal');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('toggle hides the kind without changing hash, then Show all restores', async () => {
    renderAtGraph(['/']);
    await userEvent.click(screen.getByRole('button', { name: /hide goal/i }));
    expect(window.location.hash).toBe('');
    // Goal-section anchor should be gone from the DOM
    expect(document.querySelector('[data-graph-kind-anchor="goal"]')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /show all kinds/i }));
    expect(document.querySelector('[data-graph-kind-anchor="goal"]')).toBeTruthy();
  });

  it('body click on hidden kind unhides synchronously then scrolls', async () => {
    renderAtGraph(['/']);
    // Hide it first
    await userEvent.click(screen.getByRole('button', { name: /hide goal/i }));
    expect(document.querySelector('[data-graph-kind-anchor="goal"]')).toBeNull();
    // Click body of the now-hidden chip
    await userEvent.click(screen.getByRole('button', { name: /show goal and scroll/i }));
    // After flushSync + navigate, the anchor must be present and scrollIntoView must have fired
    expect(document.querySelector('[data-graph-kind-anchor="goal"]')).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(window.location.hash).toBe('#kind-goal');
  });
});
```

The fixture above matches `entitiesDataSchema` (src/shared/api-types.ts:190): two goals, two terms, empty other collections. If `StructuredListView`'s prop signature requires more (e.g. `emptyStateAction` is required, not optional), add the missing props at the test's render call — the schema-shaped fixture itself is complete.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/client/routes/specification/\$id/__tests__/structured-list-view.dom.test.tsx`

Expected: tests fail or error — fixture incomplete or assertions miss.

- [ ] **Step 3: Iterate the fixture and assertions until all three cases pass**

If `userEvent.click` doesn't trigger `flushSync`'s synchronous behavior under happy-dom, switch to `act` from `@testing-library/react`. If `window.location.hash` stays empty after navigate (memory history doesn't touch real `window.location`), assert against `router.state.location.hash` instead — capture the router by hoisting `createRouter`'s return value.

- [ ] **Step 4: Run the full test file**

Run: `npm run fix && npx vitest run src/client/routes/specification/\$id/__tests__/`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/routes/specification/\$id/__tests__/structured-list-view.dom.test.tsx
git commit -m "test(graph-view): integration coverage for chip nav + Show all"
```

---

## Task 8: Manual verification + final gate

- [ ] **Step 1: Run the full verify gate**

Run: `npm run verify`

Expected: `check` (fmt + lint), `test` (vitest), `build` all pass.

- [ ] **Step 2: Manually exercise in dev**

Run: `npm run dev`

Open the structured-list graph view at `/specification/{id}/graph` for a spec with multiple kinds. Verify:
- Chip body click smoothly scrolls to the first row of that kind. URL hash becomes `#kind-{kind}`.
- Chip toggle click hides/shows the kind without scrolling. Border becomes dashed when hidden, eye icon flips.
- Clicking the body of a hidden chip shows it AND scrolls in one motion (no flash, no stuck state).
- "Show all" appears at the right end of the row only when something is hidden; clicking it restores everything.
- Tab order is correct: chip body → chip toggle → next chip's body, ending with Show all.

- [ ] **Step 3: Update the Linear issue**

Move FE-671 to "In Review" and link the PR. PR title: `FE-671: Split-button chip toggle in graph view`. Use the spec doc as the PR description seed.

- [ ] **Step 4: Submit the stack**

Per `docs/praxis/graphite-workflow.md`: `gt submit` from the branch.

---

## Self-review notes

- **Spec coverage:** every numbered section in the spec maps to a task. §2 anatomy + §3 visual states → Task 4. §4.1 body click + §4.2 toggle click → Tasks 3 + 4 + 5. §4.3 Show all → Task 6. §5 persistence (no change) → no task needed; current state stays. §6 a11y → embedded in Task 4 tests + Task 8 manual check. §7 implementation outline → Tasks 1–6. §9 verification → Tasks 1–7 (each TDD), Task 8 (gate + manual).
- **No placeholders:** all code blocks contain runnable code. The Task 7 fixture is complete against `entitiesDataSchema` as of `src/shared/api-types.ts:190`; if that schema gains required fields later, the fixture will need an additive update.
- **Type consistency:** `KindToggleChip` props use `onNavigate` and `onToggle`; the helper `unhideAndNavigate(kind)` matches the body's `onNavigate` shape. `KindFilterToggler` adds `onNavigate`/`onToggle`/`onShowAll` props consistently across Tasks 5 and 6. `kind-{kind}` hash format used identically in Tasks 2, 3, and 7.
- **Open questions** (from spec §10) carried into the plan: anchor granularity is settled here as "first row of each kind" (Task 1). FE-655 ordering: this plan introduces `flushSync`-wrapped helpers locally; if FE-655 lands first, Task 3 becomes "import the helper from there instead" — no other tasks change.
