# Diagnostic Framework

Assess before designing. A system without feedback is open-loop -- it cannot correct errors (Wiener). Build the instrument before the experiment (Brooks: toolsmith). Harness code compounds across sessions like a walking skeleton (Cockburn).

## Three dimensions

Score each as `high | partial | low`. Low scores constrain which oracle families are feasible.

**Observability** -- can the agent see results in its native medium (text)?

| Signal type | Score | Action |
|---|---|---|
| Text output (logs, CLI, test results) | high | Proceed natively |
| Static visual (screenshot, image) | partial | Use browser tooling |
| Dynamic visual (animation, real-time) | low | Build text proxy: state snapshots, trajectory paths, frame rendering |
| Interactive (TUI, wizard, form) | low | Use terminal driver |
| Physical / external system | low | Build simulator or mock |

**Reproducibility** -- can specific states be reproduced on demand? If not, parameterize first: seeds, fixtures, CLI args, URL params. Make experiments cheap, shareable, composable.

**Controllability** -- can the agent iterate without the human? The actor with the tighter loop wins (Boyd, OODA). Build a text-native inner loop the agent drives autonomously; reserve human review for the outer loop.

## Three-tier loop architecture

| Tier | Cadence | Driver | Purpose |
|---|---|---|---|
| Inner | ms -- seconds | Agent autonomous | Hard gates, routine checks, cheapest proofs first |
| Middle | seconds -- minutes | Fitness metrics | Regression gates, trend detection, double-loop learning |
| Outer | minutes -- hours | Human observer | Visual review, strategy redirect, course correction |

The inner loop must have requisite variety (Ashby): structured output that distinguishes failure modes, not just pass/fail.

The middle loop is double-loop learning (Argyris & Schon): the inner loop corrects errors; the middle loop asks whether you're measuring the right thing.

Apply verification economics (Reinertsen): run cheapest checks first, expensive checks less often, based on time-cost and risk. Test pyramid ordering: unit > integration > E2E by cost.

## Dispositions

- Build instrument before experiment. Harness IS the first task.
- Translate, don't degrade. Agent-facing interfaces preserve fidelity of the native medium.
- Modify your own instruments. When you need different data, change what gets measured.
- Tests check contracts. Feedback loops check reality. Don't confuse them.
