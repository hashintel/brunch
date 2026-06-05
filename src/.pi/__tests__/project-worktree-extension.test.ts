import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';

import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import worktreeExtension, {
  cleanForkedSessionHeader,
  createRelocatedSession,
  createSiblingWorktree,
  planSiblingWorktree,
  resolveSwitchTarget,
  runSwitchWorktree,
  validateGitWorktree,
  WORKTREE_CREATE_COMMAND,
  WORKTREE_CREATE_TOOL,
  WORKTREE_SWITCH_COMMAND,
  WORKTREE_SWITCH_TOOL,
} from '../../../.pi/extensions/worktree/index.js';

const execFile = promisify(execFileCallback);

describe('project-local worktree Pi extension', () => {
  it('registers the auto-discovered command and LLM staging tool', () => {
    const recording = createRecordingApi();

    worktreeExtension(recording.api);

    expect(recording.commandNames).toEqual([WORKTREE_SWITCH_COMMAND, WORKTREE_CREATE_COMMAND]);
    expect(recording.toolNames).toEqual([WORKTREE_SWITCH_TOOL, WORKTREE_CREATE_TOOL]);
    expect(recording.tools[0]?.promptGuidelines).toContain(
      'Call switch_worktree only after the user explicitly asks to move this Pi session to another git worktree.',
    );
  });

  it('normalizes targets against the caller cwd and validates git worktrees', async () => {
    await withTempDir(async (dir) => {
      const repo = join(dir, 'repo');
      const file = join(repo, 'file.txt');
      await git(dir, 'init', 'repo');
      await writeFile(file, 'tracked\n');
      await git(repo, 'add', 'file.txt');
      await git(repo, '-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'initial');

      const linked = join(dir, 'repo-linked');
      await git(repo, 'worktree', 'add', linked, 'HEAD');

      expect(resolveSwitchTarget('repo-linked', dir)).toBe(linked);
      await expect(validateGitWorktree(repo)).resolves.toEqual({ ok: true, cwd: repo });
      await expect(validateGitWorktree(linked)).resolves.toEqual({ ok: true, cwd: linked });
      await expect(validateGitWorktree(join(dir, 'missing'))).resolves.toEqual({
        ok: false,
        reason: 'missing',
        path: join(dir, 'missing'),
      });
      await expect(validateGitWorktree(file)).resolves.toEqual({
        ok: false,
        reason: 'not-directory',
        path: file,
      });

      const nongit = join(dir, 'plain');
      await mkdir(nongit);
      await git(dir, 'init', '--bare', 'bare.git');
      await expect(validateGitWorktree(nongit)).resolves.toEqual({
        ok: false,
        reason: 'not-git-worktree',
        path: nongit,
      });
      await expect(validateGitWorktree(join(dir, 'bare.git'))).resolves.toEqual({
        ok: false,
        reason: 'bare-repository',
        path: join(dir, 'bare.git'),
      });
    });
  });

  it('forks the current session into the target cwd without retaining parent-session metadata', async () => {
    await withTempDir(async (dir) => {
      const sourceSession = join(dir, 'source.jsonl');
      const target = join(dir, 'target');
      const sessionDir = join(dir, 'sessions');
      await git(dir, 'init', 'target');
      await writeFile(
        sourceSession,
        [
          JSON.stringify({
            type: 'session',
            version: 3,
            id: 'source-session',
            timestamp: '2026-06-05T00:00:00.000Z',
            cwd: dir,
            parentSession: '/old-parent.jsonl',
          }),
          JSON.stringify({
            type: 'message',
            id: 'm1',
            parentId: null,
            timestamp: '2026-06-05T00:00:01.000Z',
            message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }], timestamp: 0 },
          }),
          '',
        ].join('\n'),
      );

      const relocated = await createRelocatedSession(sourceSession, target, sessionDir);
      const relocatedContent = await readFile(relocated, 'utf8');
      const relocatedHeader = JSON.parse(relocatedContent.split('\n')[0] ?? '{}') as Record<string, unknown>;

      expect(relocatedHeader.cwd).toBe(target);
      expect(relocatedHeader.parentSession).toBeUndefined();
      await expect(stat(sourceSession)).resolves.toBeTruthy();
    });
  });

  it('confirms before switching and sends the continuation through the replacement context', async () => {
    await withTempDir(async (dir) => {
      const target = join(dir, 'target');
      const sourceSession = join(dir, 'source.jsonl');
      const sessionDir = join(dir, 'sessions');
      await git(dir, 'init', 'target');
      await writeFile(
        sourceSession,
        `${JSON.stringify({ type: 'session', version: 3, id: 's1', timestamp: '2026-06-05T00:00:00.000Z', cwd: dir })}\n${JSON.stringify({ type: 'message', id: 'm1', parentId: null, timestamp: '2026-06-05T00:00:01.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }], timestamp: 0 } })}\n`,
      );
      const ctx = createSwitchContext({ cwd: dir, sourceSession, sessionDir, confirm: true });

      await runSwitchWorktree(target, ctx, { sessionDir });

      expect(ctx.confirmations).toHaveLength(1);
      expect(ctx.switchedSessionFile).toContain(sessionDir);
      expect(ctx.replacementMessages).toEqual([`Continue in the relocated Pi session from cwd: ${target}`]);
      expect(ctx.notifications.at(-1)).toEqual({
        message: `Relocated Pi session to ${target}`,
        type: 'info',
      });
    });
  });

  it('removes parentSession only from the session header line', async () => {
    await withTempDir(async (dir) => {
      const session = join(dir, 'session.jsonl');
      await writeFile(
        session,
        `${JSON.stringify({ type: 'session', id: 's1', timestamp: '2026-06-05T00:00:00.000Z', cwd: dir, parentSession: 'old' })}\n${JSON.stringify({ type: 'custom', id: 'c1', parentId: null, timestamp: '2026-06-05T00:00:01.000Z', data: { parentSession: 'kept' } })}\n`,
      );

      await cleanForkedSessionHeader(session);

      const [headerLine, customLine] = (await readFile(session, 'utf8')).trimEnd().split('\n');
      expect(JSON.parse(headerLine ?? '{}')).not.toHaveProperty('parentSession');
      expect(JSON.parse(customLine ?? '{}')).toHaveProperty('data.parentSession', 'kept');
    });
  });

  it('plans sibling defaults from the caller worktree root and skips path and branch collisions', async () => {
    await withTempDir(async (dir) => {
      const repo = join(dir, 'repo');
      await initRepo(repo);
      await mkdir(join(dir, 'repo-alpha'));
      await git(repo, 'branch', 'repo-beta');

      await expect(
        planSiblingWorktree({
          sourceRoot: repo,
          branchExists: async (branch) => branch === 'repo-beta',
          pathExists: async (path) => path === join(dir, 'repo-alpha'),
          greekWords: ['alpha', 'beta', 'gamma'],
          chooseStartIndex: () => 0,
        }),
      ).resolves.toEqual({
        path: join(dir, 'repo-gamma'),
        branch: 'repo-gamma',
        attempted: ['repo-alpha', 'repo-beta', 'repo-gamma'],
      });
    });
  });

  it('creates sibling worktrees from caller HEAD in main and linked worktrees', async () => {
    await withTempDir(async (dir) => {
      const main = join(dir, 'repo');
      await initRepo(main);
      const mainHead = await gitOutput(main, 'rev-parse', 'HEAD');

      const linked = join(dir, 'repo-linked');
      await git(main, 'worktree', 'add', '-b', 'linked', linked, 'HEAD');
      await writeFile(join(linked, 'linked.txt'), 'linked\n');
      await git(linked, 'add', 'linked.txt');
      await git(
        linked,
        '-c',
        'user.email=test@example.com',
        '-c',
        'user.name=Test',
        'commit',
        '-m',
        'linked',
      );
      const linkedHead = await gitOutput(linked, 'rev-parse', 'HEAD');

      const mainCtx = createWorktreeCreationContext(main);
      const mainResult = await createSiblingWorktree(mainCtx, {
        greekWords: ['alpha'],
        chooseStartIndex: () => 0,
      });
      if (mainResult.status !== 'created') throw new Error(mainResult.reason);
      expect(mainResult).toMatchObject({
        status: 'created',
        sourceCommit: mainHead,
        branch: 'repo-alpha',
        path: join(dirname(mainResult.sourceRoot), 'repo-alpha'),
      });
      expect(await gitOutput(mainResult.path, 'rev-parse', 'HEAD')).toBe(mainHead);
      expect(mainCtx.editorText).toBe(`/switch-worktree ${mainResult.path}`);

      const linkedCtx = createWorktreeCreationContext(linked);
      const linkedResult = await createSiblingWorktree(linkedCtx, {
        greekWords: ['beta'],
        chooseStartIndex: () => 0,
      });
      if (linkedResult.status !== 'created') throw new Error(linkedResult.reason);
      expect(linkedResult).toMatchObject({
        status: 'created',
        sourceCommit: linkedHead,
        branch: 'repo-linked-beta',
        path: join(dirname(linkedResult.sourceRoot), 'repo-linked-beta'),
      });
      expect(await gitOutput(linkedResult.path, 'rev-parse', 'HEAD')).toBe(linkedHead);
      expect(linkedCtx.editorText).toBe(`/switch-worktree ${linkedResult.path}`);
    });
  }, 15000);

  it('warns when the caller worktree is dirty but still creates from committed HEAD', async () => {
    await withTempDir(async (dir) => {
      const repo = join(dir, 'repo');
      await initRepo(repo);
      const head = await gitOutput(repo, 'rev-parse', 'HEAD');
      await writeFile(join(repo, 'dirty.txt'), 'not committed\n');
      const ctx = createWorktreeCreationContext(repo);

      const result = await createSiblingWorktree(ctx, { greekWords: ['delta'], chooseStartIndex: () => 0 });
      if (result.status !== 'created') throw new Error(result.reason);

      expect(result).toMatchObject({
        status: 'created',
        sourceCommit: head,
        dirty: true,
        dirtyWarning:
          'Caller worktree has uncommitted changes; the new worktree was created from committed HEAD only.',
      });
      expect(ctx.notifications).toContainEqual({
        message:
          'Caller worktree has uncommitted changes; the new worktree was created from committed HEAD only.',
        type: 'warning',
      });
      await expect(stat(join(result.path, 'dirty.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });
});

function createRecordingApi() {
  const commandNames: string[] = [];
  const toolNames: string[] = [];
  const tools: Array<{ name: string; promptGuidelines?: string[] }> = [];
  const api = {
    registerCommand(name: string) {
      commandNames.push(name);
    },
    registerTool(tool: { name: string; promptGuidelines?: string[] }) {
      toolNames.push(tool.name);
      tools.push(tool);
    },
  };
  return { api: api as never as ExtensionAPI, commandNames, toolNames, tools };
}

function createSwitchContext({
  cwd,
  sourceSession,
  sessionDir,
  confirm,
}: {
  cwd: string;
  sourceSession: string;
  sessionDir: string;
  confirm: boolean;
}) {
  const confirmations: string[] = [];
  const notifications: Array<{ message: string; type: 'info' | 'warning' | 'error' | undefined }> = [];
  const replacementMessages: string[] = [];
  const ctx = {
    cwd,
    hasUI: true,
    ui: {
      confirm: async (title: string, message: string) => {
        confirmations.push(`${title}\n${message}`);
        return confirm;
      },
      notify: (message: string, type?: 'info' | 'warning' | 'error') => {
        notifications.push({ message, type });
      },
      setEditorText() {},
    },
    sessionManager: {
      getSessionFile: () => sourceSession,
      getSessionDir: () => sessionDir,
    },
    switchSession: async (
      sessionFile: string,
      options: {
        withSession?: (replacementCtx: {
          sendUserMessage: (message: string) => Promise<void>;
          ui: { notify: (message: string, type?: 'info' | 'warning' | 'error') => void };
        }) => Promise<void>;
      },
    ) => {
      ctx.switchedSessionFile = sessionFile;
      await options.withSession?.({
        sendUserMessage: async (message: string) => {
          replacementMessages.push(message);
        },
        ui: ctx.ui,
      });
      return { cancelled: false };
    },
    switchedSessionFile: undefined as string | undefined,
    confirmations,
    notifications,
    replacementMessages,
  };
  return ctx as typeof ctx & ExtensionCommandContext;
}

function createWorktreeCreationContext(cwd: string) {
  const notifications: Array<{ message: string; type: 'info' | 'warning' | 'error' | undefined }> = [];
  const ctx = {
    cwd,
    hasUI: true,
    editorText: undefined as string | undefined,
    ui: {
      notify: (message: string, type?: 'info' | 'warning' | 'error') => {
        notifications.push({ message, type });
      },
      setEditorText: (text: string) => {
        ctx.editorText = text;
      },
    },
    notifications,
  };
  return ctx;
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'brunch-pi-worktree-'));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function initRepo(path: string): Promise<void> {
  await git(dirname(path), 'init', basename(path));
  await writeFile(join(path, 'tracked.txt'), 'tracked\n');
  await git(path, 'add', 'tracked.txt');
  await git(path, '-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'initial');
}

async function gitOutput(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd });
  return stdout.trim();
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFile('git', args, { cwd });
}
