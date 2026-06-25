import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GraphSlice } from '../../graph/index.js';
import {
  summarizeGenerateFanOutWitness,
  writeGenerateFanOutWitnessArtifacts,
  type GenerateFanOutWitnessReport,
} from '../generate-fan-out-witness.js';

const baseGraph: GraphSlice = {
  nodes: [
    {
      id: 1,
      specId: 7,
      plane: 'intent',
      kind: 'goal',
      kindOrdinal: 1,
      title: 'Keep candidate proposal separate from graph truth',
      basis: 'explicit',
      createdAtLsn: 2,
      updatedAtLsn: 2,
    },
    {
      id: 2,
      specId: 7,
      plane: 'design',
      kind: 'module',
      kindOrdinal: 1,
      title: 'One generate spine',
      basis: 'explicit',
      createdAtLsn: 3,
      updatedAtLsn: 3,
    },
  ],
  edges: [],
  lsn: 3,
};

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

function toolCallEntry(toolName: string, args: unknown): string {
  return JSON.stringify({
    type: 'message',
    message: {
      role: 'assistant',
      content: [{ type: 'toolCall', name: toolName, arguments: args }],
    },
  });
}

function readEntry(path: string): string {
  return toolCallEntry('read', { path });
}

function oracleBranchEntry(): string {
  return JSON.stringify({
    type: 'custom',
    customType: 'brunch.agent_runtime_state',
    data: {
      state: {
        agentLens: 'oracle',
      },
    },
  });
}

function presentCandidatesEntry(): string {
  return toolResultEntry('present_candidates', {
    schema: 'brunch.structured_exchange.present',
    v: 1,
    exchange_id: 'candidate-1',
    tool_meta: { curr: 'present_candidates', next: 'request_response' },
    display: { heading: 'Oracle ensembles' },
    candidates: [{ id: 'probe', core_bet: 'Transcript-backed probe evidence' }],
  });
}

describe('generate fan-out witness report', () => {
  it('passes only from transcript-observed oracle pointer, candidates, and no graph write', () => {
    const sessionText = [
      oracleBranchEntry(),
      readEntry('src/.pi/skills/methods/generate-proposal/SKILL.md'),
      readEntry('src/.pi/skills/methods/generate-proposal/references/oracle.md'),
      presentCandidatesEntry(),
    ].join('\n');

    const report = summarizeGenerateFanOutWitness({
      runId: 'fan-out-test',
      generatedAt: '2026-06-24T00:00:00.000Z',
      cwd: '/tmp/brunch-generate-fan-out-test',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Generate oracle ensembles for this plan.',
      model: 'test-model',
      status: 'ok',
      sessionText,
      baseGraph,
      finalGraph: baseGraph,
      turn: { timedOut: false, timeoutMs: 30000 },
      friction: [],
    });

    expect(report.success).toBe(true);
    expect(report.status).toBe('ok');
    expect(report.markers).toMatchObject({
      oracleBranchPinned: { passed: true },
      generateSkillRead: { passed: true },
      oracleReferenceReadAfterSkill: { passed: true },
      presentCandidatesEmitted: { passed: true },
      noBrunchKickBeforePrompt: { passed: true },
      noWriteBeforePick: { passed: true },
    });
    expect(report.graphDelta).toEqual({ lsnDelta: 0, nodeDelta: 0, edgeDelta: 0 });
    expect(report.friction).toEqual([]);
  });

  it('fails closed when candidates appear after a graph write marker', () => {
    const sessionText = [
      oracleBranchEntry(),
      readEntry('src/.pi/skills/methods/generate-proposal/SKILL.md'),
      readEntry('src/.pi/skills/methods/generate-proposal/references/oracle.md'),
      toolResultEntry('mutate_graph', { status: 'success', lsn: 4 }),
      presentCandidatesEntry(),
    ].join('\n');

    const finalGraph: GraphSlice = {
      ...baseGraph,
      nodes: [
        ...baseGraph.nodes,
        {
          id: 3,
          specId: 7,
          plane: 'oracle',
          kind: 'check',
          kindOrdinal: 1,
          title: 'Committed too early',
          basis: 'explicit',
          createdAtLsn: 4,
          updatedAtLsn: 4,
        },
      ],
      lsn: 4,
    };

    const report = summarizeGenerateFanOutWitness({
      runId: 'fan-out-test',
      generatedAt: '2026-06-24T00:00:00.000Z',
      cwd: '/tmp/brunch-generate-fan-out-test',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Generate oracle ensembles for this plan.',
      status: 'ok',
      sessionText,
      baseGraph,
      finalGraph,
      turn: { timedOut: false, timeoutMs: 30000 },
    });

    expect(report.success).toBe(false);
    expect(report.markers.noWriteBeforePick).toMatchObject({
      passed: false,
      mutateGraphToolResultCount: 1,
      graphUnchanged: false,
    });
    expect(report.friction).toContain(
      'Graph changed or a commit-facing tool result appeared before any candidate pick.',
    );
  });

  it('writes scratch artifact references portably', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-generate-fan-out-artifacts-'));
    const sessionText = [readEntry('src/.pi/skills/methods/generate-proposal/SKILL.md')].join('\n');
    const report: GenerateFanOutWitnessReport = summarizeGenerateFanOutWitness({
      runId: 'artifact-run',
      generatedAt: '2026-06-24T00:00:00.000Z',
      cwd: fixtureRoot,
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Generate oracle ensembles for this plan.',
      status: 'blocked',
      reason: 'timeout',
      sessionText,
      baseGraph,
      finalGraph: baseGraph,
      turn: { timedOut: true, timeoutMs: 1 },
    });

    const artifacts = await writeGenerateFanOutWitnessArtifacts({
      fixtureRoot,
      runId: report.runId,
      sessionText,
      report,
    });

    expect(artifacts).toEqual({
      runDir: 'scratch/generate-fan-out/artifact-run',
      sessionJsonl: 'scratch/generate-fan-out/artifact-run/session.jsonl',
      reportJson: 'scratch/generate-fan-out/artifact-run/report.json',
    });
    await expect(readFile(join(fixtureRoot, artifacts.sessionJsonl), 'utf8')).resolves.toContain(
      'generate-proposal',
    );
    const persisted = JSON.parse(await readFile(join(fixtureRoot, artifacts.reportJson), 'utf8')) as {
      artifacts: typeof artifacts;
      cwd: string;
    };
    expect(persisted.artifacts).toEqual(artifacts);
    expect(persisted.cwd).toBe('<ephemeral-workspace>');
  });
});
