---
name: ln-induct
description: "Treat PR review-bot comments (or similar point observations) as samples from a latent defect distribution: induce the operative fault-type, then audit the codebase for unsampled instances. Use when small review findings may be symptomatic of a systemic-ish fault or fallacy, and you want a generative diagnostic lens rather than a one-off fix."
argument-hint: "[pasted comments/observations, or empty to fetch the current branch's PR review comments]"
---

# Ln Induct

A bot comment is a *sample*, not a fix. Each point finding is one draw from a latent defect distribution the author can't see. The move: infer the distribution from the samples, then go fishing for the instances nobody sampled.

This skill **generates** lenses. `ln-review`'s `contract` category is the **library** of lenses that have already stabilized. `ln-induct` induces a fresh lens from this batch of evidence; when a lens recurs across PRs, step 6 proposes graduating it into `ln-review`.

Read `memory/SPEC.md` first when it exists (lexicon, live architecture register, §Acknowledged Blind Spots). Read `memory/PLAN.md` for active frontier context when the touched area is in-flight.

## Anti-sprawl is the point of the skill

A generative audit *wants* to manufacture work — it goes looking for more. Left ungated it becomes completionist sprawl and topical caricature (`AGENTS.md`, user-global §Local necessity over category default). The triage gate (step 3) is what keeps this a diagnostic instrument and not a make-work generator. **Find and fix are separate**: this skill produces a triaged report and names adjacent work; it does not auto-implement. Routing to `ln-build`/`ln-refactor` is a separate, human-gated step.

## Input

Evidence to work from: $ARGUMENTS

## 1. Ingest the evidence

Two sources:

- **Supplied directly** — if `$ARGUMENTS` carries comments or observations, use those verbatim. Any source counts: PR bot, human reviewer, a thing you noticed.
- **Fetched from the remote** — if `$ARGUMENTS` is empty, **confirm with the user** that you'll look up review comments for the current branch's PR, then fetch them. Use whatever remote-review access is available — GitHub is the usual case (`gh` / `cli-gh-axi`), but do not lock to one provider; GitLab, Graphite (`gt`), or another host are equally valid. Pick the access path that fits the repo.

Normalize each item to `(location, claim, suggested fix)`. Drop nothing yet.

## 2. Abstract each item to a fault type (the lens)

For each item, climb the abstraction ladder from the concrete comment toward the fault *type* behind it. The stopping rule is the whole craft here:

> **Stop at the lowest rung that is both mechanically searchable AND names a repair.**

- Too low → you've restated the comment. No lift.
- Too high → "code should be correct." Useless.
- Just right → "a `Map` built from a list keyed by an assumed-unique field" — you can grep it, and you know the fix.

The lens must be a *fishing instrument*, not a category label. Record the climb (`comment → rung → rung → lens`) so the abstraction is auditable and the user can challenge it.

Seed your climb with the stabilized lenses in `ln-review` §Contract integrity as **priors**, not a checklist — they bias what to look for, but the operative lens is induced from *this* evidence and may be new. A batch may yield several distinct lenses, or none worth promoting.

## 3. Triage: is it symptomatic? (the gate)

For each induced lens, decide **fix-in-place** vs **generalize-and-audit**. Promote to audit only when **all three** hold:

1. **Plausible recurrence** — a pattern a developer or agent reaches for repeatedly, not a freak.
2. **Cheap search exists** — there is a real family-grep or ownership seam you can actually sweep.
3. **High-value failure mode** — the fault is *silent / latent* (data silently dropped, a contract silently unhonored, a wrong default silently chosen). Loud faults self-report and don't need this skill.

Fail any one → fix in place (or route the single finding), record nothing further, move on. Most items will not promote, and that is the correct outcome.

## 4. Audit for unsampled instances

For each promoted lens, fish along **both** axes — not just the easy one:

- **Family axis** (syntactic / structural): find every site sharing the pattern's shape. Grep-shaped, fast.
- **Ownership axis** (responsibility / seam): audit everything a seam *owns*, to catch same-responsibility faults that share no syntax. This is the higher-value, harder sweep. **Force at least one ownership-seam question per promoted lens** — otherwise the skill quietly degenerates into "grep for the pattern."

Collect each hit as a candidate finding. Verify it is a real instance, not a false positive that merely matches the shape.

## 5. Report

Emit triaged findings. For each: the **assumed contract** in one sentence, the **failure mode** when it breaks, the **repair class**, and a **confidence**. Repair classes (from `ln-review` §Contract integrity, extend if the induced lens needs a new one):

- **enforce it loudly** — fail on violation (throw on collision, assert the invariant)
- **thread the real value** — carry provenance instead of hardcoding it
- **name the contract** — a predicate / type / comment that makes the assumption explicit
- **normalize at the boundary** — for ambient-environment leaks (paths, `cwd`, ordering)

Name adjacent work; do not implement it.

## 6. Propose graduation

Last step, proposal only. If an induced lens recurred here, or matches one this skill has surfaced before, **propose** adding it to `ln-review` §Contract integrity (or as a new review category) — the same promote-stabilized-truth move `ln-sync` uses. State the lens, its cue, and its repair. Leave the edit to the user; do not modify `ln-review` unprompted.

## Canonical reconciliation

Reconcile only durable truth:

- A recurring lens worth a permanent review pass → propose the `ln-review` edit (step 6).
- A confirmed systemic blind spot → propose an entry in `memory/SPEC.md` §Acknowledged Blind Spots.
- Findings tied to active frontier work → note against `memory/PLAN.md` status.
- One-off findings with no durable implication → no canonical update.

Do not create alternate ledgers or audit docs. Canonical docs are `memory/SPEC.md` and `memory/PLAN.md`; the lens library lives in `ln-review`.

## Output

```md
## Induction: [evidence source]

**Samples:** [n comments/observations ingested]

### Lenses induced
1. [lens] — climb: `comment → … → lens` · gate: [promoted | fix-in-place: which test failed]

### Findings (promoted lenses only)
| # | Lens | Location | Assumed contract | Failure mode | Repair | Confidence |
| - | ---- | -------- | ---------------- | ------------ | ------ | ---------- |

### Graduation proposals
- [lens] → `ln-review` §Contract integrity (recurred: [evidence]) | none
```

## Routing

After the report, present the relevant options to the user (use `tool-ask-question`):

| #   | Label                | Target        | Why |
| --- | -------------------- | ------------- | --- |
| 1   | Scope the fixes      | `ln-scope`    | Findings need buildable cards or durable seam updates |
| 2   | Build a fix          | `ln-build`    | A finding is settled and ready for red-green-refactor |
| 3   | Plan a cluster       | `ln-refactor` | Findings cluster across a seam into a structural change |
| 4   | Graduate the lens    | manual edit   | A recurring lens should join `ln-review`'s catalog |
| 5   | Reconcile blind spot | `ln-sync`     | A confirmed systemic gap belongs in SPEC §Blind Spots |

Recommended depends on the findings: clusters → **3**, isolated silent faults → **1**, nothing promoted → stop and say so.
