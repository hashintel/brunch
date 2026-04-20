# Continuous Workspace Hybrid Design

> Design exploration from 2026-04-20.
> Status: **proposed direction** — hybrid continuous workspace with preserved phase addressability.
> Canonicality: this is a focused design note for the interview workspace shape, not the live product authority. For what is true now and what should happen next, prefer `memory/SPEC.md` and `memory/PLAN.md`.

## Why this note exists

The current interview workspace behaves like one long four-phase conversation, but the center pane is still entered through four separate phase routes:

- `/project/$id/grounding`
- `/project/$id/elicitation`
- `/project/$id/requirements-review`
- `/project/$id/acceptance-review`

That route split buys deep-linking, gating, and some clean reset boundaries, but it also makes phase handoff feel more page-like than conversation-like.

This note evaluates three shapes for a more continuous workspace and recommends the smallest hybrid that changes the user experience without prematurely deleting route affordances that still carry useful meaning.

## Current constraints

Any replacement needs to preserve these constraints from the current architecture:

1. Durable workflow truth stays loader-derived and server-authored.
2. The app keeps one chat session per specification, not one `useChat` per rendered phase.
3. `ProjectLayout` and `ViewLayout` remain the main loader/layout shells.
4. Graph view remains a sibling mode of chat view, selected via the `view` search param.
5. Workflow gating stays honest: future phases may be visible, but only the current reachable phase is actionable.
6. During migration, phase URLs should remain deep-linkable even if they stop being the primary rendering boundary.

## Design A: Route-Alias Continuous View

### Shape

Keep the current route tree, but make each phase route render the same continuous workspace component instead of a phase-filtered workspace.

The route still provides a focused phase key, but only as an initial scroll target / highlighted section.

```typescript
function ContinuousWorkspaceView({ focusedPhase }: { focusedPhase: WorkflowPhase })

function useContinuousWorkspace(focusedPhase: WorkflowPhase): ContinuousWorkspaceModel
```

### Usage

```typescript
function GroundingView() {
  return <ContinuousWorkspaceView focusedPhase="scope" />
}

function RequirementsReviewView() {
  return <ContinuousWorkspaceView focusedPhase="requirements" />
}
```

### What it hides

- one shared `useChat` session
- scroll-to-section on route entry
- section highlighting and scroll-spy state
- continuous transcript projection across all phases

### Trade-offs

Pros:
- minimal route churn
- preserves all current URLs
- easy rollback

Cons:
- route layer still pretends each phase is a separate screen
- active-phase focus can drift from route URL after scrolling
- keeps more compatibility surface than the product likely wants long-term

## Design B: Workspace Controller With Phase Addressability

### Shape

Introduce one workspace-level controller that owns the chat session, hydrated transcript, per-phase section projection, and phase focus behavior.

Routes remain, but they become addressability shims rather than the primary state partition.

```typescript
type WorkspaceFocusSource =
  | { kind: 'route'; phase: WorkflowPhase }
  | { kind: 'scroll'; phase: WorkflowPhase }
  | { kind: 'system'; phase: WorkflowPhase }

interface WorkspaceSection {
  phase: WorkflowPhase
  title: string
  status: WorkflowPhaseState['status']
  readiness: WorkflowPhaseState['readiness']
  isReachable: boolean
  isFocused: boolean
  turnCount: number
  artifacts: WorkspaceStreamArtifact[]
  bottomArtifact: InterviewControllerBottomArtifactState | null
}

interface WorkspaceNavigation {
  focusedPhase: WorkflowPhase
  visiblePhase: WorkflowPhase
  focusPhase: (phase: WorkflowPhase, options?: { replace?: boolean }) => void
  scrollToPhase: (phase: WorkflowPhase) => void
  focusNextReachablePhase: () => void
}

interface WorkspaceChat {
  messages: readonly BrunchUIMessage[]
  status: ChatStatus
  isLoading: boolean
  submitText: (text: string) => void
  confirmPhaseClosure: (phase: WorkflowPhase, turnId: number) => void
  forcePhaseClosure: (phase: WorkflowPhase) => void
}

interface ContinuousWorkspaceController {
  project: InterviewDurableProjectState['project']
  workflow: InterviewDurableProjectState['workflow']
  sections: readonly WorkspaceSection[]
  navigation: WorkspaceNavigation
  chat: WorkspaceChat
  captureStatusByTurnId: ReadonlyMap<number, 'waiting' | 'applying'>
}

function useContinuousWorkspaceController(options: {
  initialPhase: WorkflowPhase
}): ContinuousWorkspaceController
```

### Usage

```typescript
function ContinuousWorkspaceView({ initialPhase }: { initialPhase: WorkflowPhase }) {
  const workspace = useContinuousWorkspaceController({ initialPhase })

  return (
    <WorkspaceFrame
      sidebar={
        <PhaseScrollSpySidebar
          sections={workspace.sections}
          focusedPhase={workspace.navigation.focusedPhase}
          onSelectPhase={workspace.navigation.focusPhase}
        />
      }
      transcript={
        <ContinuousWorkspaceStream
          sections={workspace.sections}
          onSectionVisible={workspace.navigation.scrollToPhase}
        />
      }
    />
  )
}
```

### What it hides

- one `useChat` instance and one hydration pipeline
- phase-local selectors over one merged transcript
- route-to-section focus bridging
- close-phase behavior that scrolls/focuses instead of navigating as the primary effect
- suppression of duplicate auto-entry / auto-continue across rerenders
- stable capture status across section transitions

### Trade-offs

Pros:
- matches the product mental model of one workspace stream
- preserves deep links and migration safety
- keeps routing, data ownership, and workspace rendering as separate decisions
- creates one named client seam for future refinement

Cons:
- introduces a new controller boundary that must carefully replace phase-local reset assumptions
- scroll-spy and scroll restoration need explicit rules
- some route compatibility code remains until the cutover is complete

## Design C: Chart-Backed Workspace Supervisor

### Shape

Move the continuous workspace under a chart-backed runtime supervisor. The supervisor owns focus changes, visible section state, auto-entry/continue, close-to-next-phase motion, and section-level rendering states. The React layer mostly subscribes to chart state.

```typescript
interface WorkspaceSupervisorSnapshot {
  focusedPhase: WorkflowPhase
  visiblePhase: WorkflowPhase
  sections: readonly WorkspaceSection[]
  canAutoFocusNextPhase: boolean
}

function useWorkspaceSupervisor(options: {
  initialPhase: WorkflowPhase
  durableProject: InterviewDurableProjectState
  chat: WorkspaceChatRuntime
}): {
  snapshot: WorkspaceSupervisorSnapshot
  send: (event: WorkspaceSupervisorEvent) => void
}
```

### Usage

```typescript
const workspace = useWorkspaceSupervisor({
  initialPhase,
  durableProject,
  chat,
})

workspace.send({ type: 'SECTION_VISIBLE', phase: 'design' })
workspace.send({ type: 'PHASE_CLOSED', phase: 'scope' })
```

### What it hides

- all runtime focus transitions
- stale scroll events versus durable workflow truth
- one-shot auto behaviors
- transition legality around close, handoff, and recovery motion

### Trade-offs

Pros:
- strongest behavioral rigor
- easiest place to encode tricky scroll/focus rules without React effect sprawl
- aligns well with the existing state-machine thinking in `docs/design/state-machines/`

Cons:
- too heavy for the first cut
- adds a second major client abstraction at the same time as the UX change
- risks solving orchestration elegance before proving the simpler product move

## Comparison

### Depth

- Design A is shallowest. It changes the rendering shape but leaves route semantics half-retired.
- Design B is deepest for the likely need. Its public API is still moderate, but it hides the real complexity in one named workspace seam.
- Design C can be deepest eventually, but its extra machinery is hard to justify before the continuous workspace proves itself.

### Ease of correct use

- Design A is easy to adopt but easy to misuse because route focus and scroll focus can diverge without a clear owner.
- Design B makes the intended ownership legible: one workspace controller, many projected sections.
- Design C can be safest in theory, but only if the team wants to invest in a chart-owned client seam now.

### General-purpose vs specialized

- Design A is specialized for migration only.
- Design B is specialized for this workspace, which is a feature, not a bug.
- Design C is more general than needed for the current frontier.

### Implementation efficiency

- Design A has the lowest startup cost.
- Design B best reuses existing helpers like `projectWorkspaceStream`, `createInterviewControllerViewState`, and phase-order utilities while collapsing duplicate per-phase controller work.
- Design C would likely require the most new code and the largest test rewrite.

## Recommended direction

Choose **Design B**.

More specifically: implement a **workspace-level continuous controller** while preserving **phase addressability** during migration.

That means:

1. The center pane becomes one continuous transcript with section dividers for grounding, elicitation, requirements, and acceptance criteria.
2. The sidebar becomes a scroll-spy / section-jump surface, but still respects current workflow reachability.
3. The current phase routes remain available, but they become aliases that focus a section instead of defining a separate rendering boundary.
4. The route tree and layout shells remain intact until the continuous workspace is proven.

## Recommended module shape

### Public API

```typescript
interface ContinuousWorkspaceController {
  project: InterviewDurableProjectState['project']
  workflow: InterviewDurableProjectState['workflow']
  sections: readonly WorkspaceSection[]
  navigation: WorkspaceNavigation
  chat: WorkspaceChat
  captureStatusByTurnId: ReadonlyMap<number, 'waiting' | 'applying'>
}

function useContinuousWorkspaceController(options: {
  initialPhase: WorkflowPhase
}): ContinuousWorkspaceController
```

This is intentionally one main hook, not four phase-local hooks.

### Recommended internal composition

```typescript
function useContinuousWorkspaceController({ initialPhase }: { initialPhase: WorkflowPhase }) {
  const durableProject = useInterviewDataAdapter(...)
  const chatRuntime = useSpecificationChatRuntime(...)
  const sections = projectWorkspaceSections(durableProject, chatRuntime)
  const navigation = useWorkspacePhaseNavigation({ initialPhase, workflow: durableProject.workflow })

  return {
    project: durableProject.project,
    workflow: durableProject.workflow,
    sections,
    navigation,
    chat: chatRuntime.chat,
    captureStatusByTurnId: chatRuntime.captureStatusByTurnId,
  }
}
```

### Section projection helper

```typescript
function projectWorkspaceSections(
  durableProject: InterviewDurableProjectState,
  runtime: WorkspaceChatRuntime,
): WorkspaceSection[]
```

Responsibilities:

- derive each phase's turns from one durable turn list
- derive each phase's filtered messages from one merged message list
- project section-level artifacts via the existing workspace-stream projector logic
- keep exactly one actionable bottom artifact in the current reachable phase
- render closed and future phases as replay-only or locked sections

### Navigation helper

```typescript
function useWorkspacePhaseNavigation(options: {
  initialPhase: WorkflowPhase
  workflow: WorkflowState
}): WorkspaceNavigation
```

Responsibilities:

- map route entry to initial section focus
- update focused phase as the user scrolls
- preserve workflow gating when users jump from the sidebar
- replace current close-phase route navigation with focus-next-phase behavior
- optionally update URL with `replace: true` instead of pushing history on every scroll change

## What this boundary should hide

The controller should hide these specific complexities from the view layer:

- one `useChat` session and one hydration path
- phase-local replay compaction over a merged message stream
- auto-entry and auto-continue suppression rules
- pending close handling and next-phase focus
- stable `submittedTurnId` and capture-status tracking across section changes
- route alias compatibility during migration
- scroll-spy state versus durable workflow truth

The controller should **not** hide or redefine:

- durable workflow truth
- route loader ownership
- graph view selection
- the server's authority over phase status, readiness, or landing truth

## Migration plan

### Step 1: Preserve the route tree, replace the center-pane renderer

- Keep the current phase routes.
- Swap `InterviewView phase=...` for one `ContinuousWorkspaceView initialPhase=...`.
- Keep graph view untouched.

### Step 2: Extract workspace-level chat/runtime ownership

- Replace `useInterviewController(phase)` with `useContinuousWorkspaceController({ initialPhase })`.
- Keep existing helper logic where possible instead of rewriting projection semantics from scratch.

### Step 3: Convert the sidebar from route-active to section-active

- Maintain route links initially.
- Add section highlighting driven by scroll position.
- Change click behavior from strict route switch to `focusPhase`, while preserving URL compatibility.

### Step 4: Retire route-first assumptions

- Remove automatic dependence on route remount for phase-local state reset.
- Rewrite tests that currently assert per-phase route code-splitting as the architectural truth.

### Step 5: Decide whether route collapse is still worth doing

- If the hybrid works well, phase routes can become redirects or search-param aliases.
- If not, the product still benefits from the continuous center pane without requiring full route collapse.

## Non-goals for the first cut

- no second durable workflow model on the client
- no general runtime operations ledger
- no graph-view architecture change
- no full chart-backed client supervisor yet
- no attempt to make all future phases simultaneously interactive

## Open questions

1. Should the canonical deep-link target after migration be a search param like `?phase=design` or should the legacy phase paths remain as stable aliases indefinitely?
2. Should scrolling into a closed phase update the focused phase in the sidebar, or should the sidebar continue to privilege the current reachable phase unless the user explicitly jumps?
3. Should close-phase completion auto-scroll immediately to the next phase section, or should it reveal the handoff card first and wait for explicit continue?
4. How much of the current center-pane sticky header remains phase-scoped once the center pane shows multiple sections at once?
