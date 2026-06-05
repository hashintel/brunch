import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GraphOverview } from '../graph/snapshot.js';
import {
  summarizeFixtureCurationRun,
  writeFixtureCurationArtifacts,
  type FixtureCurationReport,
} from './fixture-curation-loop.js';

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

const mixedBasisOverview: GraphOverview = {
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
  nodeCount: 2,
  edgeCount: 1,
  lsn: 3,
};

describe('fixture curation loop report', () => {
  it('requires real commit_graph transcript evidence and implicit graph readback', () => {
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
        toolResultEntry('commit_graph', {
          status: 'success',
          lsn: 3,
          createdNodes: { rollback: { id: 2 } },
          edges: [1],
        }),
      ].join('\n'),
      overview: mixedBasisOverview,
    });

    expect(report.success).toBe(true);
    expect(report.commitGraphAttemptCount).toBe(1);
    expect(report.commitGraphAttempts[0]).toMatchObject({ status: 'success', lsn: 3 });
    expect(report.createdNodes).toEqual([
      {
        id: 2,
        code: 'R1',
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
      sessionText: toolResultEntry('commit_graph', {
        status: 'success',
        lsn: 2,
        createdNodes: {},
        edges: [],
      }),
      overview: {
        ...mixedBasisOverview,
        nodes: [mixedBasisOverview.nodes[0]!],
        edges: [],
        nodeCount: 1,
        edgeCount: 0,
      },
    });

    expect(report.success).toBe(false);
    expect(report.createdNodes).toEqual([]);
    expect(report.friction).toContain('No implicit graph nodes were present in graph readback.');
  });

  it('writes session, transcript, report, and graph snapshot artifacts', async () => {
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
      sessionText: toolResultEntry('commit_graph', {
        status: 'success',
        lsn: 3,
        createdNodes: { node: { id: 2 } },
      }),
      overview: mixedBasisOverview,
    });

    const artifacts = await writeFixtureCurationArtifacts({
      fixtureRoot,
      runId: 'fixture-curation-test',
      sessionText: toolResultEntry('commit_graph', { status: 'success' }),
      report,
      graphSnapshot: mixedBasisOverview,
    });

    expect(artifacts.runDir).toBe(join(fixtureRoot, 'runs', 'fixture-curation', 'fixture-curation-test'));
    await expect(readFile(artifacts.sessionJsonl, 'utf8')).resolves.toContain('"toolName":"commit_graph"');
    await expect(readFile(artifacts.transcriptMarkdown, 'utf8')).resolves.toContain('## Raw session JSONL');
    await expect(readFile(artifacts.reportJson, 'utf8')).resolves.toContain(
      '"seedSlug": "macro-view-grounded-intent"',
    );
    await expect(readFile(artifacts.graphSnapshotJson, 'utf8')).resolves.toContain('"basis": "implicit"');
  });
});
