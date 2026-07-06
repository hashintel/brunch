import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runExecutorAgentRunnerWitness } from '../executor-agent-runner-witness.js';

describe('executor agent runner witness', () => {
  it('rejects unsafe artifact run ids before constructing paths', async () => {
    await expect(runExecutorAgentRunnerWitness({ runId: '../escape' })).rejects.toThrow(
      'Artifact runId must be a portable single path segment',
    );
  });

  it('runs the default runner through a sealed worker and observes a worktree write', async () => {
    const report = await runExecutorAgentRunnerWitness({ runId: 'contract-run' });

    expect(report).toMatchObject({
      schemaVersion: 1,
      probeId: 'executor-agent-runner-witness',
      runId: 'contract-run',
      worktreeChanged: true,
      workerSummary: 'Wrote worker-proof.txt',
      toolNames: ['read', 'write_worktree_file'],
    });
    expect(report.artifacts).toBeUndefined();
  });

  it('writes portable witness artifacts', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-executor-agent-runner-witness-'));
    const report = await runExecutorAgentRunnerWitness({ fixtureRoot, runId: 'artifact-run' });

    expect(report.artifacts).toEqual({
      runDir: 'runs/executor-agent-runner-witness/artifact-run',
      requestJson: 'runs/executor-agent-runner-witness/artifact-run/request.json',
      resultJson: 'runs/executor-agent-runner-witness/artifact-run/result.json',
      worktreeProofTxt: 'runs/executor-agent-runner-witness/artifact-run/worker-proof.txt',
      reportJson: 'runs/executor-agent-runner-witness/artifact-run/report.json',
    });
    const persisted = JSON.parse(
      await readFile(join(fixtureRoot, report.artifacts!.reportJson), 'utf8'),
    ) as typeof report;
    expect(JSON.stringify(persisted.artifacts)).not.toContain(fixtureRoot);
    await expect(readFile(join(fixtureRoot, report.artifacts!.worktreeProofTxt), 'utf8')).resolves.toBe(
      'changed by sealed worker\n',
    );
  });
});
