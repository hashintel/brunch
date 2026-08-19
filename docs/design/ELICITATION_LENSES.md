# Elicitation lenses — historical note

Status: superseded as runtime architecture; retained for design history
Reconciled: 2026-08-05

This note explored a lens-based elicitor runtime: extractive and generative lens
families, density-scaled output, establishment offers, and lens-keyed observer
or reviewer routing. That runtime shape was not retained.

The useful rationale survives at a narrower level:

- fan-out/fan-in is valuable when alternatives make user preferences legible;
- generated material should disclose its epistemic weight;
- examples can disambiguate intent without becoming stored ontology; and
- reviewable proposals need explicit settlement rather than silent mutation.

Former lens names such as `propose-scenarios-with-tradeoffs` and
`propose-design-shapes` are historical vocabulary, not registered runtime modes
or routing keys.

## Current authority

- `memory/SPEC.md` D98-L owns the persistent elicitation-style and one-shot
  process-move distinction.
- [`src/agents/skills/TOPOLOGY.md`](../../src/agents/skills/TOPOLOGY.md) names
  current elicitor capabilities such as propose, generate, and project.
- [`src/agents/runtime/elicitor/TOPOLOGY.md`](../../src/agents/runtime/elicitor/TOPOLOGY.md)
  names current runtime composition.
- [`src/session/TOPOLOGY.md`](../../src/session/TOPOLOGY.md) owns transcript and
  session-state carriers.
- [`src/exchanges/TOPOLOGY.md`](../../src/exchanges/TOPOLOGY.md) owns
  structured-exchange behavior and persisted exchange details.
- [Review Sets](REVIEW_SETS.md) records the retained batch-review mechanism,
  with its live payload and settlement pointers.

SPEC records the architectural decisions; co-located topology files and code
name the current surface.

## Historical scope

The removed body described a starter lens catalogue, a four-anchor grounding
bundle, proposed `brunch.establishment_offer` and
`brunch.elicitor_intent_hint` entries, and open assumptions tied to that shape.
Those descriptions must not be used to infer current tools, transcript entries,
agent roles, or product settings.
