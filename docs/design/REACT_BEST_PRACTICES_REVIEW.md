# React Best Practices Review

Date: 2026-04-09

## Scope

Read-only review of the client React code, guided by the `refs-react-best-practices` skill.

Primary focus areas:

- `src/client/components`
- `src/client/routes`
- `src/client/workspace`
- `src/client/capabilities`
- `package.json` and client-facing dependency usage

Guideline categories applied:

- Eliminating Waterfalls
- Bundle Size Optimization
- Client-Side Data Fetching
- Re-render Optimization
- Rendering Performance

## Executive Summary

The codebase is in better shape than a typical mid-build React app on two important fronts: the route loader avoids a fetch waterfall, and the heavy markdown/code-highlighting paths are already split behind dynamic imports with intent-based preloading.

The biggest React-facing problems I found are:

1. repeated imports from the umbrella `radix-ui` package in a Vite app, which is a bundle/dev-boot anti-pattern under the review rubric
2. a small cluster of effect-driven state synchronization patterns that mirror render-derivable data or loader data after the first paint
3. one reusable input component that registers global document listeners per instance when an opt-in mode is enabled

## Findings

1. **UI primitives import from the `radix-ui` umbrella barrel across the client design system** — category: bundle — impact: high

   The review rubric flags barrel imports as a critical bundle-size and cold-start problem for non-Next projects. This repo is a Vite app, so there is no `optimizePackageImports` transform available to erase the runtime/dev-server cost of broad entrypoint imports.

   The pattern appears throughout the local UI primitives, for example:

   - `src/client/components/ui/button.tsx:2`
   - `src/client/components/ui/dialog.tsx:2`
   - `src/client/components/ui/select.tsx:4`
   - `src/client/components/ui/dropdown-menu.tsx:4`
   - `src/client/components/ui/tooltip.tsx:3`
   - `src/client/components/ui/hover-card.tsx:1`
   - `src/client/components/ui/separator.tsx:1`
   - `src/client/components/ui/collapsible.tsx:1`

   A repo-wide search finds 10 client UI wrapper modules importing from `radix-ui` directly. That broad entrypoint is especially suspicious because the guideline explicitly calls out Radix-style component packages as common barrel-import offenders.

   Why this matters here: the app has already done the harder, higher-value work of isolating heavy features like markdown and syntax highlighting. Pulling local design-system wrappers from an umbrella package gives some of that gain back during dev startup, dependency scanning, and cold bundles.

   Suggested action: switch these wrappers to the smallest supported package entrypoints or package-specific imports, then re-measure dev boot and build output.

2. **Chat state is reset from props in an effect instead of through a keyed reset/remount boundary** — category: rerender — impact: medium-high

   The React guidance used for this review recommends not setting state in effects solely in response to prop changes; prefer deriving during render or using keyed resets when the intent is to replace a subtree's state.

   In `src/client/workspace/workspace-controller.ts:67-83`, `useChat()` is created once and then `useChatHydrationBoundary()` patches its internal message state after render. The reset logic lives in `src/client/workspace/chat-hydration.ts:22-38`, where an effect calls `setMessages(seedMessages)` whenever the project changes.

   This creates an avoidable two-phase update on project navigation:

   - render with the previous hook state
   - then run an effect that overwrites messages with the new seed data

   That pattern is exactly the kind of post-render synchronization the guideline warns about. It risks a stale-frame flash of the prior project's transcript and makes the reset behavior harder to reason about than a keyed chat subtree would be.

   Suggested action: move the `useChat()` owner behind a `key={projectId}` boundary or otherwise recreate the chat controller when the project identity changes, so the reset happens as part of mount rather than as an effect-driven correction.

3. **Workspace entity data is mirrored from route loader state into React Query in an effect** — category: rerender/client-data — impact: medium

   `src/client/workspace/workspace-data.ts:40-50` seeds `useQuery()` with `initialData`, but it also runs `queryClient.setQueryData(...)` in an effect at `src/client/workspace/workspace-data.ts:42-44` whenever the loader snapshot changes.

   That means the route loader snapshot and the React Query cache are acting as two sources of truth for the same data, with an effect keeping them in sync after render.

   Why this is a React smell:

   - it introduces a post-render synchronization step for data that already exists before render
   - it makes stale-vs-fresh ownership harder to understand
   - it creates the same extra-render/stale-frame risk as other derived-state-in-effect patterns

   The pattern may be functionally correct, but it is working against the grain of both React and TanStack Query. Either the route loader should own the snapshot and pass it straight through, or the query cache should be the authoritative source without an effect-based bridge.

   Suggested action: collapse this to one authority for entity data per route transition. If React Query is the owner, hydrate it before render or remount on project identity changes instead of syncing it in an effect.

4. **`MessageBranch` stores branch metadata derived from `children` and synchronizes it through an effect** — category: rerender — impact: medium

   In `src/client/components/ai-elements/message.tsx:137-140`, `MessageBranch` stores `branches` in state and derives `totalBranches` plus `branchSignature` from that state. Then `MessageBranchContent` computes `childrenArray` from `children` and uses an effect at `src/client/components/ai-elements/message.tsx:196-200` to push those children back into the parent state via `setBranches(childrenArray)`.

   This is another mirror-state pattern: branch count and signature are render-derivable from the current children, but the component waits for a second pass to synchronize them.

   Consequences:

   - at least one extra render whenever branch structure changes
   - more moving parts than necessary for what is effectively derived metadata
   - more surface area for branch-selector behavior to drift from the rendered children

   Suggested action: derive branch count/signature directly from render inputs or colocate the branch metadata where the children array is already available, instead of storing it as state and syncing it via `useEffect`.

5. **`PromptInput` global drop mode installs document-level listeners per component instance** — category: client-data — impact: low

   The review rubric recommends deduplicating global listeners. In `src/client/components/ai-elements/prompt-input.tsx:681-705`, enabling `globalDrop` causes each `PromptInput` instance to attach its own `document`-level `dragover` and `drop` listeners.

   This is low severity in the current app because the main workspace appears to render a single prompt input, but the component itself is reusable. If multiple instances are ever mounted together, the code scales listeners linearly with component count.

   This is not a passive-listener issue, because these handlers intentionally call `preventDefault()`. It is a listener-ownership issue: a global behavior is being installed at component instance scope.

   Suggested action: if `globalDrop` remains part of the public API, move it behind a singleton subscription or an app-level drop manager so N prompt inputs do not imply N document listeners.

## Positive Notes

- `src/client/workspace/workspace-loader.ts:8-18` fetches project state and entity state in `Promise.all(...)`, which avoids a route-loader waterfall.
- `src/client/capabilities/markdown-rendering.tsx:54-95` and `src/client/capabilities/code-highlighting.ts:17-49` keep heavy markdown and Shiki code-highlighting logic behind dynamic imports and explicit preload helpers.
- `src/client/routes/debug-surface.tsx:3-10` lazily loads the debug surface instead of pulling it into the main route graph.

## Watchlist

- `lucide-react` is imported from 11 client files. The same barrel-import guidance applies there too, but the tradeoff is messier because deep icon imports can have TypeScript ergonomics issues depending on package export support.
- There are a few low-value memoizations that are not harmful but add ceremony, such as `src/client/components/ai-elements/shimmer.tsx:41` (`useMemo` around a primitive arithmetic result) and `src/client/workspace/workspace-data.ts:40` (`useMemo` around a tiny array key). I would not churn code just to remove them, but I would avoid adding more of this style.

## Recommended Order Of Attack

1. Replace the umbrella `radix-ui` imports with narrower package imports and measure the effect on dev startup/build output.
2. Remove the effect-driven chat reset by putting the chat controller behind a project-keyed ownership boundary.
3. Collapse route-loader/entity-query duplication so one layer owns entity state during route transitions.
4. Simplify `MessageBranch` so branch metadata is derived, not synchronized.
5. Only if `PromptInput` is expected to be reused in multiple places, centralize `globalDrop` listener ownership.
