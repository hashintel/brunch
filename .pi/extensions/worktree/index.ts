import { execFile as execFileCallback } from 'node:child_process';
import type { Stats } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import {
  SessionManager,
  type ExtensionAPI,
  type ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

const execFile = promisify(execFileCallback);

export const WORKTREE_SWITCH_COMMAND = 'worktree:switch';
export const WORKTREE_SWITCH_TOOL = 'switch_worktree';
export const WORKTREE_CREATE_COMMAND = 'worktree:create';
export const WORKTREE_CREATE_TOOL = 'create_worktree';

const DIRTY_WORKTREE_WARNING =
  'Caller worktree has uncommitted changes; the new worktree was created from committed HEAD only.';

const DEFAULT_GREEK_WORDS = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'zeta',
  'eta',
  'theta',
  'iota',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'xi',
  'omicron',
  'pi',
  'rho',
  'sigma',
  'tau',
  'upsilon',
  'phi',
  'chi',
  'psi',
  'omega',
] as const;

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

export interface SiblingWorktreePlan {
  readonly path: string;
  readonly branch: string;
  readonly attempted: readonly string[];
}

export interface SiblingWorktreePlanOptions {
  readonly sourceRoot: string;
  readonly greekWords?: readonly string[];
  readonly chooseStartIndex?: (candidateCount: number) => number;
  readonly pathExists: (path: string) => Promise<boolean>;
  readonly branchExists: (branch: string) => Promise<boolean>;
}

export interface CreateSiblingWorktreeOptions {
  readonly greekWords?: readonly string[];
  readonly chooseStartIndex?: (candidateCount: number) => number;
}

export type CreateSiblingWorktreeResultDetails =
  | {
      readonly status: 'created';
      readonly sourceRoot: string;
      readonly sourceCommit: string;
      readonly path: string;
      readonly branch: string;
      readonly dirty: boolean;
      readonly dirtyWarning?: string;
      readonly stdout: string;
      readonly stderr: string;
    }
  | {
      readonly status: 'failed';
      readonly reason: string;
      readonly sourceRoot?: string;
      readonly sourceCommit?: string;
      readonly path?: string;
      readonly branch?: string;
      readonly attempted?: readonly string[];
      readonly stdout?: string;
      readonly stderr?: string;
    };

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

interface WorktreeCreationContext {
  readonly cwd: string;
  readonly hasUI?: boolean;
  readonly ui: {
    readonly notify: (message: string, type?: 'info' | 'warning' | 'error') => void;
    readonly setEditorText?: (text: string) => void;
  };
}

export function resolveSwitchTarget(targetPath: string, cwd: string): string {
  const trimmed = targetPath.trim();
  if (trimmed.length === 0) return '';
  return isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed);
}

export async function validateGitWorktree(targetPath: string): Promise<WorktreeValidationResult> {
  let targetStat: Stats;
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

export async function planSiblingWorktree(options: SiblingWorktreePlanOptions): Promise<SiblingWorktreePlan> {
  const words = options.greekWords ?? DEFAULT_GREEK_WORDS;
  if (words.length === 0) throw new Error('No Greek suffix words configured.');

  const startIndex = normalizeStartIndex(
    options.chooseStartIndex?.(words.length) ?? randomStartIndex(words.length),
    words.length,
  );
  const parentDir = dirname(options.sourceRoot);
  const sourceBasename = basename(options.sourceRoot);
  const attempted: string[] = [];

  for (let offset = 0; offset < words.length; offset += 1) {
    const word = words[(startIndex + offset) % words.length];
    if (!word) continue;
    const name = `${sourceBasename}-${word}`;
    attempted.push(name);

    const path = join(parentDir, name);
    if (await options.pathExists(path)) continue;
    if (await options.branchExists(name)) continue;

    return { path, branch: name, attempted };
  }

  throw new Error(`No available sibling worktree name. Attempted: ${attempted.join(', ')}`);
}

export async function createSiblingWorktree(
  ctx: WorktreeCreationContext,
  options: CreateSiblingWorktreeOptions = {},
): Promise<CreateSiblingWorktreeResultDetails> {
  const rootProbe = await gitProbe(ctx.cwd, 'rev-parse', '--show-toplevel');
  if (!rootProbe.ok) {
    const reason = gitFailureReason('Could not resolve caller git worktree root.', rootProbe);
    ctx.ui.notify(reason, 'error');
    return { status: 'failed', reason, stdout: rootProbe.stdout, stderr: rootProbe.stderr };
  }
  const sourceRoot = rootProbe.stdout.trim();

  const headProbe = await gitProbe(ctx.cwd, 'rev-parse', 'HEAD');
  if (!headProbe.ok) {
    const reason = gitFailureReason('Could not resolve caller HEAD.', headProbe);
    ctx.ui.notify(reason, 'error');
    return { status: 'failed', reason, sourceRoot, stdout: headProbe.stdout, stderr: headProbe.stderr };
  }
  const sourceCommit = headProbe.stdout.trim();

  const dirtyProbe = await gitProbe(ctx.cwd, 'status', '--porcelain');
  if (!dirtyProbe.ok) {
    const reason = gitFailureReason('Could not inspect caller worktree status.', dirtyProbe);
    ctx.ui.notify(reason, 'error');
    return {
      status: 'failed',
      reason,
      sourceRoot,
      sourceCommit,
      stdout: dirtyProbe.stdout,
      stderr: dirtyProbe.stderr,
    };
  }
  const dirty = dirtyProbe.stdout.trim().length > 0;

  let plan: SiblingWorktreePlan;
  try {
    plan = await planSiblingWorktree({
      sourceRoot,
      ...(options.greekWords === undefined ? {} : { greekWords: options.greekWords }),
      ...(options.chooseStartIndex === undefined ? {} : { chooseStartIndex: options.chooseStartIndex }),
      pathExists,
      branchExists: (branch) => branchExists(sourceRoot, branch),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Could not plan sibling worktree.';
    ctx.ui.notify(reason, 'error');
    return { status: 'failed', reason, sourceRoot, sourceCommit };
  }

  const addProbe = await gitProbe(sourceRoot, 'worktree', 'add', '-b', plan.branch, plan.path, sourceCommit);
  if (!addProbe.ok) {
    const reason = gitFailureReason('Could not create sibling git worktree.', addProbe);
    ctx.ui.notify(reason, 'error');
    return {
      status: 'failed',
      reason,
      sourceRoot,
      sourceCommit,
      path: plan.path,
      branch: plan.branch,
      attempted: plan.attempted,
      stdout: addProbe.stdout,
      stderr: addProbe.stderr,
    };
  }

  const validation = await validateGitWorktree(plan.path);
  if (!validation.ok) {
    const reason = validationReason(validation);
    ctx.ui.notify(reason, 'error');
    return {
      status: 'failed',
      reason,
      sourceRoot,
      sourceCommit,
      path: plan.path,
      branch: plan.branch,
      attempted: plan.attempted,
    };
  }

  const switchCommand = `/${WORKTREE_SWITCH_COMMAND} ${validation.cwd}`;
  if (ctx.hasUI) ctx.ui.setEditorText?.(switchCommand);
  if (dirty) ctx.ui.notify(DIRTY_WORKTREE_WARNING, 'warning');
  ctx.ui.notify(`Created git worktree ${validation.cwd} at ${sourceCommit}.`, 'info');

  const created = {
    status: 'created' as const,
    sourceRoot,
    sourceCommit,
    path: validation.cwd,
    branch: plan.branch,
    dirty,
    stdout: addProbe.stdout,
    stderr: addProbe.stderr,
  };
  return dirty ? { ...created, dirtyWarning: DIRTY_WORKTREE_WARNING } : created;
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
    ctx.ui.notify('Usage: /worktree:switch <path>', 'error');
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

  pi.registerCommand(WORKTREE_CREATE_COMMAND, {
    description: 'Create a sibling git worktree from this cwd HEAD and stage a worktree switch',
    handler: async (_args, ctx) => {
      await createSiblingWorktree(ctx);
    },
  });

  pi.registerTool({
    name: WORKTREE_SWITCH_TOOL,
    label: 'Switch worktree',
    description:
      'Validate a target git worktree and stage /worktree:switch <path> in the editor so the user can explicitly relocate this Pi session.',
    promptSnippet:
      'switch_worktree validates a target git worktree and stages a /worktree:switch command for user-confirmed Pi session relocation.',
    promptGuidelines: [
      'Call switch_worktree only after the user explicitly asks to move this Pi session to another git worktree.',
      'Do not use switch_worktree to create, delete, prune, or clean up worktrees.',
      'After switch_worktree stages /worktree:switch <path>, tell the user to press Enter if they want to relocate the session.',
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

  pi.registerTool({
    name: WORKTREE_CREATE_TOOL,
    label: 'Create sibling worktree',
    description:
      'Create a sibling git worktree from the caller cwd HEAD, then stage /worktree:switch <new-path> for explicit relocation.',
    promptSnippet:
      'create_worktree creates a sibling git worktree from the current cwd committed HEAD and stages /worktree:switch <path>; it never deletes or prunes worktrees.',
    promptGuidelines: [
      'Call create_worktree only when the user explicitly asks to create a sibling git worktree.',
      'The created worktree is based on the caller cwd HEAD; warn that uncommitted changes are excluded when the caller worktree is dirty.',
      'Do not delete, prune, clean up, or manage existing worktrees after creation.',
      'After create_worktree stages /worktree:switch <path>, tell the user to press Enter if they want to relocate the Pi session.',
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const details = await createSiblingWorktree(ctx);
      if (details.status === 'failed') {
        return {
          content: [{ type: 'text' as const, text: details.reason }],
          details,
        };
      }

      const warning = details.dirtyWarning ? `\n\nWarning: ${details.dirtyWarning}` : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Created ${details.path} on branch ${details.branch} from ${details.sourceCommit}. Staged /worktree:switch ${details.path}.${warning}`,
          },
        ],
        details,
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

function normalizeStartIndex(candidate: number, candidateCount: number): number {
  if (!Number.isFinite(candidate) || candidateCount <= 0) return 0;
  const whole = Math.trunc(candidate);
  return ((whole % candidateCount) + candidateCount) % candidateCount;
}

function randomStartIndex(candidateCount: number): number {
  return Math.floor(Math.random() * candidateCount);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    return !isNodeError(error) || error.code !== 'ENOENT';
  }
}

async function branchExists(cwd: string, branch: string): Promise<boolean> {
  const result = await gitProbe(cwd, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`);
  return result.ok;
}

function gitFailureReason(prefix: string, result: GitProbeResult): string {
  const output = [result.stderr.trim(), result.stdout.trim()].filter((part) => part.length > 0).join('\n');
  return output.length > 0 ? `${prefix}\n${output}` : prefix;
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
