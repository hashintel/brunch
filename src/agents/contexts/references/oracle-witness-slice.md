# Oracle witness slice

Draft injectable reference for agents designing verification, criteria, checks, evidence, and proof obligations. Use when the task is “how will we know this holds?”

## Job

Make claims checkable using existing graph vocabulary. Do not add checkability metadata to claims.

```pseudo
claim neighborhood
  -> identify property under test: requirement | invariant | decision | design seam
  -> choose weakest sufficient oracle artifact
  -> express it as criterion, check, vv_method, evidence, vv_obligation, or example
  -> attach it with witness edge and stance
  -> name blind spots in prose or proposal notes
```

## Criterion vs oracle-plane routing

| User gives... | Graph route | Why |
| --- | --- | --- |
| “we know it works when...” | `criterion` | acceptance/oracle claim in intent space |
| “test X should run” | `check` | concrete executable or manual check |
| “use property testing / golden / proof” | `vv_method` | verification method family |
| “this run/transcript/log proves it” | `evidence` | observed artifact |
| “must prove this before release” | `vv_obligation` | outstanding proof/verification obligation |
| “for example, this case should pass” | `example` + `witness:for` | concrete positive witness |
| “this counterexample should fail” | `example` + `witness:against` | concrete negative witness |
| “metric M moved” | `evidence` or `criterion` | evidence if observed, criterion if proposed |

## Weakest-sufficient oracle ladder

Use the weakest artifact that honestly witnesses the claim.

```pseudo
unwitnessed claim
  -> human review             # qualitative judgment enough
  -> example/counterexample   # concrete disambiguation enough
  -> regression/golden        # stable fixture can catch drift
  -> runtime contract         # boundary must fail loud
  -> property/model rule      # many cases matter
  -> probe/transcript         # LLM or integration behavior needs repeated evidence
  -> proof obligation         # formal proof is economically justified
```

This ladder is conduct. Do not store `checkability`, `strength`, `validTraces`, or `invalidTraces` on graph nodes.

## Witness edge patterns

```pseudo
positive acceptance:
  criterion AC4
    create_edge witness:
      oracle: AC4
      claim: REQ9
      stance: for

negative case:
  example EX2
    create_edge witness:
      oracle: EX2
      claim: INV3
      stance: against

observed evidence:
  evidence E7
    create_edge witness:
      oracle: E7
      claim: REQ9
      stance: for

method rationale:
  vv_method VV2
    create_edge rationale:
      support: VV2
      claim: AC4
      stance: for
```

Use `witness` for evidence that bears on truth. Use `rationale` for why an oracle/method is a good choice.

## Oracle-family matrix

| Oracle family | Good for | Graph expression | Blind spot to name |
| --- | --- | --- | --- |
| human/manual review | judgment, UX, semantic quality | `criterion` or `check` | reviewer variance |
| example/counterexample | ambiguity collapse | `example` + `witness` | narrow coverage |
| fixture/golden | stable render/projection output | `check` + `evidence` when run | overfitting to fixture |
| schema/static check | boundary shape and structural legality | `check` or `vv_method` | behavior may still be wrong |
| property/model-based | invariant across many generated cases | `vv_method` + `vv_obligation` | model may omit real-world cases |
| probe/transcript | LLM/tool/harness behavior | `check` + `evidence` | non-determinism, provider drift |
| runtime contract | trust boundary / data loss prevention | `check` or design `interface` realization | only observes reached paths |
| formal proof | all-state property in a formal model | `vv_obligation`, `vv_method`, `invariant` | proof-model mismatch |

## Coherent oracle content checklist

- Every oracle node says what observation would discriminate success from failure.
- Criteria point to the requirement/invariant/claim they judge.
- Checks and evidence do not masquerade as requirements.
- Counterexamples are preserved with `witness:against`.
- The oracle’s breadth is stated honestly in prose: reviewed, example-backed, regression-covered, enforced, or proved.
- Blind spots are named; a passing check is not generalized into a proof.

## Anti-patterns

- Do not present implementation work as an oracle unless it names the observation it makes possible.
- Do not create a bespoke oracle tool or schema field when review-set + graph vocabulary can express the proposal.
- Do not use “tested by” as an edge category; use `witness` with role-named endpoints.
- Do not require the strongest oracle by default. Strong oracles have carrying cost.
