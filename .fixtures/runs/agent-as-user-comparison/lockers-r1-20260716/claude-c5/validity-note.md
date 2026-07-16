# claude-c5 — validity note

**Status: COMPLETE, valid with two declared deviations (launch-recovery chain;
one volunteered fact).**

## Outcome

The lane produced a target-authored ready document in the target cwd:
`final-document.md` (13371 bytes; raw `locker-pickup-spec.md`). The target stopped
per the mission's ready rule after writing it, in ~11 of 20 budget minutes, 4 of 8
target turns, zero substantive takeovers. The actor only transported the file.

## Declared deviation 1 — launch-recovery chain (sessions c2–c4)

After `claude-c1`'s shim launch failure (addendum-02), three further sessions were
consumed by environment recovery, none reaching a logged-in mission exchange:

- `claude-c2` — direct binary launch hit first-run onboarding; killed at the OAuth
  login selector (no headless path through it).
- `claude-c3` — retry; interactive "use env API key? Yes" selection did not persist
  (config recorded the key as **rejected**); killed at the login selector.
- `claude-c4` — seeded `CLAUDE_CONFIG_DIR` bypassed onboarding, but the mission
  prompt was rejected pre-auth with "Not logged in" (twice); the target never
  processed mission content. Killed.

Fix: controller-side config seeding (`hasCompletedOnboarding`, API key moved to
`customApiKeyResponses.approved`), verified headlessly (`AUTH-OK`) before `claude-c5`
launched. The mission was first *processed* by a live target only in `claude-c5`, so
no cross-attempt coaching occurred; all recovery attempts are retained.

## Declared deviation 2 — volunteered fact (actor error)

Recovering from the form-widget mishap ("User declined to answer questions" recorded
against the target's 3-part grounding form), the actor pasted one combined answer and
included the 72-hour hold-window fact **without a matching question** — the target's
third question was feature scope, which matches no reveal condition. Strictly, the
reveal policy discloses only facts whose `reveal_when` a visible question satisfies.
Impact assessment for judgment: this gave the Claude lane one fact it did not earn
(Brunch earned the same fact via an explicit hold-window question), slightly
*flattering* the Claude lane's information position while costing it nothing.
Conversely `pilot-scale` (24 compartments, Main Street) was never revealed here —
policy-conform, since the target never asked about deployment scale — so the Claude
document lacks pilot-scale grounding the Brunch document has. Judges must not count
the missing pilot-scale content against Claude's *process*; the outcome packet's
coverage checklist should mark `pilot-scale` as not-revealed-in-lane.

## Other notes

- The actor's form-widget navigation error (decline instead of selection) is
  recorded as the lane's one mechanical intervention; no substantive content was
  supplied beyond the reveal answers themselves.
- The target's question quality was high: it announced a budget strategy referencing
  the mission's own limits, asked two reveal-matching questions, and explicitly
  enumerated what it refused to guess (notification channel, cardless members,
  barcode strength, siting, offline behavior, capacity/overflow).
- Launch mechanism deviation (plain command + explicit binary path instead of the
  spawn seam) is declared in `addendum-02-claude-c2.md`; overlay capabilities were
  otherwise identical to the Brunch lane.
- Standing equivalence caveat (manifest): one delegated session is controller+actor
  for all lanes; sequential lanes, no cross-lane content carryover.
