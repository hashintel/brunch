# Mapping Oracles

For agents designing verification criteria, methods, and concrete checks, or mapping deliberately promoted observations. Use when the task is “how will we know this holds?”

## Job

Make claims checkable using existing graph vocabulary. Do not add checkability metadata to claims.

```pseudo
claim neighborhood
  -> identify property under test: requirement | invariant | decision | design seam
  -> choose weakest sufficient method and concrete check
  -> express the criterion and method as realizations of that check
  -> after execution/research/spike, deliberately promote an observation as evidence
  -> attach only that evidence to the claim with witness and stance
  -> name blind spots in prose or proposal notes
```

## Criterion vs oracle-plane routing

| User gives...                           | Graph route                   | Why                                         |
| --------------------------------------- | ----------------------------- | ------------------------------------------- |
| “we know it works when...”              | `criterion`                   | acceptance/oracle claim in intent space     |
| “test X should run”                     | `check`                       | concrete executable or manual check         |
| “use property testing / golden / proof” | `vv_method`                   | verification method family                  |
| “this run/transcript/log proves it”     | `evidence`                    | observed artifact                           |
| “must prove this before release”        | `criterion` + concrete `check`| planned assurance action                     |
| “for example, this case should pass”    | `example`                     | planned positive case; not an observed result|
| “this counterexample should fail”       | `example`                     | planned negative case; not an observed result|
| “metric M moved”                        | `evidence` or `criterion`     | evidence if observed, criterion if proposed |

`evidence` is capture-only: it must be an observation already produced by execution, research, or a spike and deliberately promoted. The schema-readable legacy/reserved obligation kind is not live authoring vocabulary.

## Weakest-sufficient oracle ladder

Use the weakest method and check that can produce a discriminating observation. Planning one does not yet witness the claim.

```pseudo
unchecked claim
  -> human review             # qualitative judgment enough
  -> example/counterexample   # concrete disambiguation enough
  -> regression/golden        # stable fixture can catch drift
  -> runtime contract         # boundary must fail loud
  -> property/model rule      # many cases matter
  -> probe/transcript         # LLM or integration behavior needs repeated evidence
  -> formal method            # all-state proof is economically justified
```

This ladder is conduct. Do not store `checkability`, `strength`, `validTraces`, or `invalidTraces` on graph nodes.

## Witness edge patterns

```pseudo
planned acceptance:
  criterion AC4
    create_edge realization:
      abstract: AC4
      concrete: CH3

planned method:
  vv_method VV2
    create_edge realization:
      abstract: VV2
      concrete: CH3

planned negative case:
  example EX2
    incorporated by check CH3

observed evidence:
  evidence E7
    create_edge witness:
      oracle: E7
      claim: REQ9
      stance: for

```

Planned `criterion` and `vv_method` reach a concrete `check` through `realization`. Observed material becomes `evidence`; only that evidence uses `witness` to support or falsify a claim. Use `rationale` for why a method or check is a good choice.

## Oracle-family matrix

| Oracle family          | Good for                               | Graph expression                          | Blind spot to name              |
| ---------------------- | -------------------------------------- | ----------------------------------------- | ------------------------------- |
| human/manual review    | judgment, UX, semantic quality         | `criterion` or `check`                    | reviewer variance               |
| example/counterexample | ambiguity collapse                     | `example` incorporated into a `check`      | narrow coverage                 |
| fixture/golden         | stable render/projection output        | `vv_method` → `check`; capture evidence after run | overfitting to fixture          |
| schema/static check    | boundary shape and structural legality | `check` or `vv_method`                    | behavior may still be wrong     |
| property/model-based   | invariant across many generated cases  | `vv_method` → `check`                     | model may omit real-world cases |
| probe/transcript       | LLM/tool/harness behavior              | `vv_method` → `check`; capture evidence after run | non-determinism, provider drift |
| runtime contract       | trust boundary / data loss prevention  | `check` or design `interface` realization | only observes reached paths     |
| formal proof           | all-state property in a formal model   | `vv_method` → concrete `check`             | proof-model mismatch            |

## Coherent oracle content checklist

- Every oracle node says what observation would discriminate success from failure.
- Criteria name the requirement/invariant/claim they judge and realize a concrete check.
- Methods realize a concrete check; checks and evidence do not masquerade as requirements.
- Planned counterexamples remain examples; observed falsifiers are promoted evidence with `witness:against`.
- The oracle’s breadth is stated honestly in prose: reviewed, example-backed, regression-covered, enforced, or proved.
- Blind spots are named; a passing check is not generalized into a proof.

## Anti-patterns

- Do not present implementation work as an oracle unless it names the observation it makes possible.
- Do not create a bespoke oracle tool or schema field when review-set + graph vocabulary can express the proposal.
- Do not use “tested by” as an edge category; use `realization` from criterion/method to check, then `witness` only from promoted evidence to the claim.
- Do not require the strongest oracle by default. Strong oracles have carrying cost.
