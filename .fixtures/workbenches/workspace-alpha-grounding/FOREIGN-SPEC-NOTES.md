# Workspace Orientation — inherited design notes (foreign source)

> Provenance: consolidated notes from a prior team's design review of a workspace
> orientation feature, exported from their wiki. Mixed maturity: some sections were
> accepted, some are speculation, and at least one pair of claims was never reconciled.

## 1. Problem statement

Users who return to a workspace after days away consistently report a "cold re-entry"
problem: they cannot tell which spec they were working in, what state its graph was in,
or what the next intended action was. Support tickets tagged `orientation` accounted for
19% of onboarding-phase churn in the Q3 cohort study. The prior team's accepted framing:
orientation is a *read* problem, not a notification problem — pushing digests at users
performed worse in trials than letting users pull a well-shaped summary at entry.

## 2. Accepted claims (per the review sign-off page)

- The unit of orientation is the **selected spec**, never the whole workspace. Showing
  cross-spec aggregates at entry increased time-to-first-action by ~40% in the A/B run.
- Orientation content must be derivable from persisted state alone. Any design that
  requires the previous session's in-memory context to render entry orientation was
  rejected as fragile.
- The entry surface shows at most three elements: (a) the selected spec's identity and
  one-line intent summary, (b) the delta since the user's last visit, (c) the single
  suggested next action. The review explicitly rejected a fourth "recent activity feed"
  element as noise.
- Staleness must be explicit. If the summary is computed from state older than the
  latest write, the surface must say so rather than render silently stale content.

## 3. Design sketches (not accepted — explicitly marked "exploratory")

The wiki carried two competing sketches for the delta computation:

**Sketch A — watermark diff.** Persist a per-user "last oriented at" watermark
(a log sequence number). The delta is every graph change with LSN greater than the
watermark, grouped by plane, capped at seven items with a "and N more" overflow. Cheap
to compute; the watermark is one row per user per spec. Concern raised in review: a user
who opens the workspace but doesn't actually read the summary still advances the
watermark, silently swallowing the delta (the "glanced but not oriented" failure).

**Sketch B — acknowledgement ledger.** Each delta item carries an explicit acknowledged
flag; orientation shows unacknowledged items until the user dismisses them. Never
swallows a delta, but the ledger grows unboundedly and the review noted it recreates a
notification-center shape the team had already rejected on the push-vs-pull grounds in §1.

Neither sketch was chosen. The sign-off page records "revisit after entry-surface
telemetry lands" as the disposition.

## 4. Constraints inherited from platform review

- Entry orientation must render inside 150 ms at p95 on the reference corpus
  (30k-node graph). This ruled out on-demand full-graph traversal; whatever delta
  mechanism lands must be incremental.
- The orientation surface may not issue writes. A rejected draft had the entry surface
  auto-advancing the watermark as a side effect of rendering; platform review flagged
  this as a read path performing a write and killed it.
- Locale: summary strings must come from the same message catalog as the rest of the
  product; the prototype's hand-rolled English strings were flagged as a launch blocker.

## 5. Unresolved tension (never reconciled — flagged twice, never closed)

Two claims sit in direct conflict in the notes, both from "accepted" sections of
different review rounds:

- Round 2 sign-off: "The suggested next action is computed deterministically from graph
  state; the model never chooses it. Determinism is what makes the suggestion auditable."
- Round 4 sign-off: "The suggested next action is the model's synthesis of the open
  scratchpad obligations; a deterministic rule was tried and produced tone-deaf
  suggestions users learned to ignore."

The wiki's conflict banner links both rounds but no reconciliation page exists. Whoever
inherits this needs to decide which round's claim governs — or whether the split is
actually a settled/advisory distinction (deterministic *candidate generation*, model
*selection*) that dissolves the conflict.

## 6. Open questions carried on the backlog

- Does orientation need a distinct treatment for the very first entry into a spec
  (nothing to delta against), or is the empty-delta rendering sufficient?
- Should orientation state be per-user or per-device? The notes assume per-user but the
  platform only had per-device identity at the time; this assumption was never validated.
- The 150 ms budget was set against a 30k-node corpus; nobody measured the actual
  distribution of graph sizes. The budget may be either trivially met or structurally
  unmeetable, and no one knows which.
- Telemetry: the "revisit after entry-surface telemetry lands" disposition in §3 depends
  on telemetry that was never specced. What minimal signal distinguishes "glanced" from
  "oriented"?

## 7. Appendix — vocabulary the prior team used

- **Entry surface**: the first rendered view after workspace/spec selection.
- **Delta**: the set of graph changes between the user's last orientation and now.
- **Watermark**: a persisted per-user, per-spec log position marking the last
  orientation point (Sketch A's mechanism).
- **Cold re-entry**: returning to a workspace after long enough that working memory of
  its state is gone; the notes used seven days as the operational threshold.
- **Glanced-not-oriented**: the failure mode where the system believes the user has
  seen the delta but the user has not absorbed it.
