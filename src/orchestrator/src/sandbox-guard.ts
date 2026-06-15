import { spawn } from 'node:child_process';
import { constants, existsSync, mkdirSync, realpathSync } from 'node:fs';
import {
  access as fsAccess,
  mkdir as fsMkdir,
  readFile as fsReadFile,
  realpath,
  writeFile as fsWriteFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  type BashSpawnHook,
  createBashToolDefinition,
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type EditOperations,
  type ReadOperations,
  type ToolDefinition,
  type WriteOperations,
} from '@earendil-works/pi-coding-agent';

export interface ConfinedFileOperations {
  read: ReadOperations;
  write: WriteOperations;
  edit: EditOperations;
}

/** Resolve symlinks on the deepest existing ancestor so a link inside the sandbox cannot tunnel out. */
async function realpathDeepestExisting(absolutePath: string): Promise<string> {
  let dir = absolutePath;
  let suffix = '';
  for (;;) {
    try {
      const real = await realpath(dir);
      return suffix ? join(real, suffix) : real;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return absolutePath;
      suffix = suffix ? join(dir.slice(parent.length + 1), suffix) : dir.slice(parent.length + 1);
      dir = parent;
    }
  }
}

function outsideSandboxError(absolutePath: string, sandboxRoot: string): Error {
  return new Error(`Path ${absolutePath} is outside the run sandbox ${sandboxRoot}`);
}

async function assertInsideSandbox(sandboxRoot: string, absolutePath: string): Promise<void> {
  const real = await realpathDeepestExisting(resolve(absolutePath));
  const rel = relative(sandboxRoot, real);
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) {
    throw outsideSandboxError(absolutePath, sandboxRoot);
  }
}

// ---------------------------------------------------------------------------
// Confinement policy — the sandbox is the agent's world
// ---------------------------------------------------------------------------

/**
 * One source of truth per run, compiled into every enforcement layer (file-tool
 * guards, seatbelt/bwrap command wrapping, the test-runner spawn). The model is
 * *limit, not exclude*: nothing outside `readRoots`/`writeRoots` exists for the
 * agent, so secrets and TCC-protected folders are covered by not being granted.
 */
export interface ConfinementPolicy {
  /** The realpath'd run sandbox — the only place the agent's work lives. */
  sandboxRoot: string;
  /** Subtrees whose file *contents* the agent may read (OS base + toolchain + sandbox). */
  readRoots: string[];
  /** Subtrees the agent may write (sandbox + tool caches). */
  writeRoots: string[];
  /** Agents need the model API and toolchains need the registry; file I/O is the confined axis. */
  network: boolean;
}

/** OS subtrees any program must read to launch (dyld, frameworks, shells, certs). macOS. */
const STATIC_READ_BASE_DARWIN = [
  '/usr',
  '/bin',
  '/sbin',
  '/System',
  '/Library',
  '/etc',
  '/private/etc',
  '/dev',
  '/opt/homebrew',
  '/opt/local',
  '/var/db',
  '/private/var/db',
  '/var/select',
];

/** Resolve a binary on PATH and return the realpath of its install prefix (dir + parent). */
function toolchainPrefixesFor(bin: string, pathEnv: string | undefined): string[] {
  for (const dir of (pathEnv ?? '').split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, bin);
    if (!existsSync(candidate)) continue;
    try {
      const real = realpathSync(candidate);
      return [dirname(real), dirname(dirname(real))];
    } catch {
      return [dirname(candidate)];
    }
  }
  return [];
}

/** Toolchain read roots derived from the live environment — never hardcoded paths to "where node lives". */
function deriveToolchainReadRoots(home: string, env: NodeJS.ProcessEnv): string[] {
  const roots: string[] = [];
  // The interpreter actually running cook (covers nvm/asdf/volta/system).
  try {
    const nodeReal = realpathSync(process.execPath);
    roots.push(dirname(nodeReal), dirname(dirname(nodeReal)));
  } catch {
    // execPath should always resolve; tolerate exotic hosts.
  }
  for (const bin of ['bun', 'npx', 'npm', 'node', 'git', 'sh', 'env']) {
    roots.push(...toolchainPrefixesFor(bin, env.PATH));
  }
  // Package manager caches the toolchain reads from (not secrets).
  roots.push(join(home, '.bun'), join(home, '.npm'), join(home, '.cache'), join(home, '.nvm'));
  if (env.npm_config_cache) roots.push(env.npm_config_cache);
  return roots;
}

/**
 * Derive the run's confinement policy from the live environment. `readRoots`
 * deliberately omit the broad tmp parent so the sandbox's sibling temp dirs
 * stay unreadable; per-command scratch is redirected into the sandbox instead.
 */
export function deriveConfinementPolicy(
  sandboxDir: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): ConfinementPolicy {
  const sandboxRoot = realpathSync(resolve(sandboxDir));
  const home = homedir();
  const base = platform === 'darwin' ? STATIC_READ_BASE_DARWIN : [];
  const toolchain = deriveToolchainReadRoots(home, env);
  // Caches the toolchain writes back to on install (not secrets).
  const writeCaches = [join(home, '.bun'), join(home, '.npm'), join(home, '.cache')];
  return {
    sandboxRoot,
    readRoots: dedupe([...base, ...toolchain, sandboxRoot]),
    // Specific device nodes, not the whole /dev tree — a tool needs the null
    // sink, tty, and randomness, never raw disks.
    writeRoots: dedupe([sandboxRoot, ...WRITABLE_DEVICE_NODES, ...writeCaches]),
    network: true,
  };
}

/** The only device nodes an agent command legitimately writes; never raw disks. */
const WRITABLE_DEVICE_NODES = [
  '/dev/null',
  '/dev/zero',
  '/dev/random',
  '/dev/urandom',
  '/dev/tty',
  '/dev/stdout',
  '/dev/stderr',
];

// `/bin/sh` → dirname twice is `/`, which would grant the whole filesystem and
// defeat limit-mode. Drop root entirely; the static base lists real OS dirs.
function dedupe(paths: string[]): string[] {
  return [...new Set(paths.filter((p) => p && p !== '/'))];
}

// ---------------------------------------------------------------------------
// Seatbelt backend (macOS) — compiles a ConfinementPolicy to sandbox-exec
// ---------------------------------------------------------------------------

const escapeProfilePath = (path: string): string => path.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

// Seatbelt matches kernel-resolved paths, so emit the realpath spelling too
// (e.g. /var/folders → /private/var/folders); keep the raw one for robustness.
function subpathFilters(paths: string[]): string {
  const spellings = new Set<string>();
  for (const path of paths) {
    spellings.add(path);
    try {
      spellings.add(realpathSync(path));
    } catch {
      // Path may not exist yet (e.g. ~/.cache) — the raw spelling still applies.
    }
  }
  return [...spellings].map((p) => `(subpath "${escapeProfilePath(p)}")`).join(' ');
}

/**
 * Zones that actually hold user data: home (secrets, ssh/aws/config, TCC
 * folders), the per-user temp dir, and external volumes. Denying read *here*
 * — rather than denying `/` — is the meaningful limit boundary: OS dirs
 * (`/usr`, `/System`, the dyld shared cache) stay readable so the dynamic
 * loader works, while everything the agent has no business reading is denied
 * and only the policy roots (sandbox + toolchain caches) are re-granted.
 */
function denyReadZones(home: string): string[] {
  return [home, '/Users', '/var/folders', '/private/var/folders', '/tmp', '/private/tmp', '/Volumes'];
}

/**
 * Compile a policy to a seatbelt profile. Limit-mode: non-file operations stay
 * allowed (process exec, network); all writes are default-denied and re-granted
 * only under `writeRoots`; reads of the user-data zones are denied and re-granted
 * only under the policy roots. Last-match-wins, so the allow lists follow the
 * denies. You can read what you can write (own scratch), so the read grant
 * unions both root sets.
 */
export function compileSeatbeltProfile(policy: ConfinementPolicy, home: string = homedir()): string {
  const allowWrites = subpathFilters(policy.writeRoots);
  const allowReads = subpathFilters([...policy.readRoots, ...policy.writeRoots]);
  const denyReads = subpathFilters(denyReadZones(home));
  return [
    '(version 1)',
    '(allow default)',
    '(deny file-write* (subpath "/"))',
    `(allow file-write* ${allowWrites})`,
    `(deny file-read-data ${denyReads})`,
    `(allow file-read-data ${allowReads})`,
    ...(policy.network ? [] : ['(deny network*)']),
  ].join('\n');
}

const shellQuote = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;

/** Wrap a bash command string so it executes under the given seatbelt profile. */
export function wrapCommandInSeatbelt(profile: string, command: string): string {
  return `sandbox-exec -p ${shellQuote(profile)} /bin/bash -c ${shellQuote(command)}`;
}

/** Per-run scratch dir inside the sandbox, so confined commands need no tmp grant outside it. */
function sandboxTmpDir(sandboxRoot: string): string {
  const dir = join(sandboxRoot, '.brunch-tmp');
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Backend strategy — the one platform-varying step
// ---------------------------------------------------------------------------

type BackendId = 'seatbelt' | 'none';

/** A spawn request normalized to one shape before any backend sees it. `shell`
 *  distinguishes the bash tool's single shell string from a real argv. */
export interface NormalizedRequest {
  shell: boolean;
  command: string;
  args: readonly string[];
}

/** A ready-to-spawn command after confinement (or passthrough). */
export interface ConfinedSpawn {
  command: string;
  args: string[];
}

/**
 * The single platform-varying contract. A backend turns a normalized request
 * into a confined spawn; it owns all profile/arg synthesis. Adding a platform
 * (e.g. Linux bwrap) is one new factory + one line in `selectBackend` — no
 * caller change.
 */
interface ConfinementBackend {
  readonly id: BackendId;
  readonly enforces: boolean;
  wrap(req: NormalizedRequest): ConfinedSpawn;
}

/** macOS seatbelt backend. Compiles the profile once at construction. */
function seatbeltBackend(policy: ConfinementPolicy): ConfinementBackend {
  const profile = compileSeatbeltProfile(policy);
  return {
    id: 'seatbelt',
    enforces: true,
    wrap: (req) =>
      req.shell
        ? { command: wrapCommandInSeatbelt(profile, req.command), args: [] }
        : { command: 'sandbox-exec', args: ['-p', profile, req.command, ...req.args] },
  };
}

/** Passthrough backend for hosts without a confinement mechanism (bwrap is the follow-on). */
function noneBackend(): ConfinementBackend {
  return { id: 'none', enforces: false, wrap: (req) => ({ command: req.command, args: [...req.args] }) };
}

/** The SOLE `process.platform` read in this module — selects the enforcement backend. */
function selectBackend(policy: ConfinementPolicy, platform: NodeJS.Platform): ConfinementBackend {
  return platform === 'darwin' ? seatbeltBackend(policy) : noneBackend();
}

// ---------------------------------------------------------------------------
// SandboxGuard — one per-run object over policy + backend
// ---------------------------------------------------------------------------

export interface ProbeResult {
  ok: boolean;
  code: number | null;
  backend: BackendId;
}

export interface SandboxGuard {
  readonly backend: BackendId;
  readonly enforcing: boolean;
  readonly policy: ConfinementPolicy;
  /** Pre-bound spawn hook for the pi bash tool; TMPDIR redirected into the sandbox. */
  readonly bashHook: BashSpawnHook;
  /** Confine a resolved test-runner argv (`bun test …`) → spawn descriptor. */
  confineTest(argv: readonly string[]): ConfinedSpawn;
  /** Run a probe argv under confinement and report pass/fail (fail-closed wiring is the caller's). */
  preflight(probeArgv?: readonly string[]): Promise<ProbeResult>;
}

/**
 * Build the per-run guard: derive the `ConfinementPolicy` once, select the
 * backend once, and serve every command-confinement caller through it. `backend`
 * and `platform` are injectable for tests (assert seatbelt argv on any host).
 */
export function createSandboxGuard(
  sandboxDir: string,
  opts: { backend?: ConfinementBackend; platform?: NodeJS.Platform } = {},
): SandboxGuard {
  // Resolve the host platform once, then thread it to both policy derivation
  // (read-base) and backend selection — no scattered platform branching.
  const platform = opts.platform ?? process.platform;
  const policy = deriveConfinementPolicy(sandboxDir, process.env, platform);
  const backend = opts.backend ?? selectBackend(policy, platform);
  const tmp = backend.enforces ? sandboxTmpDir(policy.sandboxRoot) : undefined;

  const bashHook: BashSpawnHook = (ctx) => {
    const { command } = backend.wrap({ shell: true, command: ctx.command, args: [] });
    return tmp
      ? { ...ctx, command, env: { ...ctx.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp } }
      : { ...ctx, command };
  };

  const confineTest = (argv: readonly string[]): ConfinedSpawn => {
    const [command, ...args] = argv;
    return backend.wrap({ shell: false, command: command ?? '', args });
  };

  const preflight = (probeArgv: readonly string[] = ['true']): Promise<ProbeResult> => {
    const { command, args } = confineTest(probeArgv);
    return new Promise<ProbeResult>((resolve) => {
      const child = spawn(command, args, { cwd: policy.sandboxRoot, stdio: 'ignore' });
      child.on('error', () => resolve({ ok: false, code: null, backend: backend.id }));
      child.on('close', (code) => resolve({ ok: code === 0, code, backend: backend.id }));
    });
  };

  return { backend: backend.id, enforcing: backend.enforces, policy, bashHook, confineTest, preflight };
}

/**
 * Confined tool definitions for the in-process pi session. Same names as the
 * built-ins, so the SDK tool registry overrides them and the per-action
 * allowlist keeps applying. File tools get path-guarded operations on every
 * platform; bash is wrapped only where a backend enforces (macOS today).
 */
export function createConfinedTools(sandboxDir: string): ToolDefinition[] {
  const guard = createSandboxGuard(sandboxDir);
  const ops = createConfinedFileOperations(sandboxDir);
  // Erase the per-tool TDetails generics: invariant in ToolDefinition, so the
  // concrete factory types don't assign to ToolDefinition[] without it.
  return [
    createReadToolDefinition(sandboxDir, { operations: ops.read }),
    createWriteToolDefinition(sandboxDir, { operations: ops.write }),
    createEditToolDefinition(sandboxDir, { operations: ops.edit }),
    ...(guard.enforcing ? [createBashToolDefinition(sandboxDir, { spawnHook: guard.bashHook })] : []),
  ] as ToolDefinition[];
}

/**
 * File operations for the pi SDK's read/write/edit tools that refuse any path
 * outside `sandboxDir` (absolute escapes, `../` traversal, and symlink escapes
 * alike), then delegate to the local filesystem. Paths arrive already resolved
 * against the session cwd, so containment here is a complete choke point.
 */
export function createConfinedFileOperations(sandboxDir: string): ConfinedFileOperations {
  const sandboxRoot = realpathSync(resolve(sandboxDir));

  const readFile = async (absolutePath: string): Promise<Buffer> => {
    await assertInsideSandbox(sandboxRoot, absolutePath);
    return fsReadFile(absolutePath);
  };
  const writeFile = async (absolutePath: string, content: string): Promise<void> => {
    await assertInsideSandbox(sandboxRoot, absolutePath);
    await fsWriteFile(absolutePath, content);
  };

  return {
    read: {
      readFile,
      access: async (absolutePath) => {
        await assertInsideSandbox(sandboxRoot, absolutePath);
        await fsAccess(absolutePath, constants.R_OK);
      },
    },
    write: {
      writeFile,
      mkdir: async (dir) => {
        await assertInsideSandbox(sandboxRoot, dir);
        await fsMkdir(dir, { recursive: true });
      },
    },
    edit: {
      readFile,
      writeFile,
      access: async (absolutePath) => {
        await assertInsideSandbox(sandboxRoot, absolutePath);
        await fsAccess(absolutePath, constants.R_OK | constants.W_OK);
      },
    },
  };
}
