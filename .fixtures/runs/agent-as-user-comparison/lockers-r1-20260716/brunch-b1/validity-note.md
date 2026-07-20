# brunch-b1 — validity note

**Status: EXHAUSTED (elapsed budget) — attempt retained, not erased.**

## What happened

The target behaved correctly: it read the public mission, recovered from one internal
ask-tool error without help, and posted a grounding questionnaire (users, pickup
trigger, known constraints) well inside budget. The **actor never answered it**. The
actor observed the session by paging historical scrollback (`outputOffset`) instead of
reading the current viewport tail, so each 60-second-rate-limited query was spent on
stale output. By the time the questionnaire was actually seen (~17:59Z, prompted by the
supervising user), the 20-minute elapsed budget from mission delivery (~17:39Z) was
gone with zero qualifying questions answered and no graph content settled.

## Validity findings

1. **Budget-exhausted** — elapsed_minutes exceeded with no actor answers; per the
   frozen packet the lane stops and the best target-authored artifact is retained.
2. **Actor input contamination** — two unattributed actor keystrokes (`enter`,
   `ctrl+l`, the latter rendering a literal `l` into the questionnaire input box).
   Mechanical, no content supplied, but over the 1-intervention budget.
3. **User takeover** ~17:59–18:01Z — watching/checking only; no reasoning,
   requirements, or document content supplied (mechanical under the frozen policy).
4. **No valid final document** — the graph had no settled nodes, so no
   `document-export` acquisition was possible. `raw-target-cwd-locker-pickup-spec.md`
   (38-byte title stub found in the target cwd) is retained as a raw artifact, not as
   a final document.

## Root cause and correction

Root cause is entirely actor-side observation discipline, not target capability and
not mission design. Correction adopted for the next attempt: tail-only viewport reads
(no `outputOffset` paging), reveal-key answers prepared before launch, no keystrokes
sent except deliberate policy actions.

## Rerun declaration

`addendum-01-brunch-b2.md` (campaign root) declares attempt `brunch-b2` in a fresh
target cwd under the same frozen mission, budgets, and reveal policy. This is failure
recovery from a documented actor error with the failed attempt fully retained — not a
selective rerun for outcome-shopping.

## Standing equivalence caveat (from manifest)

One delegated session acts as controller and actor for all lanes; lanes run
sequentially and no target wording/content crosses lanes. Recorded per manifest.
