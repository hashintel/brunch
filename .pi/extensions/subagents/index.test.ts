import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import subagents, { Semaphore } from './index.js';

describe('vendored subagent registration', () => {
  it('refreshes the tool description from the real project trust context', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'subagents-description-'));
    const agentHome = path.join(root, 'agent-home');
    const projectRoot = path.join(root, 'project');
    await mkdir(path.join(agentHome, 'subagents'), { recursive: true });
    await mkdir(path.join(projectRoot, '.pi', 'subagents'), { recursive: true });
    await writeFile(
      path.join(agentHome, 'subagents', 'worker.md'),
      '---\nname: worker\ndescription: User worker\n---\n',
    );
    await writeFile(
      path.join(projectRoot, '.pi', 'subagents', 'analyst.md'),
      '---\nname: analyst\ndescription: Project analyst\n---\n',
    );

    const previousAgentDir = process.env['PI_CODING_AGENT_DIR'];
    process.env['PI_CODING_AGENT_DIR'] = agentHome;
    const registered: Array<{ description: string }> = [];
    let sessionStart:
      | ((event: unknown, ctx: { cwd: string; isProjectTrusted(): boolean }) => void)
      | undefined;

    try {
      subagents({
        registerTool(tool: { description: string }) {
          registered.push(tool);
        },
        on(event: string, handler: typeof sessionStart) {
          if (event === 'session_start') sessionStart = handler;
        },
      } as never);

      expect(registered.at(-1)?.description).toContain('resolved when the session starts');
      expect(sessionStart).toBeDefined();

      sessionStart?.({}, { cwd: projectRoot, isProjectTrusted: () => false });
      const untrustedDescription = registered.at(-1)?.description ?? '';
      expect(untrustedDescription).toContain('Available user-level agents');
      expect(untrustedDescription).toContain('worker (User worker)');
      expect(untrustedDescription).not.toContain('analyst (Project analyst)');

      sessionStart?.({}, { cwd: projectRoot, isProjectTrusted: () => true });
      const trustedDescription = registered.at(-1)?.description ?? '';
      expect(trustedDescription).toContain('Available agents for this trusted project');
      expect(trustedDescription).toContain('analyst (Project analyst)');
      expect(trustedDescription).toContain('worker (User worker)');
    } finally {
      if (previousAgentDir === undefined) delete process.env['PI_CODING_AGENT_DIR'];
      else process.env['PI_CODING_AGENT_DIR'] = previousAgentDir;
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('vendored subagent Semaphore', () => {
  it('admits up to the configured limit and drains every waiter', async () => {
    const semaphore = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const completed: number[] = [];

    await Promise.all(
      [1, 2, 3, 4, 5].map((id) =>
        semaphore.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          completed.push(id);
          active -= 1;
        }),
      ),
    );

    expect(peak).toBe(2);
    expect(completed).toHaveLength(5);
  });

  it('hands a released permit to the oldest waiter before a new arrival', async () => {
    const semaphore = new Semaphore(1);
    const started: string[] = [];
    let active = 0;
    let peak = 0;
    let releaseFirst!: () => void;

    const first = semaphore.run(async () => {
      started.push('first');
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      active -= 1;
    });
    const second = semaphore.run(async () => {
      started.push('second');
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
    });

    releaseFirst();
    const third = semaphore.run(async () => {
      started.push('third');
      active += 1;
      peak = Math.max(peak, active);
      active -= 1;
    });

    await Promise.all([first, second, third]);
    expect(started).toEqual(['first', 'second', 'third']);
    expect(peak).toBe(1);
  });
});
