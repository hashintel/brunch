# Scope: Workspace Semantic Shell Scaffolding

**Slice**: PLAN.md Active #1
**Weight**: Full scope card
**Status**: scoped

## Orientation

- **Containing seam**: dashboard navigation + project workspace shell (`ProjectList`, `ProjectLayout`, `ViewLayout`, `InterviewView`, sidebars).
- **Frontier item**: `memory/PLAN.md` Active #1 "Workspace semantic shell scaffolding."
- **Volatile state**: the product contract has shifted from generic chat to structured interview workspace (D89, D90, D91), but the live app still strands users in composer-only or semantically misleading states.
- **Main open risk**: scope creep — this slice must make the shell truthful in low fidelity without absorbing full transcript fidelity, review-set implementation, kickoff relocation, or router/query redesign.

## Target Behavior

Each phase route in the workspace projects its current workflow state as an explicit, truthful affordance — entry, active, handoff, or completion — and the surrounding navigation/transcript shell no longer defaults to an empty chat surface with a generic composer as the primary affordance.

## Boundary Crossings

```text
→ Dashboard / ProjectList
  → project cards use real Link semantics
  → dashboard surface remains scrollable

→ ProjectLayout / PhaseNavigationSidebar
  → phase rows reflect truthful workflow semantics
  → closed and current phases are reachable
  → future unopened phases stay visible-but-disabled
  → unstarted phases no longer present as readiness="low"

→ Interview controller/view-model seam
  → workflow + turn/transcript state project into shell state
  → shell distinguishes entry | active-turn | awaiting-next-action | handoff | completion

→ Phase view shell (`InterviewView` and route surfaces)
  → active-turn phases keep the turn card as primary elicitation input
  → review phases visibly stage as review-shaped shells, not ordinary chat
  → non-active states expose explicit next actions instead of a bare composer

→ Transcript rendering
  → currently hidden assistant/meta artifacts render as truthful low-fidelity placeholders
  → transcript omission becomes visible structure rather than silent disappearance
```

## Detailed Surface Contracts

### Dashboard (`src/client/routes/-project-list.tsx`)

| Current | Target |
| --- | --- |
| Project cards mutate router state on click | Project cards are real `Link`s (`cmd-click` / new-tab semantics work) |
| Dashboard can be clipped by shell overflow | Project list remains scrollable to all items |

### Phase sidebar (`src/client/routes/project/$id/route.tsx`)

| Phase condition | Current | Target |
| --- | --- | --- |
| Future unopened phase | Navigable `Link`, misleading `Low` badge | Visible-but-disabled row with truthful unstarted labeling |
| Current phase, unstarted | Looks like generic low-readiness item | Reachable current row with truthful unstarted semantics |
| In-progress phase | Reachable with readiness | Reachable with readiness + closeability signals |
| Closed phase | Reachable with readiness badge | Reachable with done/handoff semantics, not readiness-as-progress |

### Workspace shell (`src/client/routes/project/$id/_view/-interview-view.tsx`)

| Shell state | Target |
| --- | --- |
| Entry | Named phase intro + begin CTA; no bare composer-only shell |
| Active turn | Existing turn-card interaction remains primary |
| Awaiting next action | Explicit continue/review CTA above any optional composer |
| Handoff | Closed-phase summary + next-phase CTA |
| Completion | Completion message + export CTA |

### Review phases (`requirements`, `criteria`)

| Current | Target |
| --- | --- |
| Reuse generic interview shell | Distinct review-shell framing, even if only placeholder-level |
| Same affordance vocabulary as scope/design | Review-oriented explanatory banner / action copy |

### Transcript/meta shell

| Current | Target |
| --- | --- |
| Hidden assistant/meta artifacts simply disappear | Low-fidelity placeholder rows surface structured-question, observer/result, and closure/meta events truthfully within the transcript |
| Bare composer often becomes the only obvious affordance | Transcript + state card show what happened and what action is valid next |

## Data Available (No backend redesign required)

This slice should stay inside already-available client data:

- `ProjectState.workflow.phases[*]`
- `ProjectState.turns`
- hydrated phase-filtered chat messages from the existing controller
- `getNextActivePhase()` / `phaseOrder`

It may add client-side shell-state projection, but should not require router/query ownership redesign or new server persistence seams.

## Risks and Assumptions

```text
- RISK: The shell logic sprawls across route files with ad hoc conditionals.
  → MITIGATION: centralize shell-state projection near the interview view/controller seam.

- RISK: This slice accidentally widens into full transcript fidelity.
  → MITIGATION: only render low-fidelity truthful placeholders for artifacts the client already knows about.

- RISK: Review phases still feel like ordinary interview turns with relabeled copy.
  → MITIGATION: require a visibly distinct review-shell framing in this slice, even before real review sets land.

- ASSUMPTION: The active-turn card can own primary elicitation input while non-active states omit or demote the composer.
  → VALIDATE: seeded walkthroughs on kickoff-ready, design-active, and scope-closed scenarios.
  → memory/SPEC.md §Assumptions: A51.

- ASSUMPTION: Contentless/low-detail placeholders are sufficient to restore transcript trust at shell level before the transcript-fidelity slice lands.
  → VALIDATE: see-and-inspect walkthrough after reload/hydration.
  → memory/SPEC.md §Assumptions: A53.
```

## Acceptance Criteria

```text
✓ dashboard-link-semantics — project cards render as Links and support normal link behaviors
✓ dashboard-scroll — the dashboard/project list remains scrollable to all items
✓ sidebar-phase-gating — future unopened phases are visible but not navigable
✓ sidebar-truthful-labels — unstarted phases no longer appear as readiness="Low"
✓ shell-entry-state — unstarted current phases show an explicit phase-entry affordance instead of an empty composer shell
✓ shell-active-turn-state — active elicitation continues to use the turn card as the primary input surface
✓ shell-awaiting-next-action — in-progress phases without an active turn show an explicit continue/review affordance above any optional composer
✓ shell-handoff-state — closed phases show a summary and next-phase CTA
✓ shell-completion-state — final completion shows a completion/export affordance
✓ review-phase-differentiation — requirements/criteria visibly stage as review shells rather than ordinary interview shells
✓ transcript-meta-placeholders — hidden assistant/meta artifacts render as truthful low-fidelity placeholders within the transcript
✓ composer-demotion — the generic bottom composer is never the sole primary affordance in entry, handoff, or completion states
✓ verify-gate — `npm run verify` passes
```

## Verification Approach

```text
- Inner: focused component/controller tests for shell-state projection, phase-nav gating, link semantics, and transcript placeholder rendering. Protects: I24, I72, I102.

- Middle: route-level state projection checks against seeded-style workflow fixtures (kickoff-ready, design-active, scope-closed, criteria-ready, all-phases-closed).

- Outer: browser see-and-inspect walkthrough confirming the workspace no longer strands the user in empty or misleading states and that transcript/meta omissions are staged honestly.
```

## Explicit Exclusions

These remain out of scope for this slice:

- full transcript-fidelity reconstruction
- actual requirements/criteria review-set implementation
- kickoff relocation out of root-route modal flow
- router/query ownership redesign
- story-first pattern exploration in Ladle
- final styling / polish
- deep right-sidebar IA redesign beyond shell-honesty fixes needed to keep content reachable

## Traceability

- **Requirements**: 2, 4, 5, 8, 11, 12, 15, 17
- **Assumptions**: A51, A52, A53
- **Decisions**: D86, D89, D90, D91, D92
- **Invariants**: I24, I72, I102
- **PLAN.md**: Active #1 → status: scoped
