# Dev Workflow Evolution — `ln-*` Skills, Spec Registry, and the Convergence Story

> Status: **working design proposal**.
> Date: 2026-05-07.
> Scope: Brunch's own development methodology — the `ln-*` agent-skill family, the `memory/` ontology that drives it, the operational protocols in `AGENTS.md`, and the long-horizon question of whether and how the dev-layer ontology converges with the product-layer ontology.
>
> This document is **not** part of `memory/SPEC.md` because it does not describe Brunch the product. It is the canonical design home for the **dev layer**: how Brunch is built. Conclusions that affect product behavior should still be promoted into `memory/SPEC.md` through `ln-spec`, but most of the material here describes self-tooling rather than user-facing capability.
>
> Source synthesis: external agent conversations captured in [`docs/archive/design/INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md). That synthesis treats both the product layer and the dev layer in the same document; this note splits the dev-layer trajectory out so the layers stop colliding.

## Why this note exists

The intent-spec branching conversation produced two parallel trajectories:

1. A **product-layer** direction — Brunch should evolve from eliciting planning specs toward eliciting intent specs, with progressive checkability, behavioral kernels, semantic edges, and graph-first context. Most of that material has now landed in `memory/SPEC.md` (Requirements 38–41, A77–A87, D125, D134–D142, I109–I112, and the Lexicon entries for `intent graph` / `progressive checkability` / `behavioral kernel` / `context pack` / `scenario runner`), focused design docs (`MULTI_CHAT.md`, `PATCH_LEDGER.md`), or the archived source synthesis (`../archive/design/INTENT_SPEC_EVOLUTION.md`).

2. A **dev-layer** direction — the same critique, applied recursively to Brunch's *own* spec workflow. The current `memory/SPEC.md` is doing many jobs at once and the markdown-mediated nature of the document creates real cognitive cost on contributing LLMs. The conversation proposed a file-backed canonical spec registry with deterministic checkers and generated views. None of this has landed anywhere except as a one-line horizon item in `memory/PLAN.md` ("Structured development spec registry").

The two trajectories share an ontology vocabulary by accident, not by design. Without a written distinction, every reference to "the spec," "the workflow," or "the ontology" inside the source conversation is ambiguous: is it Brunch the product, or Brunch the development project? This note names the layers explicitly, captures the dev-layer's current shape, sketches the proposed trajectory, and frames the long-horizon convergence question that sits above both.

## The three layers

```diagram
╭──────────────────────────────────────────────────────────────────╮
│                       Convergence layer                          │
│  Brunch develops Brunch. Shared ontology substrate, shared       │
│  progressive-checkability discipline, shared edge semantics.     │
│  Aspirational. Not committed.                                    │
╰────────────┬──────────────────────────────────┬──────────────────╯
             │                                  │
   ╭─────────▼──────────╮               ╭───────▼───────────────╮
   │   Product layer    │               │     Dev layer         │
   │                    │               │                       │
   │  What users build  │               │  How we build Brunch  │
   │  with Brunch.      │               │                       │
   │                    │               │                       │
   │  Lives in:         │               │  Lives in:            │
   │   memory/SPEC.md   │               │   AGENTS.md           │
   │   memory/PLAN.md   │               │   .agents/skills/     │
   │   docs/design/*    │               │     ln-*/             │
   │   src/             │               │   memory/SPEC.md *    │
   │                    │               │   memory/PLAN.md *    │
   │  Ontology:         │               │   docs/praxis/*       │
   │   intent graph,    │               │   docs/design/*       │
   │   knowledge items, │               │                       │
   │   relations,       │               │  Ontology:            │
   │   reviews,         │               │   requirements,       │
   │   reconciliation   │               │   assumptions,        │
   │   needs, …         │               │   decisions,          │
   │                    │               │   invariants,         │
   │  Workflow:         │               │   criteria, …         │
   │   four-phase       │               │                       │
   │   interview        │               │  Workflow:            │
   │                    │               │   ln-* skill chain    │
   ╰────────────────────╯               ╰───────────────────────╯
                                          * memory/SPEC.md and
                                            memory/PLAN.md are
                                            currently shared
                                            substrate but they
                                            describe Brunch the
                                            built thing, not
                                            Brunch the product
                                            users would use.
```

A few things follow from drawing the layers explicitly:

- **`memory/SPEC.md` is dev-layer infrastructure that happens to describe a product.** It is not the product's own ontology surface. When a future Brunch user opens a Brunch project, they do not see `memory/SPEC.md`; they see their own intent graph. The naming overlap (both the dev layer and the product layer use words like *requirement*, *assumption*, *decision*, *invariant*, *criterion*) is convergence pressure, not current convergence.

- **The `ln-*` skills are the dev-layer workflow.** They are the analog of Brunch's four-phase interview, but for our team's spec-building. The product's interview produces a user's intent graph; the `ln-*` chain produces the canonical state of `memory/SPEC.md` and `memory/PLAN.md`.

- **`AGENTS.md`** sits above both as repo-level operational protocol — it owns verification harness conventions, branch-and-tracker conventions, and the canonical pointer to where each layer's truth lives.

The rest of this document focuses on the dev layer.

## Dev layer — current shape

The dev workflow today is a markdown-mediated discipline executed by agent skills against canonical files in `memory/`. It works, but the workings are not collected anywhere.

### The `ln-*` skill family

The skills at `.agents/skills/ln-*/` form a chain organized by purpose:

```diagram
╭──────────────╮   ╭──────────╮   ╭──────────╮   ╭────────────╮
│  Knowledge   │   │ ln-grill │──▶│ ln-spec  │──▶│  ln-plan   │
│              │   ╰──────────╯   ╰──────────╯   ╰─────┬──────╯
│              │                                        ▼
│              │                                  ╭────────────╮
│              │                                  │ ln-oracles │
╰──────────────╯                                  ╰────────────╯

╭──────────────╮   ╭──────────╮   ╭──────────╮   ╭────────────╮
│  Execution   │   │ ln-scope │──▶│ ln-spike │──▶│  ln-build  │
╰──────────────╯   ╰──────────╯   ╰──────────╯   ╰────────────╯

╭──────────────╮   ╭───────────╮   ╭──────────────╮   ╭──────────╮
│   Quality    │   │ ln-review │──▶│ ln-refactor  │──▶│ ln-sync  │
╰──────────────╯   ╰───────────╯   ╰──────────────╯   ╰──────────╯

╭──────────────╮   ╭─────────────╮   ╭─────────────╮   ╭───────────╮
│   Process    │   │ ln-consult  │   │ ln-handoff  │   │ ln-design │
╰──────────────╯   ╰─────────────╯   ╰─────────────╯   ╰───────────╯
```

Per `AGENTS.md`, the verification boundary is split: `ln-spec` owns the inner-loop verification policy; `ln-oracles` owns middle/outer-loop verification strategy and blind-spot assessment; `ln-scope` applies the oracle strategy per slice; `ln-review` audits oracle coverage.

### Ontology in use

The dev-layer ontology in `memory/SPEC.md` today maps roughly to:

| Kind | Where it lives in `memory/SPEC.md` |
| --- | --- |
| Concept / goal | Concept & Goal section |
| Constraint / non-goal | Constraints & Non-goals |
| Requirement | Requirements (numbered list) |
| Assumption | Assumptions table (with confidence, status, depends-on, validation approach) |
| Decision | Decisions section (numbered, with rationale and dependencies) |
| Invariant | Critical Invariants table (with protected-by tests and proves-which-requirement column) |
| Criterion | Acceptance Criteria section + Verification Design |
| Term | Lexicon (Core terms + Boundary terms) |
| Verification stance | Verification Design (commands, policy, stance, diagnostic assessment, oracle strategy by loop tier, blind spots, current coverage) |

The ontology is richer than the product layer's current ontology, but it lives in markdown, which means:

- Every contributing LLM must parse a 600-line document to make a local change.
- Cross-reference maintenance (a decision's `Depends on:` field, an invariant's `Protected by:` field, a requirement's traceability list) is textual and fragile.
- Retirement, supersession, and validation status require editorial discipline rather than tool-enforceable transitions.
- Consistency is checked by rereading, not by querying.
- Generated outputs (no `AGENT_BRIEF.md`, no `VERIFY_MAP.md`, no task-local slices) do not exist; every agent gets the whole file or nothing.

### Outer loop (Linear + Graphite)

`AGENTS.md` defines the outer loop: one frontier item in `memory/PLAN.md` becomes one Linear issue in the FE/brunch project and one Graphite stacked branch. Sub-slices stay on the same issue and branch unless `ln-plan` explicitly elevates them. Branch naming: `{prefix}/{issue-id}-{keywords}`. PR title: `{issue-id | upper}: {title in sentence case}`. PR descriptions written only when tying off.

This outer loop is solid and is not what's under design pressure. The pressure is on the markdown substrate.

## Pressure points that are real today

These are **observed today**, not anticipated:

1. **`memory/SPEC.md` is doing eight jobs at once.** Per the source synthesis: human-readable product narrative, agent-readable current truth, decision register, verification map, glossary, architecture model, test coverage index, and working memory for coding agents. Each new requirement, assumption, or invariant adds load to all eight jobs simultaneously.

2. **Editorial discipline is the only consistency mechanism.** Retired decisions vanish only if someone retires them. Stale assumptions persist if no one re-reviews them. Requirements pointing at deprecated terms are caught by reading.

3. **No task-local slices exist.** A coding agent working on, say, the multi-chat substrate has to load all of SPEC.md, all of PLAN.md, three sibling design docs, plus the code — and re-derive the relevant subset every time. There is no `slice --tag multi-chat` analog to `git log -- path/`.

4. **No `AGENT_BRIEF.md` exists.** New agents pick up the whole spec or nothing. The "global non-negotiables, current architecture seams, active invariants, verification commands" subset that almost every agent needs is not separated from the wider register.

5. **Cross-reference rot.** The Critical Invariants table's `Protected by:` test names are validated only by running the tests; the requirement traceability column (`Proves`) is validated only by reading. A renamed test or retired requirement creates silent rot.

6. **Markdown formatting load.** When an LLM must update a 600-line markdown file with column alignment, table formatting, and footnote references, large parts of its context window go to formatting rather than reasoning.

The point is not that the current system is broken — it works, and `ln-sync` exists precisely to absorb periodic housekeeping. The point is that the marginal cost of every new claim is rising, and the correct fix is to externalize the deterministic parts onto a tool rather than continually re-investing LLM attention.

## Proposed dev-layer trajectory

The trajectory is the one the source synthesis captures in §10–11 of [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md), but framed here as a self-tooling experiment for *this* repo, not as a product proposal.

### Target shape

```
memory/spec/
  schema/
    record.schema.json
    relation.schema.json
  records/
    goals.yaml
    context.yaml
    constraints.yaml
    assumptions.yaml
    decisions.yaml
    requirements.yaml
    invariants.yaml
    criteria.yaml
    examples.yaml
    terms.yaml
    verification.yaml
  generated/
    SPEC.md            # human-readable, never edited directly
    AGENT_BRIEF.md     # compact, agent-facing, almost always loaded
    VERIFY_MAP.md      # invariant → test → requirement coverage
    OPEN_RISKS.md      # open assumptions, stale items, gaps
  tools/
    check.ts           # deterministic checker
    render.ts          # records → generated views
    slice.ts           # records → task-local slice for a tag/area
```

The split is between **canonical** (small typed records, one per claim) and **rendered** (disposable generated markdown views for humans and agents). The agent's view of the world becomes:

- Always: `AGENT_BRIEF.md` (compact non-negotiables + invariants + verification commands)
- Per task: `slice --tag <area>` (relevant requirements, decisions, invariants, criteria, open assumptions for that area)
- Rarely: the whole rendered `SPEC.md`

### The "for any change" contract

Once the trajectory begins, the contract on a contributing agent becomes:

1. Load `AGENT_BRIEF.md` plus a task slice.
2. Preserve the named invariants flagged in the slice.
3. Update structured records (`memory/spec/records/*.yaml`), never the generated markdown.
4. Run `npm run spec:check` (joined into the existing `npm run verify` gate per AGENTS.md's verification harness).

### Migration path (5 steps)

A staged on-ramp from the source synthesis, adapted to this repo's reality:

1. **Stable IDs and front-matter on every existing claim.** Every requirement, assumption, decision, invariant, criterion already has a stable code in `memory/SPEC.md` (Requirement 39, A82, D138, I111, etc.). Confirm coverage; introduce IDs for any items that lack them.

2. **Sidecar files alongside the markdown.** Begin with `memory/spec/records/*.yaml` populated from the existing markdown without deleting the markdown. Both views exist; the markdown remains canonical during the transition.

3. **Stop editing generated markdown.** Once the renderer can produce the markdown faithfully, the markdown becomes generated. The records become canonical. Editing the markdown directly is a `spec:check` violation.

4. **Spec checks integrated into the verify gate.** `npm run verify` adds `spec:check` after `test` and `build`. Failures from dangling references, missing oracles, retired-records-in-active-views, etc. block the gate the same way a failing test does.

5. **Task-local slices for agent context.** `slice --tag multi-chat` produces a markdown slice that the `ln-build` skill loads instead of the whole spec. `AGENT_BRIEF.md` becomes the always-loaded preamble for every skill in the chain.

### Tool vs. direct edit policy

From the source synthesis: "records editable, tool preferred, checker authoritative, generated never edited."

A staged approach to mutation interface:

1. **Stage 1**: agents may edit YAML records directly; `spec:check` validates structure.
2. **Stage 2**: common semantic mutations move behind CLI commands (`spec add --kind invariant`, `spec retire DEC-128 --superseded-by DEC-141`, `spec link CRIT-012 verifies INV-024`). Direct edits remain possible for humans.
3. **Stage 3**: CI rejects invalid registry state; agents prefer tools.

The sequence matters: don't build the CLI until the records exist; don't build CI rejection until the CLI exists; don't deprecate direct edits until both exist.

### What `spec check` enforces

Candidate checks (also from the source):

- No dangling relation targets.
- No duplicate IDs.
- Every requirement has at least one criterion or an explicit verification gap.
- Every criterion verifies at least one requirement or invariant.
- Every invariant has an oracle, or is marked manual / proof-candidate / gap.
- Every active decision has rationale and affected scope.
- Every assumption has a validation approach or retirement condition.
- No retired record appears in active generated views.
- No forbidden legacy term appears outside glossary aliases.

These are the cheapest deterministic checks that today only happen if a human reads the whole document carefully.

## Convergence layer (long horizon)

The convergence question sits above both layers: should the **dev-layer ontology** (what we maintain in `memory/SPEC.md`) and the **product-layer ontology** (what users build with Brunch) eventually share a substrate?

The structural argument for convergence is strong:

- They share kind names (requirement, assumption, decision, invariant, criterion, example, term).
- They share relation semantics (`depends_on`, `derived_from`, `constrains`, `verifies`, `refines`, `illustrates`).
- They share progressive-checkability discipline: each claim should receive the weakest sufficient witness.
- They share the "LLM proposes; deterministic systems own structure" governance pattern.

The structural argument against immediate convergence is also strong:

- They have different persistence needs. The dev layer is diffable, branchable, reviewable in PRs — files. The product layer is interactive, multi-user, resume-precise — SQLite. (Source: [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md) §11.)
- They have different mutation interfaces. The dev layer mutates through editor + CLI. The product layer mutates through interview turns, observer captures, and graph edits.
- They have different operational metadata. The dev layer cares about test coverage and CI gates; the product layer cares about workflow phase, frontier ownership, review acceptance, and chat ownership.

The unifying principle the source proposes:

```
packages/spec-ontology/
  kinds.ts              # KnowledgeKind discriminated union
  relations.ts          # RelationKind + relation-policy registry
  schemas.ts            # shared zod / typed schemas
  validators.ts         # cross-kind invariants
  projectors.ts         # render → markdown / graph / brief

SQLite adapter:
  product runtime state

File adapter:
  dev registry, fixtures, exports

Markdown projector:
  human/agent-readable docs (both layers)
```

The decision rule:

> If humans and agents should review it in Git, use files.
> If the running app needs to mutate it interactively and resume precisely, use SQLite.
> The ontology is the same; the adapters differ.

**Brunch develops Brunch** is the strongest form of this convergence: at some future point, Brunch the product can interview *itself* — the dev team sits in front of the same app users sit in front of, and the resulting intent graph *is* `memory/SPEC.md`. That is not committed. It is a north star that organizes the smaller decisions: every time we sharpen the product ontology in a way that does not work for the dev ontology (or vice versa), we are accumulating convergence debt.

## Open questions

- **Substrate format.** YAML records vs. JSONL records vs. markdown-embedded `spec-record` fenced blocks? YAML is most readable, JSONL is most append-friendly, embedded blocks let humans edit alongside narrative. The source recommends YAML; this repo's existing markdown discipline may favor embedded blocks during the transition.

- **CLI mutation precedence.** Which mutations deserve a CLI command first? Likely `add`, `link`, `retire`, then `slice` and `render`. `supersede` and `mark stale` are more complex and may stay manual longer.

- **`AGENT_BRIEF.md` contents.** What goes in the brief vs. a task-local slice? Candidates for the brief: product thesis, global non-negotiables, current architecture seams, active invariants, verification commands, and "for any change" rules. Candidates for slices: requirements/decisions/invariants/criteria scoped to one area.

- **First adopter.** Should the registry experiment start with the full `memory/SPEC.md` or with one bounded sub-area (e.g. only the multi-chat substrate's records)? Bounded is cheaper to abandon if the experiment fails.

- **Convergence commitment.** Should the convergence layer become a real planning commitment (a stub `packages/spec-ontology/` shared by both adapters), or should it remain a north star until the product ontology stabilizes further?

- **Skill rewrites.** Once the registry exists, do the `ln-*` skills move from "edit markdown" to "run `spec` commands"? `ln-spec` becomes `spec add --kind <kind>`; `ln-sync` becomes `spec retire`/`spec render`; `ln-review` becomes `spec list --status open --confidence low`. This is a significant skill-rewrite, and may itself be the right pilot for the registry.

- **What does *not* migrate.** Some `memory/SPEC.md` sections are genuinely narrative — Concept & Goal, Verification Design's prose explanations, Lexicon definitions. These may stay as markdown-with-front-matter rather than fully decomposing into records. The split between "structured claim" and "narrative passage" is itself a design question.

## References

- [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md) §10–11 — source synthesis for the registry trajectory and the persistence adapter split.
- [`AGENTS.md`](../../AGENTS.md) — current operational protocols, verification harness, naming conventions.
- `.agents/skills/ln-*/SKILL.md` — current implementations of the dev-workflow skills.
- `memory/PLAN.md` horizon item "Structured development spec registry" — the one-line pointer this document expands.
