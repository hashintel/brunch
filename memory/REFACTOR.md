# Refactor: source-of-truth typing collapse — structured-exchange editor seam + gap fixtures

Created: 2026-06-11 · Temporary execution aid; delete when complete or superseded.
Supersedes: the 2026-06-11 review-fix remediation plan (commits 0bc9cf24..d596f266,
all done) — except its suspended migration item, carried forward at the bottom.
Origin: /expert-typescript-typing review of the exchanges editor seam, after the
remediation talkthrough exposed the envelope vocabulary collision that misled both
a bot-comment review and the original kick-classifier author.

## Problem Statement

Four type-fork families, all "duplicate the owner's state space closer to where I
happen to be working":

1. **Two divergent editor wire envelopes for one job.** The editor-prefill pattern
   exists for exactly one reason (user-confirmed): `request_choices` is the one
   exchange whose response payload cannot ride Pi built-ins, and `ctx.ui.custom`
   cannot cross RPC — so a JSON envelope is prefilled into `ctx.ui.editor` for the
   client to edit. But two envelopes grew: the product tool's local one
   (`...request_choices.editor`: response `{status, choices[], comment}`) and the
   probe-only "shared" fallback (`...editor`: response `{status, answers[], note}`,
   plus a single-select arm no product code reaches). Both are hand-parsed; no
   schema owns either; the result envelope next door uses the same words
   (`answered`/`cancelled`) with different grammar (outcome keys, not a status
   string) — the trap that has now claimed two reviewers.
2. **The outcome union `'answered' | 'cancelled' | 'unavailable'` is restated** in
   the projection input types, the editor envelopes (as a subset), and the session
   debt-classifier's terminal-keys check — four files, zero owners, while the
   request details schemas already carry these as their branch keys.
3. **The grounding-gap fixture builder is cloned across nine-plus test files**,
   each hand-building the same `ElicitationGap` literal with a coverage knob,
   while production's `conservativeUncoveredFloorGaps` builds the same shape
   privately a tenth time.
4. **Hand-written editor-response interfaces** in both envelope sites, derivable
   from the schema that should exist per (1).

```pseudo graph (current)
schemas/request.ts ──owns──▶ zRequestChoicesDetails (outcome KEYS)
request-choices tool ──hand-writes──▶ local editor envelope + EditorResponse + parser
editor-fallback (probe-only) ──hand-writes──▶ second divergent envelope + parser + single-select arm
projections/exchanges ──restates──▶ 'answered'|'cancelled'|'unavailable' inline
session debt-classifier ──restates──▶ same three literals as key checks
9+ test files ──each hand-build──▶ ElicitationGap grounding fixtures
runtime/index ──privately builds──▶ conservativeUncoveredFloorGaps (same shape, 10th copy)
```

```pseudo graph (desired)
schemas/request.ts ──owns──▶ zRequestChoicesDetails
                   ──owns──▶ zRequestChoicesEditorEnvelope (NEW: the one wire envelope)
                   ──owns──▶ REQUEST_OUTCOME_KEYS / RequestOutcome (NEW: projected, not declared)
request-choices tool ──derives──▶ prefill template (satisfies) + response (z.infer) + safeParse
RPC probe ──consumes──▶ the same canonical envelope (divergent fallback deleted or converged)
projections/exchanges ──projects──▶ RequestOutcome; re-exports keys for session-side consumers
session debt-classifier ──derives or drift-tests──▶ terminal keys against the schema branches
graph/schema gaps sub-tree ──owns──▶ groundingFloorGaps({coverage}) builder
runtime floor + all test fixtures ──import──▶ that one builder
```

## Solution

One owner per state space: the editor envelope, the outcome union, and the
grounding-gap fixture each get exactly one declaration site; every other
appearance becomes an import, inference, or projection. Most of the diff is
deletion.

## Commits

Ordered extractions-first; every commit leaves verify green. Commits 1→3 are
sequential on one seam; commit 4 is independent (parallel-safe lane for fan-out).

1. **Extract the canonical editor-envelope schema.** Add the request-choices
   editor envelope as a zod schema co-located with the request details schemas
   (the product tool's current shape is canonical — it is the live contract).
   The tool's prefill template is typed against the schema's input, its response
   type is inferred, and its hand-written interface and parser are deleted in
   favor of safeParse. Behavior-preserving; existing exchange tests unchanged.
   Add one envelope round-trip test (prefill → edited response → parse →
   projection into result details) as the seam's lock.
2. **Extract the outcome-union owner.** Export the outcome key list and its type
   from the request schemas module (projected from the details-schema branches,
   not redeclared); the projection input types and the editor envelope's
   answered/cancelled subset become projections of it; re-export through the
   exchanges projections layer so session-side consumers can reach it without
   importing extension internals. The session debt-classifier's terminal-keys
   check derives from the re-export — or, if that coupling is rejected during
   build, keeps its literals and gains a drift test pinning them to the schema
   branches. Either way the union has one owner.
3. **Converge or delete the probe-side envelope.** Rewrite the RPC
   structured-exchange probe onto the canonical envelope and delete the
   divergent fallback envelope, its parser, and its hand-written types. DECISION
   GATE in-commit: the fallback's single-select arm is probe-only reachable; per
   the request_choices-only rationale it should be deleted — but if the probe is
   meant to prove a single-select RPC editor path, keep that arm and derive its
   types instead. Confirm with the user before deleting; default is delete.
4. **Extract the grounding-gap fixture builder.** One builder with a coverage
   knob, owned alongside the gaps schema; production's conservative floor rides
   it (production owns the shape, tests import it — never the reverse); the
   nine-plus per-test-file clones are deleted. Suite stays green as the proof.

## Decisions

- The product request-choices envelope is canonical; the probe-side envelope is
  drift, not a second contract.
- Zod owns the editor envelope: the edited JSON returns from an agent-as-user
  over RPC, which is the repo's LLM-boundary rule — this is doctrinal, not an
  exception.
- The outcome union is projected from the details schemas, never redeclared;
  its session-side consumption goes through the projections re-export (preferred)
  or a drift test (fallback), keeping session free of extension-internal imports.
- Fixture/production convergence direction: production owns the grounding-floor
  shape; fixtures import it.
- The single-select editor arm's fate is the one open decision (commit 3 gate).
- Topology READMEs: add the two-envelope rationale (why the editor channel
  exists at all: ctx.ui.custom cannot cross RPC; Pi built-ins cover the other
  request shapes; multi-choice is the one payload needing it) to the exchanges
  directory README in the same commit as the schema extraction — that note is
  the trap-prevention payload of this whole refactor.

## Testing Decisions

- Behavior-preservation is the rule for commits 1, 2, 4: existing
  structured-exchange, schema, and gap tests pass unchanged; only their imports
  move.
- The new envelope round-trip test (commit 1) is the only net-new oracle: it
  proves prefill, parse, and projection share one schema, which is the property
  whose absence caused both review failures.
- If the drift-test fallback is chosen in commit 2, it asserts the classifier's
  key literals equal the schema branch keys — same pattern as the existing
  observed-shapes drift guards.
- Prior art: the schemas module's existing zod-parse-at-projection idiom
  (`zRequestChoicesDetails.parse` in projections) and the
  observed-shapes-coverage drift test.

## Out of Scope

- The PI_OFFLINE dev-default question — parked, low stakes: the TUI-branding
  concern (Pi's version-check interjection, not suppressed by quietStartup) is
  now served unconditionally by the PI_SKIP_VERSION_CHECK default from the
  remediation pass, decoupling it from PI_OFFLINE entirely. Decide only when a
  dev loop actually wants provider-reachable TUI launches.
- The ln-sync canonical-doc pass (D35-L startup-header alignment, stale
  runtime-state-commands card, live-vs-harness blind-spot row, graduating the
  two induct lenses into ln-review).
- request_answer's plain-string editor use — not an envelope, nothing to unify.

## Carried forward — SUSPENDED (from the completed remediation plan)

- **Migration 0004 coherence:** another agent is fixing the 0004 migration on
  the branch stacked on top of this one. Do not touch drizzle/ here. On
  reintegration, verify the derive-with-'context'-fallback vs read-side-throw
  concern was actually covered there before deleting this note.
