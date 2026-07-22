import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { runCommand, type CommandResult, type CommandRunner } from '../../app/command-runner.js';

const RECIPE_VERSION = 1 as const;
const SOURCE_IDENTITY_FILE = '.comparison-source.json';
const COMPARISON_GIT_IDENTITY = [
  '-c',
  'user.name=Brunch Comparison',
  '-c',
  'user.email=brunch-comparison@invalid.local',
] as const;
const NETWORK_DENIED_RUNNER = Symbol('network-denied-runner');
const REQUIRED_SOLUTION_PROBE_URLS = [
  'https://github.com',
  'https://linear.app',
  'https://www.notion.so',
] as const;
const DENIED_SOLUTION_SOURCE_DOMAINS = [
  'github.com',
  '*.github.com',
  '*.githubusercontent.com',
  'linear.app',
  '*.linear.app',
  'notion.so',
  '*.notion.so',
  'notion.site',
  '*.notion.site',
] as const;

export interface MaterializedPinnedSourceTree {
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly targetDir: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly syntheticCommit: string;
}

export interface ClaudeSolutionIsolationPolicy {
  readonly executor: 'claude_code';
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly targetRoot: string;
  readonly strictMcp: true;
  readonly mcpServers: readonly [];
  readonly webTools: false;
  readonly ambientSettings: false;
  readonly ambientPlugins: false;
  readonly permissionMode: 'dontAsk';
  readonly nativeSandbox: {
    readonly enabled: true;
    readonly failIfUnavailable: true;
    readonly allowedDomains: readonly [];
    readonly deniedDomains: typeof DENIED_SOLUTION_SOURCE_DOMAINS;
    readonly deniedReadRoots: readonly string[];
  };
  readonly allowedTools: readonly ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'];
}

export interface BrunchSolutionIsolationPolicy {
  readonly executor: 'brunch';
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly targetRoot: string;
  readonly foregroundWebTools: false;
  readonly specifySubagents: false;
  readonly foregroundFileRoot: string;
  readonly executionSubagents: readonly ['planner', 'worker'];
  readonly networkDeniedVerifier: true;
}

export type SolutionIsolationPolicy = ClaudeSolutionIsolationPolicy | BrunchSolutionIsolationPolicy;

export interface NetworkDeniedCommandRunner {
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly platform: 'darwin';
  readonly forbiddenReadRoots: readonly string[];
  readonly [NETWORK_DENIED_RUNNER]: true;
  readonly run: CommandRunner;
}

export interface IsolationAdmissionReason {
  readonly code:
    | 'identity_mismatch'
    | 'git_history_present'
    | 'git_ref_present'
    | 'git_remote_present'
    | 'git_worktree_changes_present'
    | 'local_check_failed'
    | 'network_probe_reachable'
    | 'path_boundary_weakened'
    | 'policy_weakened';
  readonly detail: string;
  readonly executor?: SolutionIsolationPolicy['executor'];
}

export class SolutionIsolationAdmissionError extends Error {
  readonly reasons: readonly IsolationAdmissionReason[];

  constructor(reasons: readonly IsolationAdmissionReason[]) {
    super(`historical replay isolation admission failed: ${reasons.map(({ code }) => code).join(', ')}`);
    this.name = 'SolutionIsolationAdmissionError';
    this.reasons = reasons;
  }
}

export async function materializePinnedSourceTree(input: {
  readonly sourceRepositoryDir: string;
  readonly sourceCommit: string;
  readonly targetDir: string;
  readonly runner?: CommandRunner;
}): Promise<MaterializedPinnedSourceTree> {
  const runner = input.runner ?? runCommand;
  const sourceCommit = (
    await gitChecked(runner, input.sourceRepositoryDir, [
      'rev-parse',
      '--verify',
      `${input.sourceCommit}^{commit}`,
    ])
  ).stdout.trim();
  const sourceTree = (
    await gitChecked(runner, input.sourceRepositoryDir, ['rev-parse', '--verify', `${sourceCommit}^{tree}`])
  ).stdout.trim();
  const archiveDir = await mkdtemp(join(tmpdir(), 'brunch-pinned-source-'));
  const archivePath = join(archiveDir, 'source.tar');
  try {
    await mkdir(dirname(input.targetDir), { recursive: true });
    await mkdir(input.targetDir);
    await commandChecked(runner, input.sourceRepositoryDir, 'git', [
      'archive',
      '--format=tar',
      `--output=${archivePath}`,
      sourceCommit,
    ]);
    await commandChecked(runner, input.targetDir, 'tar', ['-xf', archivePath]);
    await writeFile(
      join(input.targetDir, SOURCE_IDENTITY_FILE),
      `${JSON.stringify({ recipeVersion: RECIPE_VERSION, sourceCommit, sourceTree }, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    await gitChecked(runner, input.targetDir, ['init', '--initial-branch=main']);
    await gitChecked(runner, input.targetDir, ['add', '--all']);
    await gitChecked(runner, input.targetDir, [
      ...COMPARISON_GIT_IDENTITY,
      'commit',
      '-m',
      'Materialize pinned comparison source',
    ]);
    const syntheticCommit = (await gitChecked(runner, input.targetDir, ['rev-parse', 'HEAD'])).stdout.trim();
    return {
      recipeVersion: RECIPE_VERSION,
      targetDir: input.targetDir,
      sourceCommit,
      sourceTree,
      syntheticCommit,
    };
  } catch (error) {
    await rm(input.targetDir, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(archiveDir, { recursive: true, force: true });
  }
}

export function createClaudeSolutionIsolationPolicy(
  targetRoot: string,
  forbiddenRoots: readonly string[] = [],
): ClaudeSolutionIsolationPolicy {
  return {
    executor: 'claude_code',
    recipeVersion: RECIPE_VERSION,
    targetRoot: resolve(targetRoot),
    strictMcp: true,
    mcpServers: [],
    webTools: false,
    ambientSettings: false,
    ambientPlugins: false,
    permissionMode: 'dontAsk',
    nativeSandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowedDomains: [],
      deniedDomains: DENIED_SOLUTION_SOURCE_DOMAINS,
      deniedReadRoots: [...new Set(forbiddenRoots.map(canonicalPolicyPath))],
    },
    allowedTools: ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'],
  };
}

export function createBrunchSolutionIsolationPolicy(targetRoot: string): BrunchSolutionIsolationPolicy {
  const root = resolve(targetRoot);
  return {
    executor: 'brunch',
    recipeVersion: RECIPE_VERSION,
    targetRoot: root,
    foregroundWebTools: false,
    specifySubagents: false,
    foregroundFileRoot: root,
    executionSubagents: ['planner', 'worker'],
    networkDeniedVerifier: true,
  };
}

export function createNetworkDeniedCommandRunner(
  options: {
    readonly platform?: NodeJS.Platform;
    readonly run?: CommandRunner;
    readonly forbiddenReadRoots?: readonly string[];
  } = {},
): NetworkDeniedCommandRunner {
  // ceiling: recipe v1 supports macOS sandbox-exec only; add an explicit equivalent host recipe before admitting another platform.
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin') {
    throw new Error(`solution isolation recipe v1 is unsupported on ${platform}`);
  }
  const run = options.run ?? runCommand;
  const forbiddenReadRoots = [...new Set((options.forbiddenReadRoots ?? []).map(canonicalPolicyPath))];
  const sandboxProfile = denyTargetCommandAccessProfile(forbiddenReadRoots);
  return {
    recipeVersion: RECIPE_VERSION,
    platform,
    forbiddenReadRoots,
    [NETWORK_DENIED_RUNNER]: true,
    run: async (command, args, commandOptions) =>
      await run('sandbox-exec', ['-p', sandboxProfile, command, ...args], commandOptions),
  };
}

export function assertTargetBoundedPath(policy: SolutionIsolationPolicy, requestedPath: string): string {
  const targetRoot = resolve(policy.targetRoot);
  const candidate = resolve(targetRoot, requestedPath);
  if (!containedPath(targetRoot, candidate)) {
    throw new Error(`${policy.executor} path escapes target root: ${requestedPath}`);
  }
  return candidate;
}

export async function admitHistoricalReplay(input: {
  readonly materialized: MaterializedPinnedSourceTree;
  readonly policies: readonly SolutionIsolationPolicy[];
  readonly forbiddenRoots: readonly string[];
  readonly networkProbeUrls: readonly string[];
  readonly verifier: NetworkDeniedCommandRunner;
  readonly localChecks: readonly { readonly command: string; readonly args: readonly string[] }[];
  readonly runner?: CommandRunner;
}): Promise<{
  readonly status: 'admitted';
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly executors: readonly SolutionIsolationPolicy['executor'][];
  readonly localChecks: readonly {
    readonly command: string;
    readonly args: readonly string[];
    readonly exitCode: number;
  }[];
}> {
  const runner = input.runner ?? runCommand;
  const reasons: IsolationAdmissionReason[] = [];
  inspectVerifier(input.verifier, input.forbiddenRoots, reasons);
  inspectPolicies(input.policies, input.materialized.targetDir, input.forbiddenRoots, reasons);
  inspectForbiddenRoots(input.policies, input.forbiddenRoots, reasons);
  await inspectMaterializedRepository(input.materialized, runner, reasons);
  await inspectTargetSymlinks(input.materialized.targetDir, reasons);
  if (reasons.length > 0) throw new SolutionIsolationAdmissionError(reasons);

  for (const forbiddenRoot of input.forbiddenRoots) {
    const result = await input.verifier.run('/bin/ls', ['-la', forbiddenRoot], {
      cwd: input.materialized.targetDir,
      timeoutMs: 15_000,
      maxOutputBytes: 16 * 1024,
    });
    if (result.exitCode === 0) {
      throw new SolutionIsolationAdmissionError([
        {
          code: 'path_boundary_weakened',
          detail: `target verifier can read forbidden root: ${forbiddenRoot}`,
        },
      ]);
    }
  }

  const curlReady = await input.verifier.run('/usr/bin/curl', ['--version'], {
    cwd: input.materialized.targetDir,
    timeoutMs: 15_000,
    maxOutputBytes: 16 * 1024,
  });
  if (curlReady.exitCode !== 0) {
    throw new SolutionIsolationAdmissionError([
      { code: 'policy_weakened', detail: 'network-denied verifier cannot execute /usr/bin/curl' },
    ]);
  }

  for (const url of new Set([...input.networkProbeUrls, ...REQUIRED_SOLUTION_PROBE_URLS])) {
    const result = await input.verifier.run('/usr/bin/curl', ['--fail', '--silent', '--show-error', url], {
      cwd: input.materialized.targetDir,
      timeoutMs: 15_000,
      maxOutputBytes: 16 * 1024,
    });
    if (result.exitCode === 0) {
      throw new SolutionIsolationAdmissionError([{ code: 'network_probe_reachable', detail: url }]);
    }
  }

  const localChecks = [];
  for (const check of input.localChecks) {
    const result = await input.verifier.run(check.command, check.args, {
      cwd: input.materialized.targetDir,
      timeoutMs: 10 * 60_000,
      maxOutputBytes: 128 * 1024,
    });
    if (result.exitCode !== 0) {
      throw new SolutionIsolationAdmissionError([
        {
          code: 'local_check_failed',
          detail: `${[check.command, ...check.args].join(' ')} exited ${result.exitCode}`,
        },
      ]);
    }
    localChecks.push({ ...check, exitCode: result.exitCode });
  }

  return {
    status: 'admitted',
    recipeVersion: RECIPE_VERSION,
    sourceCommit: input.materialized.sourceCommit,
    sourceTree: input.materialized.sourceTree,
    executors: input.policies.map(({ executor }) => executor),
    localChecks,
  };
}

function inspectVerifier(
  verifier: NetworkDeniedCommandRunner,
  forbiddenRoots: readonly string[],
  reasons: IsolationAdmissionReason[],
): void {
  if (
    forbiddenRoots.length === 0 ||
    verifier.recipeVersion !== RECIPE_VERSION ||
    verifier.platform !== 'darwin' ||
    verifier[NETWORK_DENIED_RUNNER] !== true ||
    !forbiddenRoots.every((forbiddenRoot) =>
      verifier.forbiddenReadRoots.some((deniedRoot) =>
        containedPath(deniedRoot, canonicalPolicyPath(forbiddenRoot)),
      ),
    )
  ) {
    reasons.push({
      code: 'policy_weakened',
      detail: 'target verifier does not match isolation recipe v1',
    });
  }
}

function inspectPolicies(
  policies: readonly SolutionIsolationPolicy[],
  targetDir: string,
  forbiddenRoots: readonly string[],
  reasons: IsolationAdmissionReason[],
): void {
  if (!sameStrings(policies.map(({ executor }) => executor).sort(), ['brunch', 'claude_code'])) {
    reasons.push({
      code: 'policy_weakened',
      detail: 'isolation recipe v1 requires exactly one Brunch and one Claude Code policy',
    });
  }
  for (const policy of policies) {
    const deniesForbiddenRoots =
      policy.executor !== 'claude_code' ||
      forbiddenRoots.every((forbiddenRoot) =>
        policy.nativeSandbox.deniedReadRoots.some((deniedRoot) =>
          containedPath(deniedRoot, canonicalPolicyPath(forbiddenRoot)),
        ),
      );
    if (
      resolve(policy.targetRoot) !== resolve(targetDir) ||
      !isStrictPolicy(policy) ||
      !deniesForbiddenRoots
    ) {
      reasons.push({
        code: 'policy_weakened',
        detail: `${policy.executor} policy does not match isolation recipe v1`,
        executor: policy.executor,
      });
    }
  }
}

function isStrictPolicy(policy: SolutionIsolationPolicy): boolean {
  if (policy.recipeVersion !== RECIPE_VERSION) return false;
  if (policy.executor === 'claude_code') {
    return (
      policy.strictMcp === true &&
      policy.mcpServers.length === 0 &&
      policy.webTools === false &&
      policy.ambientSettings === false &&
      policy.ambientPlugins === false &&
      policy.permissionMode === 'dontAsk' &&
      policy.nativeSandbox.enabled === true &&
      policy.nativeSandbox.failIfUnavailable === true &&
      policy.nativeSandbox.allowedDomains.length === 0 &&
      sameStrings(policy.nativeSandbox.deniedDomains, DENIED_SOLUTION_SOURCE_DOMAINS) &&
      policy.nativeSandbox.deniedReadRoots.every(
        (deniedRoot) => !containedPath(deniedRoot, canonicalPolicyPath(policy.targetRoot)),
      ) &&
      sameStrings(policy.allowedTools, ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'])
    );
  }
  return (
    policy.foregroundWebTools === false &&
    policy.specifySubagents === false &&
    resolve(policy.foregroundFileRoot) === resolve(policy.targetRoot) &&
    sameStrings(policy.executionSubagents, ['planner', 'worker']) &&
    policy.networkDeniedVerifier === true
  );
}

function inspectForbiddenRoots(
  policies: readonly SolutionIsolationPolicy[],
  forbiddenRoots: readonly string[],
  reasons: IsolationAdmissionReason[],
): void {
  for (const forbiddenRoot of forbiddenRoots) {
    if (
      policies.some(
        (policy) =>
          containedPath(policy.targetRoot, forbiddenRoot) || containedPath(forbiddenRoot, policy.targetRoot),
      )
    ) {
      reasons.push({
        code: 'path_boundary_weakened',
        detail: `forbidden root is inside target boundary: ${forbiddenRoot}`,
      });
      return;
    }
    for (const policy of policies) {
      try {
        assertTargetBoundedPath(policy, forbiddenRoot);
        reasons.push({
          code: 'path_boundary_weakened',
          detail: `${policy.executor} can reach forbidden root: ${forbiddenRoot}`,
          executor: policy.executor,
        });
        return;
      } catch {
        // Expected: every controller, harness, parent, and reference root is outside the target.
      }
    }
  }
}

async function inspectMaterializedRepository(
  materialized: MaterializedPinnedSourceTree,
  runner: CommandRunner,
  reasons: IsolationAdmissionReason[],
): Promise<void> {
  const identity = JSON.parse(
    await readFile(join(materialized.targetDir, SOURCE_IDENTITY_FILE), 'utf8'),
  ) as Partial<MaterializedPinnedSourceTree>;
  if (
    identity.recipeVersion !== RECIPE_VERSION ||
    identity.sourceCommit !== materialized.sourceCommit ||
    identity.sourceTree !== materialized.sourceTree
  ) {
    reasons.push({
      code: 'identity_mismatch',
      detail: 'materialized source identity does not match declaration',
    });
  }
  const commitCount = (
    await gitChecked(runner, materialized.targetDir, ['rev-list', '--count', 'HEAD'])
  ).stdout.trim();
  if (commitCount !== '1') {
    reasons.push({ code: 'git_history_present', detail: `target has ${commitCount} reachable commits` });
  }
  const head = (await gitChecked(runner, materialized.targetDir, ['rev-parse', 'HEAD'])).stdout.trim();
  if (head !== materialized.syntheticCommit) {
    reasons.push({
      code: 'identity_mismatch',
      detail: 'materialized target commit does not match declaration',
    });
  }
  const remotes = (await gitChecked(runner, materialized.targetDir, ['remote'])).stdout.trim();
  if (remotes.length > 0) {
    reasons.push({ code: 'git_remote_present', detail: remotes });
  }
  const refs = (
    await gitChecked(runner, materialized.targetDir, ['for-each-ref', '--format=%(refname)'])
  ).stdout
    .trim()
    .split('\n')
    .filter(Boolean);
  const extraRefs = refs.filter((ref) => ref !== 'refs/heads/main');
  if (extraRefs.length > 0) {
    reasons.push({ code: 'git_ref_present', detail: extraRefs.join(', ') });
  }
  const worktreeChanges = (
    await gitChecked(runner, materialized.targetDir, ['status', '--porcelain'])
  ).stdout.trim();
  if (worktreeChanges.length > 0) {
    reasons.push({ code: 'git_worktree_changes_present', detail: worktreeChanges });
  }
}

async function inspectTargetSymlinks(targetDir: string, reasons: IsolationAdmissionReason[]): Promise<void> {
  const root = await realpath(targetDir);
  const inspectDirectory = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git' && directory === root) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await inspectDirectory(path);
        continue;
      }
      if (!entry.isSymbolicLink()) continue;
      try {
        const destination = await realpath(path);
        if (!containedPath(root, destination)) {
          reasons.push({
            code: 'path_boundary_weakened',
            detail: `target symlink escapes isolation root: ${relative(root, path)}`,
          });
        }
      } catch {
        reasons.push({
          code: 'path_boundary_weakened',
          detail: `target symlink cannot be resolved safely: ${relative(root, path)}`,
        });
      }
    }
  };
  await inspectDirectory(root);
}

function containedPath(root: string, candidate: string): boolean {
  const relation = relative(resolve(root), resolve(candidate));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function canonicalPolicyPath(path: string): string {
  const resolved = resolve(path);
  try {
    return realpathSync(resolved);
  } catch {
    const parent = dirname(resolved);
    if (parent === resolved) return resolved;
    return join(canonicalPolicyPath(parent), resolved.slice(parent.length + 1));
  }
}

function denyTargetCommandAccessProfile(forbiddenReadRoots: readonly string[]): string {
  const rules = ['(version 1)', '(allow default)', '(deny network*)'];
  for (const root of forbiddenReadRoots) {
    const literal = root.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    rules.push(`(deny file-read* file-write* (subpath "${literal}"))`);
  }
  return rules.join('\n');
}

async function gitChecked(
  runner: CommandRunner,
  cwd: string,
  args: readonly string[],
): Promise<CommandResult> {
  return await commandChecked(runner, cwd, 'git', args);
}

async function commandChecked(
  runner: CommandRunner,
  cwd: string,
  command: string,
  args: readonly string[],
): Promise<CommandResult> {
  const result = await runner(command, args, { cwd });
  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}
