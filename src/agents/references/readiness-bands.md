# Readiness Bands

Canonical guide for the elicitor's readiness-band model (D64-L, D94-L, D99-L, I52-L). This file owns the terms and conduct below. Skill files may summarize consumer-specific procedure, but they should not redefine readiness, settlement, or band membership.

## Core Model

Readiness bands are **concentric concern envelopes**, not sequential workflow states.

```text
grounding
  contains: grounding concerns
elicitation
  contains: grounding + elicitation concerns
projection
  contains: grounding + elicitation + projection concerns
commitment
  contains: grounding + elicitation + projection + commitment concerns
```

An outer band never closes the inner bands. When the elicitor projects requirements, design, or oracles, the grounding and elicitation concerns still matter. When the elicitor moves toward planning, projected structure still has to be harmonized with the intent it claims to serve.

## Terms

- **Readiness band**: a concentric concern envelope used to orient elicitor attention.
- **Latest expected band**: the latest band by which a node kind is normally expected to have appeared or been considered. It is an absence signal, not an earliest legal capture point.
- **Capability-readiness**: a just-in-time judgment for a requested capability. It asks whether the inner concerns and relevant gaps are settled enough to proceed honestly.
- **Settlement**: graph-item status orthogonal to `basis`. `advisory` means reviewed and persistable but not yet harmonized as current spec truth; `settled` means accepted as current spec truth or commitment for its band.
- **Advisory capture**: reviewed source-derived graph material persisted with `settlement: advisory` so it survives session fragility without becoming globally settled truth.
- **Early outer-band signal**: advisory capture where later-band material appears inside a smaller concern envelope.

Do not use `stage`, `phase`, `readiness grade`, or `maturity level` as live control terms except when referring to retired/historical material.

## Capture Rule

Capture is opportunistic; settlement is band-aware.

If the user or a reviewed source supplies later-band material early, capture it honestly with the right node kind, basis, and source. Do not demote a `slice` into vague context or ignore a concrete `module` because the conversation is still thin.

Early outer-band material is **not self-settling**. It must be carried forward for one of:

- promotion to `settled`
- rewrite or split
- supersession
- reconciliation against newer graph truth
- abandonment through review/rejection

## Arbitrary Source Capture

Brownfield code, design notes, specs, tickets, and planning documents can imply outer-band nodes and edges before Brunch has completed its own elicitation/projection process. Bulk source material follows this path:

```text
source material
  -> assistant-authored digest via present_digest
  -> request_response review terminal
  -> capture sweep
  -> graph material:
       low confidence or missing support -> session scratchpad obligation
       conflict with accepted truth      -> reconciliation_need
       reviewed but not harmonized       -> advisory graph item
       harmonized and accepted           -> settled graph item
```

The accepted digest abstract and discussion make the material eligible for graph persistence. They do not automatically make it settled: accepted `present_digest` material maps advisory until harmonized against the inner-band concerns it would depend on.

## Latest Expected Bands

Bands guide questioning and projection; **they do not gate graph truth.** If the user states a later-band item early, capture it honestly with the right kind and basis.

| Band            | What it gathers        |
| --------------- | ---------------------- |
| `grounding`     | the starting frame     |
| `elicitation`   | the working middle     |
| `projection`    | materialized structure |
| `commitment`    | hardened obligations   |
| `-` (band-less) | always-available       |

This table is guidance for elicitor orientation and capability-readiness. Closed node-kind legality remains owned by the graph schema.

| Kind            | Code | Latest expected band |
| --------------- | ---- | -------------------- |
| `example`       | EX   | -                    |
| `story`         | ST   | -                    |
| `term`          | T    | -                    |
| `sketch`        | SKT  | -                    |
| `thesis`        | TH   | grounding            |
| `goal`          | G    | grounding            |
| `assumption`    | A    | elicitation          |
| `constraint`    | CON  | elicitation          |
| `context`       | CTX  | elicitation          |
| `decision`      | D    | elicitation          |
| `invariant`     | INV  | elicitation          |
| `unknown`       | UNK  | elicitation          |
| `requirement`   | REQ  | projection           |
| `interface`     | API  | projection           |
| `module`        | MOD  | projection           |
| `entity`        | ENT  | projection           |
| `check`         | CH   | projection           |
| `evidence`      | E    | projection           |
| `vv_method`     | VV   | projection           |
| `vv_obligation` | O    | projection           |
| `criterion`     | AC   | commitment           |
| `milestone`     | M    | commitment           |
| `frontier`      | F    | commitment           |
| `slice`         | S    | commitment           |

Band-less kinds are not unimportant. They are capturable wherever they surface:

- `term` fixes vocabulary.
- `example` gives positive or negative witnesses.
- `story` groups behavior or narrative.
- `sketch` preserves advisory design signal before it hardens into `module`, `interface`, or `entity`.

## Agent Use

Both foreground roles use the same readiness model. The elicitor applies it while capturing, generating, projecting, and reviewing spec graph material; the executor applies it when entering CODE mode or deciding whether the requested implementation/planning move can proceed honestly. Bands guide conduct and wording; they do not gate graph truth, tool authority, or whether work may begin.

Use bands to decide what absence means:

- At `grounding`, ask for the smallest missing frame: what, who/for whom, why, and what makes it real.
- At `elicitation`, ask for the working middle: constraints, known facts, assumptions, unknowns, invariants, and decisions.
- At `projection`, generate or harmonize requirements, design, and oracle material against settled inner-band concerns.
- At `commitment`, review what must be treated as binding and how work is sequenced or qualified.

Use capability-readiness to modulate the move:

- **Proceed** when inner concerns are settled enough.
- **Proceed-advisory** when useful source-derived or early outer-band material exists but has not yet been harmonized.
- **Negotiate** when one or two missing answers would materially improve the result; in CODE mode, accept the requested move and backfill those answers in place.
- **Ask** when the requested capability would be mostly fiction without more inner-band truth; in CODE mode, gather the needed grounding or scratchpad-obligation answers in place.
