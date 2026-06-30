# Mapping Detail Payloads

Inject when an agent creates a `decision` or `term` node, or attaches a `detail.form` to a claim/`context` node. Source of truth is [`nodes.ts`](../../../../graph/schema/nodes.ts).

Two kinds require a non-form `detail` payload. Four kinds accept the inert `detail.form` method payload. **`kind` drives behavior; `detail.form` is inert** — it changes how a node renders or round-trips, never its readiness band, edge legality, or commitment strength.

## Required detail

```yaml
# decision — all three required; rejected must be non-empty
decision:
  chosen_option: string        # the selected option/position
  rejected: string[]           # >= 1 named alternative
  rationale: string            # why the chosen option won
  # scope/consequences are NOT fields — put them in body or express with edges

# term — definition required; aliases optional
term:
  definition: string           # canonical definition
  aliases: string[]?           # optional alternate names
```

A `decision` without a named rejected alternative is just a description; map it as `context` or wait to create a `decision` until an alternative can be named.

## Claim detail.form

```yaml
# legality: which kinds accept which forms
requirement: form in [plain, gherkin, formal]
criterion:   form in [plain, gherkin, formal]
invariant:   form in [plain, gherkin, formal]
context:     form in [given]
# all other kinds: no detail.form

# form payloads (discriminated by `form`)
plain:
  form: literal "plain"        # default; no structured payload

gherkin:
  form: literal "gherkin"
  given: string[]?             # preconditions
  when: string[]?              # actions
  then: string[]               # outcomes — >= 1 required

formal:
  form: literal "formal"
  language: string             # e.g. lean | dafny
  statement: string            # formal statement text for round-trip

given:
  form: literal "given"        # context only
  statement: string            # stipulated axiom/given
```

## Routing forms

```
policy: first-match

| material                                    | kind + form                  |
| ------------------------------------------- | ---------------------------- |
| plain prose claim                           | <claim kind> + form: plain   |
| Given/When/Then behavior spec               | <claim kind> + form: gherkin |
| theorem/property for a prover (LEAN/Dafny)  | invariant + form: formal     |
| stipulated axiom, load-bearing & known-true | context + form: given        |

notes:
  - load-bearing-ness of a `given` comes from its outgoing `dependency` edges, not the form.
  - one shared `form` vocabulary across kinds lets a lens collect all `formal`-form nodes to round-trip one prover file.
```

## Do not invent

Accepted nodes/edges carry no `status`, `support`, `provenanceTurnId`, `createdBy`, `checkability`, or `strength` fields. Approval directness is `basis: explicit | implicit`; epistemic attribution is the free-text `source` on a node; audit/provenance lives in `change_log` by LSN; staleness is a `reconciliation_need`.
