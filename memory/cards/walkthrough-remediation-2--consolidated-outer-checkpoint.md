# FE-1187 consolidated outer checkpoint

Frontier: walkthrough-remediation-2
Status:   active
Mode:     single
Created:  2026-07-13

Posture: proving (inherited from walkthrough-remediation-2)

Human-gated checkpoint — do not delegate to a writing builder.

- The deterministic tranche landed on `ln/fe-1187-remediation-3`: self-describing cancellation, standalone-cancel guidance, actionable `/introspect`, and the sweep-debt JSONL tripwire.
- Repeated-offer guidance, design/oracle fan-in conduct, compact default tool rendering, exchange markdown, review-set cards, and nested-Escape help already had production contracts plus inner oracles; this checkpoint judges live adherence and visual quality rather than adding duplicate implementation.
- Workbench state and `.brunch/debug/` remain ephemeral. Record outcomes in `TESTING_FINDINGS.md`; promote reviewed portable run evidence only when it earns durable value.
- Any failure that changes implementation shape stops this checkpoint and routes back through `ln-scope`; do not pre-author residual fixes.

## Card 1 · Consolidated content, capture, and both-theme walkthrough — `next`

### Target Behavior

One reviewed walkthrough checkpoint determines which remaining FE-1187 LN rows pass, fail into a new scoped correction, or remain explicitly evidence-gated.

### Full-card cold-start reads

```text
- memory/SPEC.md — D69-L, D80-L, D96-L, D104-L, D116-L, D117-L; A40-L; I23-L, I51-L, I57-L
- memory/PLAN.md — frontier: walkthrough-remediation-2; deterministic-orientation done-definition
- testing/walkthroughs/2026-07-14/remediations-3a.md — Session B/C evidence and restart context
- TESTING_PLAN.md — concerns 4, 6, 7F, 7G, and FE-1167 overlap opportunities
- TESTING_FINDINGS.md — WR18 O4/O5/O6/O10 plus R1–R4
- docs/praxis/manual-testing.md — workbench, evidence, and disposition discipline
```

### Boundary Crossings

```text
seeded workbench + authenticated TUI + both component-gallery themes
→ deterministic orientation / ask / offer / review-set / digest surfaces
→ provider conduct + Pi session JSONL + `.brunch/debug/` mirrors
→ sweep-debt source/built CLI over the actual session JSONL
→ user qualitative judgment + findings-ledger disposition
```

### Checkpoint beats and oracles

```text
Session B continuation — workspace-alpha-grounding
├── cancellation
│   ├── cancel standalone ask
│   ├── terminal is quiet but self-describing, not comment-shaped
│   ├── status names /brunch:consult and /brunch:mode, never /brunch:continue
│   └── next answered standalone ask clears the status
├── offer / conduct
│   ├── present→ask continuation does not repeat large offer/digest pretext
│   ├── design proposal fans out distinct shapes and synthesizes with a recommendation
│   └── oracle proposal composes an ensemble and names blind spots
├── extraction breadth (B5)
│   └── accepted digest mapping covers entities, relations, and narrative obligations without user correction
├── introspection
│   ├── /introspect names useful top-level fields
│   └── when present, its mirror pointer leads to `.brunch/debug/system-prompt.md`
└── capture tripwire
    ├── advance once after an ask-answer capture turn so the interval closes
    ├── run source CLI with `--expect capture` against the actual session JSONL
    └── run an intentionally non-spec/ignored conversational interval with `--expect ignore`

Session C — visual/generative checkpoint
├── `npm run dev:components` in light and dark themes
├── one live TUI boot in the opposite terminal theme
├── inspect compact default tools, review-set cards, markdown/newlines, node-reference legibility,
│   border distinctness, nested picker help, and persistent editor focus
├── enter intent/design/oracle/frontier-plan flows through deterministic junctures
└── inspect session JSONL for menu→conduct routing evidence
```

Tripwire commands:

```bash
node --import tsx src/probes/sweep-debt-tripwire.ts \
  --session <session.jsonl> --expect capture
node --import tsx src/probes/sweep-debt-tripwire.ts \
  --session <session.jsonl> --expect ignore

# after npm run build, equivalent built entry:
node dist/probes/sweep-debt-tripwire.js \
  --session <session.jsonl> --expect capture|ignore
```

### Risks and Assumptions

```text
- RISK: one long session makes attribution ambiguous
  → MITIGATION: record session path, approximate turn/entry range, terminal theme, and beat before each observation
- RISK: model variance is mistaken for a structural regression
  → MITIGATION: distinguish missing context/tool guidance from one adherence miss; preserve raw JSONL and rerun only the disputed beat
- RISK: visual preference is reported as a defect with no expected state
  → MITIGATION: state the contrast (theme, component, prior/current rendering) and user judgment explicitly
- ASSUMPTION: the authenticated Session B workbench can be resumed or freshly reseeded
  → IMPACT IF FALSE: checkpoint setup changes, not implementation scope
  → VALIDATE: inspect workbench state before launching and use the manual-testing reset recipe when needed
```

### Posture check

```text
Retires or locates: WR18 O4/O5/O6/O10 and absorbed LN evidence beats
Stabilizes: cancellation interpretation, offer→ask non-repetition, D96-L fan-in conduct,
            A40-L detection oracle, and both-theme exchange legibility
Stop condition: any result whose correction shape is not already explicit routes to a new scope file
```

### Acceptance Criteria

```text
✓ TESTING_FINDINGS.md — every beat above has evidence plus pass/fixed/promoted/retired disposition; no ownerless deferral
✓ actual session JSONL — both tripwire expectations emit compact reports with honest exit status; record exact session path and interval result
✓ Session B user judgment — cancellation/guidance noticeability, non-repetition, synthesis conduct, and B5 breadth are explicitly judged
✓ Session C user judgment — both gallery themes and one opposite-theme live TUI are explicitly judged
✓ session JSONL inspection — each observed generative flow records deterministic menu→conduct routing evidence
✓ no failed/unknown beat is silently converted into implementation; each becomes a named new scope, KA-owned row, or explicit retirement
```

### Verification Approach

```text
- Inner: already green on the deterministic tranche; rerun `npm run verify` only if checkpoint work changes tracked files beyond the findings ledger
- Middle: source/built sweep-tripwire commands against actual session JSONL; direct debug/session artifact inspection
- Outer: seeded TUI + component gallery in both themes, with user qualitative judgment recorded in TESTING_FINDINGS.md
```

### Cross-cutting obligations

```text
- O7/O8/O9 Execute workflows remain KA-coordinated and are not silently absorbed here
- Workbench runtime state is not durable evidence
- Source JSONL is canonical; `.brunch/debug/` is an inspection cache
- Findings dispositions follow docs/praxis/manual-testing.md and preserve a named owner/re-entry trigger
```

### Expected touched paths (tentative)

```text
TESTING_FINDINGS.md                                              ~
testing/walkthroughs/2026-07-13/                                +?  (only reviewed notes/screenshots worth retaining)
memory/cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md -  (delete when exhausted)
```
