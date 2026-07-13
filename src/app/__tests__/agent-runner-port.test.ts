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
      message:
        'AgentRunnerPort has no subagent deps injected in this launch, so the sealed worker cannot run. Compose subagents (execute mode or --dev-tools).',
    });
  });

  it('runs the sealed worker over the sandbox worktree and observes a real worktree change', async () => {
    const worktreeDir = await mkdtemp(join(tmpdir(), 'brunch-agent-worktree-'));
    const requestPath = join(worktreeDir, 'request.json');
    const resultPath = join(worktreeDir, 'result.json');
    await writeFile(
      requestPath,
      JSON.stringify({
        scopeId: 'SCP1',
        definition: 'write proof',
        instruction: 'Satisfy the done criteria before returning.',
        criteria: [{ kind: 'criterion', target: 'worker proof exists' }],
        derivedFrom: ['REQ1'],
        designContext: [{ itemId: 'MOD1', content: 'worker proof module' }],
        verificationContext: [{ itemId: 'CH1', content: 'worker proof check' }],
      }),
      'utf8',
    );
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
    expect(calls[0]!.task).toContain('Scope id: SCP1');
    expect(calls[0]!.task).toContain('Slice goal:\nwrite proof');
    expect(calls[0]!.task).toContain('Instruction:\nSatisfy the done criteria before returning.');
    expect(calls[0]!.task).toContain('Done criteria:\n- criterion: worker proof exists');
    expect(calls[0]!.task).toContain('Derived from requirements:\n- REQ1');
    expect(calls[0]!.task).toContain('Design context:\n- [MOD1] worker proof module');
    expect(calls[0]!.task).toContain('Verification context:\n- [CH1] worker proof check');
    expect(calls[0]!.task).not.toContain('Execution request:');
    expect(result).toEqual({ status: 'completed', summary: 'Wrote worker-proof.txt' });
    await expect(readFile(join(worktreeDir, 'worker-proof.txt'), 'utf8')).resolves.toBe(
      'changed by worker\n',
    );
  });

  it('fails closed when the execution request cannot be read', async () => {
    const worktreeDir = await mkdtemp(join(tmpdir(), 'brunch-agent-missing-request-'));
    const requestPath = join(worktreeDir, 'missing-request.json');
    const resultPath = join(worktreeDir, 'result.json');
    const calls: string[] = [];
    const port = createAgentRunnerPort({
      subagents: subagentDeps(async ({ definition }): Promise<SubagentResult> => {
        calls.push(definition.name);
        return { agent: definition.name, status: 'ok', text: 'should not run' };
      }),
    });

    await expect(
      port.run({
        worktreeDir,
        requestPath,
        resultPath,
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        runtime: { modelRegistry: {} },
      }),
    ).resolves.toEqual({
      status: 'failed',
      message: `AgentRunnerPort could not read execution request at ${requestPath}.`,
    });
    expect(calls).toEqual([]);
  });
});
