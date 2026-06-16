import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GraphSlice } from '../../graph/queries.js';
import {
  summarizeFixtureCurationRun,
  writeFixtureCurationArtifacts,
  type FixtureCurationReport,
} from '../fixture-curation-loop.js';

function toolResultEntry(toolName: string, details: unknown): string {
  return JSON.stringify({
    type: 'message',
    message: {
      role: 'toolResult',
      toolName,
      content: [{ type: 'text', text: JSON.stringify(details) }],
      details,
    },
  });
}

const mixedBasisOverview: GraphSlice = {
  nodes: [
    {
      id: 1,
      specId: 7,
      plane: 'intent',
      kind: 'goal',
      kindOrdinal: 1,
      title: 'Base launch goal',
      basis: 'explicit',
      createdAtLsn: 2,
      updatedAtLsn: 2,
    },
    {
      id: 2,
      specId: 7,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Rollback path is named',
      basis: 'implicit',
      createdAtLsn: 3,
      updatedAtLsn: 3,
    },
  ],
  edges: [
    {
      id: 1,
      specId: 7,
      sourceId: 2,
      targetId: 1,
      category: 'support',
      stance: 'for',
      basis: 'implicit',
      createdAtLsn: 3,
      updatedAtLsn: 3,
    },
  ],

  lsn: 3,
};

describe('fixture curation loop report', () => {
  it('requires real mutate_graph transcript evidence and implicit graph readback', () => {
    const report = summarizeFixtureCurationRun({
      runId: 'fixture-curation-test',
      generatedAt: '2026-06-05T00:00:00.000Z',
      cwd: '/tmp/brunch-fixture-curation-test',
      seedSlug: 'macro-view-grounded-intent',
      selectedBaseProfile: 'grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Please curate the graph.',
      runtimeState: {
        operationalMode: 'elicit',
        agentStrategy: 'propose-graph',
        agentLens: 'intent',
        agentGoal: 'commit-converge',
      },
      model: 'test-model',
      sessionText: [
        toolResultEntry('read_graph', { status: 'success' }),
        toolResultEntry('mutate_graph', {
          status: 'success',
          lsn: 3,
          createdNodes: { rollback: { id: 2 } },
          edges: [1],
        }),
      ].join('\n'),
      overview: mixedBasisOverview,
    });

    expect(report.success).toBe(true);
    expect(report.mutateGraphAttemptCount).toBe(1);
    expect(report.mutateGraphAttempts[0]).toMatchObject({ status: 'success', lsn: 3 });
    expect(report.createdNodes).toEqual([
      {
        id: 2,
        code: 'REQ1',
        plane: 'intent',
        kind: 'requirement',
        title: 'Rollback path is named',
        basis: 'implicit',
      },
    ]);
    expect(report.finalGraph).toMatchObject({
      nodeCount: 2,
      edgeCount: 1,
      explicitNodeCount: 1,
      implicitNodeCount: 1,
      explicitEdgeCount: 0,
      implicitEdgeCount: 1,
    });
    expect(report.friction).toEqual([]);
  });

  it('fails closed when a graph has only explicit base truth', () => {
    const report = summarizeFixtureCurationRun({
      runId: 'fixture-curation-test',
      generatedAt: '2026-06-05T00:00:00.000Z',
      cwd: '/tmp/brunch-fixture-curation-test',
      seedSlug: 'macro-view-grounded-intent',
      selectedBaseProfile: 'grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Please curate the graph.',
      runtimeState: {
        operationalMode: 'elicit',
        agentStrategy: 'propose-graph',
        agentLens: 'intent',
        agentGoal: 'commit-converge',
      },
      sessionText: toolResultEntry('mutate_graph', {
        status: 'success',
        lsn: 2,
        createdNodes: {},
        edges: [],
      }),
      overview: {
        ...mixedBasisOverview,
        nodes: [mixedBasisOverview.nodes[0]!],
        edges: [],
      },
    });

    expect(report.success).toBe(false);
    expect(report.createdNodes).toEqual([]);
    expect(report.friction).toContain('No implicit graph nodes were present in graph readback.');
  });

  it('writes session, transcript, report, and graph overview artifacts', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-fixture-curation-artifacts-'));
    const report: FixtureCurationReport = summarizeFixtureCurationRun({
      runId: 'fixture-curation-test',
      generatedAt: '2026-06-05T00:00:00.000Z',
      cwd: fixtureRoot,
      seedSlug: 'macro-view-grounded-intent',
      selectedBaseProfile: 'grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Please curate the graph.',
      runtimeState: {
        operationalMode: 'elicit',
        agentStrategy: 'propose-graph',
        agentLens: 'intent',
        agentGoal: 'commit-converge',
      },
      sessionText: toolResultEntry('mutate_graph', {
        status: 'success',
        lsn: 3,
        createdNodes: { node: { id: 2 } },
      }),
      overview: mixedBasisOverview,
    });

    const artifacts = await writeFixtureCurationArtifacts({
      fixtureRoot,
      runId: 'fixture-curation-test',
      sessionText: toolResultEntry('mutate_graph', { status: 'success' }),
      report,
      graphOverview: mixedBasisOverview,
    });

    expect(artifacts.runDir).toBe('runs/fixture-curation/fixture-curation-test');
    await expect(readFile(join(fixtureRoot, artifacts.sessionJsonl), 'utf8')).resolves.toContain(
      '"toolName":"mutate_graph"',
    );
    await expect(readFile(join(fixtureRoot, artifacts.transcriptMarkdown), 'utf8')).resolves.toContain(
      '## Raw session JSONL',
    );
    await expect(readFile(join(fixtureRoot, artifacts.reportJson), 'utf8')).resolves.toContain(
      '"seedSlug": "macro-view-grounded-intent"',
    );
    await expect(readFile(join(fixtureRoot, artifacts.graphOverviewJson), 'utf8')).resolves.toContain(
      '"basis": "implicit"',
    );

    await expect(
      writeFixtureCurationArtifacts({
        fixtureRoot,
        runId: '../escape',
        sessionText: '',
        report: { ...report, runId: '../escape' },
        graphOverview: mixedBasisOverview,
      }),
    ).rejects.toThrow('Artifact runId must be a portable single path segment');
  });

  it('persists portable, fixture-relative artifact references in report JSON', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-fixture-curation-portable-'));
    const report: FixtureCurationReport = summarizeFixtureCurationRun({
      runId: 'portable-run',
      generatedAt: '2026-06-05T00:00:00.000Z',
      cwd: fixtureRoot,
      seedSlug: 'macro-view-grounded-intent',
      selectedBaseProfile: 'grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Please curate the graph.',
      runtimeState: {
        operationalMode: 'elicit',
        agentStrategy: 'propose-graph',
        agentLens: 'intent',
        agentGoal: 'commit-converge',
      },
      sessionText: toolResultEntry('mutate_graph', {
        status: 'success',
        lsn: 3,
        createdNodes: { node: { id: 2 } },
      }),
      overview: mixedBasisOverview,
    });

    const artifacts = await writeFixtureCurationArtifacts({
      fixtureRoot,
      runId: 'portable-run',
      sessionText: toolResultEntry('mutate_graph', { status: 'success' }),
      report,
      graphOverview: mixedBasisOverview,
    });

    const expectedRefs = {
      runDir: 'runs/fixture-curation/portable-run',
      sessionJsonl: 'runs/fixture-curation/portable-run/session.jsonl',
      transcriptMarkdown: 'runs/fixture-curation/portable-run/transcript.md',
      reportJson: 'runs/fixture-curation/portable-run/report.json',
      graphOverviewJson: 'runs/fixture-curation/portable-run/graph-overview.json',
    };
    expect(artifacts).toEqual(expectedRefs);

    const persisted = JSON.parse(await readFile(join(fixtureRoot, expectedRefs.reportJson), 'utf8')) as {
      artifacts: typeof expectedRefs;
    };
    expect(persisted.artifacts).toEqual(expectedRefs);
    expect(JSON.stringify(persisted.artifacts)).not.toContain(fixtureRoot);
  });
});
