# Compare Brunch and Claude Code

Use this guide to run a focused comparison and publish the result for the team.

## Choose the comparison

- **Elicitation:** compare the specifications produced by Brunch and Claude Code.
- **Execution:** give both tools the same specification and compare what they build.
- **End to end:** compose elicitation and execution as a controlled study. There is no single
  end-to-end operator command.

## Compare elicitation

From a trusted top-level project Pi session, run:

```text
/compare-specs minimal-petri-net-editor
```

The workflow runs one product at a time and retains each conversation and unchanged specification. Alpha 10 records the Brunch version and commit automatically.

## Compare execution

From a trusted top-level project Pi session, run:

```text
/compare-execution minimal-petri-net-editor
/compare-execution brunch-host-landing
/compare-execution petrinaut-optimization
/compare-execution prospect-research-workspace
```

The workflow gives Brunch and Claude Code the same frozen specification and applies the selected case's independent checks to both outputs. Brownfield cases require a local checkout containing their pinned parent commit; the operator creates a fresh remote-free target from it. Alpha 10 records the Brunch version and commit automatically.

## End-to-end comparison

End-to-end comparison is a dev/evaluation study shape, not a single operator command.

The repository has three configured end-to-end study contracts:
`minimal-petri-net-editor`, `brunch-host-landing`, and `petrinaut-optimization`.
`prospect-research-workspace` is an execution-only regression case, not an end-to-end profile.

Configured contracts are not retained evidence. The repository currently retains one historical
end-to-end witness: the
[Petri editor report](../../.fixtures/runs/end-to-end-comparison/petri-editor-e2e-20260721T132600Z/report.md).
It produced a Brunch specification and a Claude Code specification, executed each specification
with both tools, and applied the same checks to all four outputs. For operator-driven work, use
`/compare-specs` for elicitation or `/compare-execution` for execution; compose end-to-end studies
through the dev tooling and runbook below.

## Read the result

Check validity before comparing outcomes:

- Did both tools receive the intended inputs?
- Were the retained inputs and outputs left unchanged?
- Did both outputs receive the same checks?
- Were failures and human interventions recorded?

One run can reveal useful defects. It cannot establish that either product is generally better.

## Publish to Notion

Review the completed `report.md` and retain the complete run unchanged under `.fixtures/runs/`. Then publish it:

```text
/comparison-publish <retained-run-directory>
```

Alpha 10 validates the evidence, removes controller-only details, and creates or updates the matching report in [Brunch Testing Scenarios](https://app.notion.com/p/3a53c81fe024804598e3cf55aef279eb).

Do not publish scratch runs or backfill old runs that do not contain `provenance.json`.

For evidence rules and implementation details, see the [full comparison runbook](comparison-runs.md).
