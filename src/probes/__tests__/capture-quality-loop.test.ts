import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CAPTURE_QUALITY_SCENARIOS,
  summarizeCaptureQualityRun,
  writeCaptureQualityArtifacts,
  type CaptureQualityScenarioExtraction,
} from '../capture-quality-loop.js';

const goodExtractions: CaptureQualityScenarioExtraction[] = [
  {
    scenarioId: 'free-prose-launch-goal',
    facts: [
      {
        expectedId: 'workspace-for-solo-developers',
        kind: 'context',
        title: 'The product is for solo developers working in a local spec workspace.',
        expectedOutcome: 'commit_explicit',
        evidence: 'for solo developers / local spec workspace',
      },
      {
        expectedId: 'capture-goals-without-template',
        kind: 'goal',
        title: 'Capture project goals without forcing a rigid template.',
        expectedOutcome: 'commit_explicit',
        evidence: 'should help capture project goals without forcing people into a rigid template',
      },
      {
        expectedId: 'new-contributor-explains-problem',
        kind: 'criterion',
        title: 'A new contributor can read the graph and explain the problem solved.',
        expectedOutcome: 'commit_explicit',
        evidence: 'Success means...',
      },
    ],
  },
  {
    scenarioId: 'file-ref-bearing-answer',
    facts: [
      {
        expectedId: 'prd-is-product-frame',
        kind: 'context',
        title: 'docs/architecture/prd.md is the product frame for this answer.',
        expectedOutcome: 'commit_explicit',
        evidence: 'Use docs/architecture/prd.md as the product frame.',
      },
      {
        expectedId: 'graph-truth-sqlite-brunch',
        kind: 'constraint',
        title: 'Graph truth must stay in SQLite under .brunch.',
        expectedOutcome: 'commit_explicit',
        evidence: 'The non-negotiable is...',
      },
      {
        expectedId: 'jsonl-ok-if-replay-recovers-exchanges',
        kind: 'criterion',
        title: 'JSONL transcript evidence is acceptable only if replay recovers structured exchange results.',
        expectedOutcome: 'commit_implicit',
        evidence: 'can remain JSONL as long as...',
      },
      {
        expectedId: 'must-build-full-replay-engine-now',
        kind: 'requirement',
        title: 'Build a full replay engine immediately.',
        expectedOutcome: 'spawn_gap',
        evidence: 'Not directly stated; only a possible implication.',
      },
    ],
  },
  {
    scenarioId: 'implication-heavy-no-overcommit',
    facts: [
      {
        expectedId: 'terminal-demo-preference-conditional',
        kind: 'assumption',
        title: 'The user may prefer the terminal view if the browser observer is confusing.',
        expectedOutcome: 'spawn_gap',
        evidence: 'If the browser observer gets confusing, I might prefer...',
      },
      {
        expectedId: 'web-helpful-if-fast',
        kind: 'criterion',
        title: 'The web graph is helpful only if it keeps up quickly enough.',
        expectedOutcome: 'commit_implicit',
        evidence: 'only if it keeps up quickly enough',
      },
      {
        expectedId: 'review-sets-in-poc',
        kind: 'requirement',
        title: 'Review sets belong in the POC story.',
        expectedOutcome: 'spawn_gap',
        evidence: 'I have not decided...',
      },
    ],
  },
  {
    scenarioId: 'contradiction-readonly-observer',
    facts: [
      {
        expectedId: 'observer-readonly-conflict',
        kind: 'constraint',
        title: 'The web observer may mutate graph truth while remaining read-only.',
        expectedOutcome: 'reconciliation_need',
        evidence: 'Conflicts with the existing read-only observer constraint.',
      },
    ],
  },
];

describe('capture quality report', () => {
  it('scores gradient-routing accuracy while keeping low-confidence noticings out of graph truth', () => {
    const report = summarizeCaptureQualityRun({
      runId: 'capture-quality-test',
      generatedAt: '2026-06-08T00:00:00.000Z',
      cwd: '/tmp/capture-quality-test',
      extractorName: 'fixture-fed',
      scenarios: CAPTURE_QUALITY_SCENARIOS,
      extractions: goodExtractions,
    });

    expect(report.totals).toMatchObject({
      expectedOutcomeCount: 11,
      correctOutcomeCount: 11,
      missedOutcomeCount: 0,
      falseCommitCount: 0,
      spawnGapCount: 3,
      reconciliationNeedCount: 1,
      routingAccuracy: 1,
    });
    expect(report.verdict.recommendation).toBe('graduate');
  });

  it('fails the verdict when a gap-spawn noticing is classified as a commit', () => {
    const report = summarizeCaptureQualityRun({
      runId: 'capture-quality-test',
      generatedAt: '2026-06-08T00:00:00.000Z',
      cwd: '/tmp/capture-quality-test',
      extractorName: 'fixture-fed',
      scenarios: CAPTURE_QUALITY_SCENARIOS,
      extractions: [
        ...goodExtractions.slice(0, 2),
        {
          scenarioId: 'implication-heavy-no-overcommit',
          facts: [
            {
              expectedId: 'web-helpful-if-fast',
              kind: 'criterion',
              title: 'The web graph is helpful only if it keeps up quickly enough.',
              expectedOutcome: 'commit_implicit',
              evidence: 'only if it keeps up quickly enough',
            },
            {
              expectedId: 'review-sets-in-poc',
              kind: 'requirement',
              title: 'Review sets belong in the POC story.',
              expectedOutcome: 'commit_explicit',
              evidence: 'I have not decided whether review sets belong in the POC story.',
            },
          ],
        },
      ],
    });

    expect(report.totals.falseCommitCount).toBe(1);
    expect(report.verdict).toMatchObject({
      recommendation: 'keep_parked',
      a22ConfidenceShift:
        'negative: the measured extractor routed at least one gap or reconciliation item as graph truth',
    });
  });

  it('rejects unsafe artifact run ids before constructing paths', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-capture-quality-artifacts-'));
    const report = summarizeCaptureQualityRun({
      runId: '../escape',
      generatedAt: '2026-06-08T00:00:00.000Z',
      cwd: fixtureRoot,
      extractorName: 'fixture-fed',
      scenarios: CAPTURE_QUALITY_SCENARIOS,
      extractions: goodExtractions,
    });

    await expect(
      writeCaptureQualityArtifacts({
        fixtureRoot,
        report,
        scenarios: CAPTURE_QUALITY_SCENARIOS,
        extractions: goodExtractions,
      }),
    ).rejects.toThrow('Artifact runId must be a portable single path segment');
  });

  it('writes portable scenario, extraction, report, and verdict artifacts', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-capture-quality-artifacts-'));
    const report = summarizeCaptureQualityRun({
      runId: 'capture-quality-test',
      generatedAt: '2026-06-08T00:00:00.000Z',
      cwd: fixtureRoot,
      extractorName: 'fixture-fed',
      scenarios: CAPTURE_QUALITY_SCENARIOS,
      extractions: goodExtractions,
    });

    const artifacts = await writeCaptureQualityArtifacts({
      fixtureRoot,
      report,
      scenarios: CAPTURE_QUALITY_SCENARIOS,
      extractions: goodExtractions,
    });

    expect(artifacts).toEqual({
      runDir: 'runs/capture-quality/capture-quality-test',
      scenariosJson: 'runs/capture-quality/capture-quality-test/scenarios.json',
      extractionsJson: 'runs/capture-quality/capture-quality-test/extractions.json',
      reportJson: 'runs/capture-quality/capture-quality-test/report.json',
      verdictMarkdown: 'runs/capture-quality/capture-quality-test/verdict.md',
    });
    await expect(readFile(join(fixtureRoot, artifacts.reportJson), 'utf8')).resolves.toContain(
      '"cwd": "<ephemeral-workspace>"',
    );
    await expect(readFile(join(fixtureRoot, artifacts.verdictMarkdown), 'utf8')).resolves.toContain(
      'Recommendation: graduate',
    );
  });
});
