import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseSubagentMarkdown,
  type BrunchSubagentsDeps,
  type SubagentResult,
} from '../../.pi/extensions/subagents/index.js';
import { createAgentRunnerPort } from '../agent-runner-port.js';

function subagentDeps(runSubagent: NonNullable<BrunchSubagentsDeps['runSubagent']>): BrunchSubagentsDeps {
  return {
    definitions: new Map([
      [
        'worker',
        parseSubagentMarkdown(`---
name: worker
description: Execute one bounded code change in a sandbox worktree
tools: read, write_worktree_file
model: default
thinking: medium
---

Worker body.
`),
      ],
    ]),
    delegatableAgents: [],
    maxConcurrency: 1,
    agentDir: '/agent',
    createSettingsManager: () => ({}) as never,
    resourceLoaderOptions: { noContextFiles: true } as never,
    runSubagent,
  };
}

describe('createAgentRunnerPort', () => {
  it('fails closed when sealed subagent deps are not configured', async () => {
    const port = createAgentRunnerPort();

    await expect(
      port.run({
        worktreeDir: '/tmp/worktree',
        requestPath: '/tmp/request.json',
        resultPath: '/tmp/result.json',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
      }),
    ).resolves.toEqual({
      status: 'failed',
      message: 'AgentRunnerPort is not implemented yet; inject sealed subagent deps to execute agent slices.',
    });
  });

  it('runs the sealed worker over the sandbox worktree and observes a real worktree change', async () => {
    const worktreeDir = await mkdtemp(join(tmpdir(), 'brunch-agent-worktree-'));
    const requestPath = join(worktreeDir, 'request.json');
    const resultPath = join(worktreeDir, 'result.json');
    await writeFile(requestPath, JSON.stringify({ task: 'write proof' }), 'utf8');
    const calls: Array<{ agent: string; cwd: string; task: string }> = [];
    const port = createAgentRunnerPort({
      subagents: subagentDeps(async ({ definition, ctx, task }): Promise<SubagentResult> => {
        calls.push({ agent: definition.name, cwd: ctx.cwd, task });
        await writeFile(join(ctx.cwd, 'worker-proof.txt'), 'changed by worker\n', 'utf8');
        return { agent: definition.name, status: 'ok', text: 'Wrote worker-proof.txt' };
      }),
    });

    const result = await port.run({
      worktreeDir,
      requestPath,
      resultPath,
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      runtime: { modelRegistry: {} },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ agent: 'worker', cwd: worktreeDir });
    expect(calls[0]!.task).toContain('write proof');
    expect(result).toEqual({ status: 'completed', summary: 'Wrote worker-proof.txt' });
    await expect(readFile(join(worktreeDir, 'worker-proof.txt'), 'utf8')).resolves.toBe(
      'changed by worker\n',
    );
  });
});
