# Host-landing tracer: port + multi-commit contrastive oracle

Frontier: host-landing
Status:   active
Mode:     single
Created:  2026-07-14

## Target Behavior

The complete multi-commit result of a promoted run — every slice-integration commit plus the optional final promotion commit, with no `.brunch/**` content — is landable through `GitHostLandPort` into a brownfield host branch (ff/merge) and into a greenfield target (materialized fresh repository).

## Cold-start reads

```
- memory/SPEC.md   — D111-L, I58-L, D112-L (ports/acceptance; bounded side effects; landing outside the driven chain)
- memory/PLAN.md   — frontier: host-landing (full design synthesis lives in the definition + FE-1201)
- HANDOFF.md       — the four review findings + diagnostic evidence (volatile; retire at ln-sync)
- src/executor/TOPOLOGY.md — §promotion.ts / §host-promotion.ts paragraphs (current boundary contract)
- `git show main:src/orchestrator/src/promote-run.ts` — prior art: landCookBranch / promoteGreenfieldRun semantics being ported
```

## Boundary Crossings

```
→ src/executor/worktree.ts + run.ts        (durable runBaseSha at worktree_created, both substrates)
→ src/executor/promotion.ts               (promote against runBaseSha; retire promotionBaseSha)
→ src/app git adapters                    (commit-time .brunch exclusion; new git-host-land-port.ts)
→ real git repos                          (host repo / foreign empty_dir run repo / greenfield target dir)
```

## Risks and Assumptions

```
- ASSUMPTION: refs/objects created in a linked run worktree are visible and mergeable from the
  host repo cwd, so brownfield integrate needs no fetch/transport step.
    → IMPACT IF FALSE: integrate grows a publish/fetch step (design 4's ensureReviewRef); port
      shape changes; slice-2 command layer unaffected.
    → VALIDATE: this card's brownfield oracle leaves — they fail outright if the claim is false.
    → memory/SPEC.md §Assumptions: to be recorded at next ln-sync (frontier Retires list, claim 1)
- ASSUMPTION: after commit-time hygiene, runBaseSha..review-tip is the COMPLETE promoted output —
  including host source copied into the run worktree but uncommitted until the final promotion
  commit's add -A rescues it.
    → IMPACT IF FALSE: landing silently drops content in some flow; design rework at the
      promotion/source-copy boundary, not just this slice.
    → VALIDATE: oracle asserts uncommitted-at-promote source (c.ts) lands alongside slice
      commits (a.ts, b.ts) while .brunch/** does not.
    → memory/SPEC.md §Assumptions: to be recorded at next ln-sync (claim 2)
- RISK: `git add -A -- . ':(exclude).brunch'` pathspec interacts badly with add -A semantics
  (deletions, nested paths) → MITIGATION: dedicated hygiene leaves in both adapter suites; if the
  pathspec proves unreliable, fall back to a post-add `git rm --cached -r .brunch` step.
- RISK: enriching GitWorktreeCreateResult with the created-from SHA ripples through fakes and
  callers → MITIGATION: additive field; update fake-ports.ts + worktree.test.ts in the same red.
- RISK: real-git fixture slows the suite (roving-suite-flake history) → MITIGATION: keep the
  fixture lean per that closure — no clone/pull/config churn; reuse command-runner; 4-worker cap
  already in npm test.
```

## Posture check

Proving — scores on all three axes: **proof of life** (first true run→host landing path in both modes), **invariants** (locates the `GitHostLandPort` seam slice 2 and future targets aim from), **uncertainty** (the oracle retires claims 1 and 2 by landing). The third design claim (Pi confirm authority) is deliberately NOT carried here — slice 2 owns it; nothing in this card depends on it.

## Acceptance Criteria

Fixture (the contrastive core, both modes): initial base commit → detached run worktree at `runBaseSha` → two slice-integration commits (`src/a.ts`, then `src/b.ts`) → uncommitted `src/c.ts` + planted `.brunch/plan.json` at promote time → `preparePromotion` creates the final promotion commit (contains `c.ts`, excludes `.brunch/`) and pins `brunch/review/<runId>`. Today's `commitSha^..commitSha` patch semantics would deliver only `c.ts` — the completeness leaves redden the old behavior by construction.

```
✓ git-host-land-port.test.ts :: brownfield fast-forward — host HEAD at runBaseSha: integrate
  ff's the checked-out branch; tree contains src/a.ts, src/b.ts, src/c.ts; git log contains both
  integration commits + the promotion commit; `git ls-tree -r HEAD` has no .brunch/**
✓ git-host-land-port.test.ts :: brownfield merge — host advanced by an unrelated commit:
  integrate produces a brunch-authored merge commit (parents = host HEAD + review tip); all
  files from both lines present
✓ git-host-land-port.test.ts :: brownfield conflict — host commit conflicting on src/a.ts:
  result 'conflict' naming the path; `git status --porcelain` empty; HEAD unmoved;
  brunch/review/<runId> still resolves
✓ git-host-land-port.test.ts :: brownfield refusals — tracked-dirty host → 'refused' with host
  bit-identical; detached HEAD → 'refused'; untracked non-colliding file → lands, file survives
✓ git-host-land-port.test.ts :: greenfield materialize — foreign empty_dir run repo (empty base
  + same commit fixture): empty target dir becomes a repo root on main with exactly one
  brunch-authored initial commit; full source tree; no .brunch/**; no foreign .git leakage
✓ git-host-land-port.test.ts :: greenfield refusals — occupied non-git target → 'refused'
  without mutation; target aliasing/inside the run repo → 'refused'
✓ worktree.test.ts :: runBaseSha recorded — git_worktree substrate records the created-from
  HEAD SHA; empty_dir records the empty base commit SHA; creation failure leaves metadata
  unadvanced with no runBaseSha
✓ promotion.test.ts :: clean integrated run promotes — a fully-integrated worktree with no
  dirty files reaches 'promotion_prepared' with the review ref at the integrated tip (old code
  returned promotion_no_changes); 'no_changes' only when tip == runBaseSha
✓ git-slice-integration-port.test.ts + git-land-port.test.ts :: hygiene — a .brunch/ file
  present in the workspace never enters the slice or promotion commit; a sibling non-.brunch
  untracked file still does
```

## Invariants preserved

- I58-L side-effect honesty: promotion/worktree helpers still advance metadata with at most one declared effect; port failure leaves metadata unadvanced — guarded by: `src/executor/__tests__/promotion.test.ts`, `worktree.test.ts` (existing leaves stay green).
- D112-L: `promotion_prepared` remains the driven chain's terminal; nothing in this slice enters `drive()` — guarded by: `src/executor/__tests__/` lifecycle suites via full `npm test` (negative space).
- Promotion recovery: `recoverPreparedPromotion` still admits a durable prior report — guarded by: `promotion.test.ts` existing recovery leaves.
- Old host-promotion path stays functional until slice 2 deletes it (no half-cutover) — guarded by: `src/executor/__tests__/host-promotion.test.ts` + `src/app/__tests__/git-host-promotion-port.test.ts` unchanged and green.
- Copied-source rescue: uncommitted worktree content other than `.brunch/**` still enters the final promotion commit — guarded by: the hygiene + completeness leaves above (stop-the-line: a red here is a respec signal for claim 2, not a fixture to update).

## Verification Approach

- Inner: real-git contrastive fixture (`git-host-land-port.test.ts`) + fake-port unit tests for `runBaseSha`/promotion — proves claims 1 and 2 and the mode semantics.
- Middle: full `npm test` (4-worker cap) — executor lifecycle negative space; then `npm run verify` at commit.
- Outer: owned by frontier `host-landing` slice 2 (`/brunch:land` + `landed` status) and FE-1197 oracle 9 (rust-todo-cli walkthrough tail past `promotion_prepared`) — named owners, not deferred ambient.

## Cross-cutting obligations

- Update `src/executor/TOPOLOGY.md` promotion/worktree lines for `runBaseSha` in this slice (co-located topology owns current state); the full host-promotion paragraph rewrite rides slice 2.
- Keep the real-git fixture lean per the `roving-suite-flake` closure (no clone/pull/config churn).
- Do NOT add substrate/mode tool-input changes, `landed` status, port deletion, or the `GitLandPort → GitRunPromotionPort` rename here — slice 2 owns the cutover; this slice is additive plus the two upstream fixes.

## Expected touched paths (tentative)

```
src/executor/
├── execution-ports.ts                        ~   (+ GitHostLandPort types; GitWorktreeCreateResult + created-from SHA)
├── run.ts                                    ~   (+ runBaseSha field; - promotionBaseSha)
├── worktree.ts                               ~   (record runBaseSha, both substrates)
├── promotion.ts                              ~   (baseSha = metadata.runBaseSha; delete preparePromotionAttempt)
├── TOPOLOGY.md                               ~   (promotion/worktree lines)
└── __tests__/
    ├── fake-ports.ts                         ~
    ├── worktree.test.ts                      ~
    └── promotion.test.ts                     ~
src/app/
├── git-host-land-port.ts                     +
├── git-slice-integration-port.ts             ~   (:(exclude).brunch)
├── git-land-port.ts                          ~   (:(exclude).brunch)
└── __tests__/
    ├── git-host-land-port.test.ts            +
    ├── git-slice-integration-port.test.ts    ~
    └── git-land-port.test.ts                 ~
```
