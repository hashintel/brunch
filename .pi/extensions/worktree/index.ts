import { execFile as execFileCallback } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';

import {
  SessionManager,
  type ExtensionAPI,
  type ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

const execFile = promisify(execFileCallback);

export const WORKTREE_SWITCH_COMMAND = 'switch-worktree';
export const WORKTREE_SWITCH_TOOL = 'switch_worktree';

export type WorktreeValidationResult =
  | { readonly ok: true; readonly cwd: string }
  | {
      readonly ok: false;
      readonly path: string;
      readonly reason: 'missing' | 'not-directory' | 'bare-repository' | 'not-git-worktree';
    };

export interface SwitchWorktreeResultDetails {
  readonly status: 'staged' | 'switched' | 'cancelled' | 'failed';
  readonly targetPath: string;
  readonly sessionFile?: string;
  readonly reason?: string;
}

export interface SwitchWorktreeOptions {
  readonly sessionDir?: string;
}

interface GitProbeResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

interface ReplacementMessageContext {
  readonly sendUserMessage: (message: string) => Promise<void>;
  readonly ui: {
    readonly notify: (message: string, type?: 'info' | 'warning' | 'error') => void;
  };
}

export function resolveSwitchTarget(targetPath: string, cwd: string): string {
  const trimmed = targetPath.trim();
  if (trimmed.length === 0) return '';
  return isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed);
}

export async function validateGitWorktree(targetPath: string): Promise<WorktreeValidationResult> {
  let targetStat;
  try {
    targetStat = await stat(targetPath);
  } catch {
    return { ok: false, reason: 'missing', path: targetPath };
  }

  if (!targetStat.isDirectory()) {
    return { ok: false, reason: 'not-directory', path: targetPath };
  }

  const bareProbe = await gitProbe(targetPath, 'rev-parse', '--is-bare-repository');
  if (bareProbe.ok && bareProbe.stdout.trim() === 'true') {
    return { ok: false, reason: 'bare-repository', path: targetPath };
  }

  const worktreeProbe = await gitProbe(targetPath, 'rev-parse', '--is-inside-work-tree');
  if (!worktreeProbe.ok || worktreeProbe.stdout.trim() !== 'true') {
    return { ok: false, reason: 'not-git-worktree', path: targetPath };
  }

  return { ok: true, cwd: targetPath };
}

export async function createRelocatedSession(
  sourceSessionFile: string,
  targetCwd: string,
  sessionDir?: string,
): Promise<string> {
  const manager = SessionManager.forkFrom(sourceSessionFile, targetCwd, sessionDir);
  const sessionFile = manager.getSessionFile();
  if (!sessionFile) throw new Error('Pi did not persist the relocated session file.');
  await cleanForkedSessionHeader(sessionFile);
  return sessionFile;
}

export async function cleanForkedSessionHeader(sessionFile: string): Promise<void> {
  const content = await readFile(sessionFile, 'utf8');
  const lineEnd = content.indexOf('\n');
  const firstLine = lineEnd === -1 ? content : content.slice(0, lineEnd);
  if (firstLine.trim().length === 0) return;

  const header = JSON.parse(firstLine) as Record<string, unknown>;
  if (header.type !== 'session' || !Object.hasOwn(header, 'parentSession')) return;

  delete header.parentSession;
  const rest = lineEnd === -1 ? '' : content.slice(lineEnd);
  await writeFile(sessionFile, `${JSON.stringify(header)}${rest}`);
}

export async function runSwitchWorktree(
  targetPath: string,
  ctx: ExtensionCommandContext,
  options: SwitchWorktreeOptions = {},
): Promise<SwitchWorktreeResultDetails> {
  const resolvedTarget = resolveSwitchTarget(targetPath, ctx.cwd);
  if (resolvedTarget.length === 0) {
    ctx.ui.notify('Usage: /switch-worktree <path>', 'error');
    return { status: 'failed', targetPath: resolvedTarget, reason: 'missing target path' };
  }

  const validation = await validateGitWorktree(resolvedTarget);
  if (!validation.ok) {
    const reason = validationReason(validation);
    ctx.ui.notify(reason, 'error');
    return { status: 'failed', targetPath: resolvedTarget, reason };
  }

  if (ctx.hasUI) {
    const confirmed = await ctx.ui.confirm(
      'Switch Pi worktree?',
      `Relocate this Pi session to ${validation.cwd}?\n\nThe current session file will be preserved.`,
    );
    if (!confirmed) {
      ctx.ui.notify('Worktree switch cancelled.', 'info');
      return { status: 'cancelled', targetPath: validation.cwd };
    }
  }

  const sourceSessionFile = ctx.sessionManager.getSessionFile();
  if (!sourceSessionFile) {
    const reason = 'Current Pi session is not persisted, so it cannot be relocated.';
    ctx.ui.notify(reason, 'error');
    return { status: 'failed', targetPath: validation.cwd, reason };
  }

  const relocatedSessionFile = await createRelocatedSession(
    sourceSessionFile,
    validation.cwd,
    options.sessionDir,
  );
  const continuation = continuationPrompt(validation.cwd);
  const result = await ctx.switchSession(relocatedSessionFile, {
    withSession: async (replacementCtx: ReplacementMessageContext) => {
      await replacementCtx.sendUserMessage(continuation);
      replacementCtx.ui.notify(`Relocated Pi session to ${validation.cwd}`, 'info');
    },
  });

  if (result.cancelled) {
    return {
      status: 'cancelled',
      targetPath: validation.cwd,
      sessionFile: relocatedSessionFile,
      reason: 'session switch cancelled by a Pi hook',
    };
  }

  return { status: 'switched', targetPath: validation.cwd, sessionFile: relocatedSessionFile };
}

export default function registerWorktreeExtension(pi: ExtensionAPI): void {
  pi.registerCommand(WORKTREE_SWITCH_COMMAND, {
    description: 'Relocate this Pi session to another git worktree',
    handler: async (args, ctx) => {
      await runSwitchWorktree(args, ctx);
    },
  });

  pi.registerTool({
    name: WORKTREE_SWITCH_TOOL,
    label: 'Switch worktree',
    description:
      'Validate a target git worktree and stage /switch-worktree <path> in the editor so the user can explicitly relocate this Pi session.',
    promptSnippet:
      'switch_worktree validates a target git worktree and stages a /switch-worktree command for user-confirmed Pi session relocation.',
    promptGuidelines: [
      'Call switch_worktree only after the user explicitly asks to move this Pi session to another git worktree.',
      'Do not use switch_worktree to create, delete, prune, or clean up worktrees.',
      'After switch_worktree stages /switch-worktree <path>, tell the user to press Enter if they want to relocate the session.',
    ],
    parameters: Type.Object({
      path: Type.String({ description: 'Absolute or relative path to the target git worktree.' }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const resolvedTarget = resolveSwitchTarget(params.path, ctx.cwd);
      const validation = await validateGitWorktree(resolvedTarget);
      if (!validation.ok) {
        const reason = validationReason(validation);
        return {
          content: [{ type: 'text' as const, text: reason }],
          details: {
            status: 'failed',
            targetPath: resolvedTarget,
            reason,
          } satisfies SwitchWorktreeResultDetails,
        };
      }

      const command = `/${WORKTREE_SWITCH_COMMAND} ${validation.cwd}`;
      if (ctx.hasUI) ctx.ui.setEditorText(command);
      return {
        content: [
          {
            type: 'text' as const,
            text: ctx.hasUI
              ? `Staged ${command}. Press Enter to relocate this Pi session.`
              : `Validated ${validation.cwd}. Run ${command} in interactive Pi to relocate this session.`,
          },
        ],
        details: { status: 'staged', targetPath: validation.cwd } satisfies SwitchWorktreeResultDetails,
      };
    },
  });
}

function continuationPrompt(targetCwd: string): string {
  return `Continue in the relocated Pi session from cwd: ${targetCwd}`;
}

function validationReason(validation: Extract<WorktreeValidationResult, { ok: false }>): string {
  switch (validation.reason) {
    case 'missing':
      return `Target path does not exist: ${validation.path}`;
    case 'not-directory':
      return `Target path is not a directory: ${validation.path}`;
    case 'bare-repository':
      return `Target path is a bare git repository, not a working tree: ${validation.path}`;
    case 'not-git-worktree':
      return `Target path is not a git working tree: ${validation.path}`;
  }
}

async function gitProbe(cwd: string, ...args: string[]): Promise<GitProbeResult> {
  try {
    const { stdout, stderr } = await execFile('git', args, { cwd });
    return { ok: true, stdout, stderr };
  } catch (error) {
    const result = error as { readonly stdout?: unknown; readonly stderr?: unknown };
    return {
      ok: false,
      stdout: typeof result.stdout === 'string' ? result.stdout : '',
      stderr: typeof result.stderr === 'string' ? result.stderr : '',
    };
  }
}
