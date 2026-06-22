import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  compileBwrapArgs,
  compileSeatbeltProfile,
  createConfinedFileOperations,
  createSandboxGuard,
  decidePreflight,
  deriveConfinementPolicy,
  wrapCommandInSeatbelt,
} from './sandbox-guard.js';

const bash = promisify(execFile);
const onMac = process.platform === 'darwin';

/** Run a command string exactly as the pi bash tool does: `<shell> -c <command>`. */
async function runAsBashTool(command: string): Promise<{ ok: boolean; stdout: string }> {
  try {
    const { stdout } = await bash('/bin/bash', ['-c', command]);
    return { ok: true, stdout };
  } catch (err) {
    return { ok: false, stdout: (err as { stdout?: string }).stdout ?? '' };
  }
}

let sandboxDir: string;
let outsideDir: string;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'brunch-guard-'));
  sandboxDir = join(root, 'sandbox');
  outsideDir = join(root, 'outside');
  mkdirSync(sandboxDir, { recursive: true });
  mkdirSync(outsideDir, { recursive: true });
  writeFileSync(join(sandboxDir, 'inside.txt'), 'inside');
  writeFileSync(join(outsideDir, 'secret.txt'), 'secret');
});

afterEach(() => {
  rmSync(join(sandboxDir, '..'), { recursive: true, force: true });
});

describe('confined read operations', () => {
  it('reads a file inside the sandbox', async () => {
    const ops = createConfinedFileOperations(sandboxDir);
    const content = await ops.read.readFile(join(sandboxDir, 'inside.txt'));
    expect(content.toString('utf8')).toBe('inside');
  });

  it('refuses an absolute path outside the sandbox', async () => {
    const ops = createConfinedFileOperations(sandboxDir);
    await expect(ops.read.readFile(join(outsideDir, 'secret.txt'))).rejects.toThrow(
      /outside the run sandbox/,
    );
    await expect(ops.read.access(join(outsideDir, 'secret.txt'))).rejects.toThrow(/outside the run sandbox/);
  });

  it('refuses ../ traversal that resolves outside the sandbox', async () => {
    const ops = createConfinedFileOperations(sandboxDir);
    const traversal = join(sandboxDir, '..', 'outside', 'secret.txt');
    await expect(ops.read.readFile(traversal)).rejects.toThrow(/outside the run sandbox/);
  });

  it('refuses reading through a symlink that points outside the sandbox', async () => {
    symlinkSync(join(outsideDir, 'secret.txt'), join(sandboxDir, 'link.txt'));
    const ops = createConfinedFileOperations(sandboxDir);
    await expect(ops.read.readFile(join(sandboxDir, 'link.txt'))).rejects.toThrow(/outside the run sandbox/);
  });
});

describe('confined write and edit operations', () => {
  it('writes inside the sandbox, creating directories as needed', async () => {
    const ops = createConfinedFileOperations(sandboxDir);
    await ops.write.mkdir(join(sandboxDir, 'nested', 'dir'));
    await ops.write.writeFile(join(sandboxDir, 'nested', 'dir', 'out.txt'), 'written');
    expect(readFileSync(join(sandboxDir, 'nested', 'dir', 'out.txt'), 'utf8')).toBe('written');
  });

  it('refuses writes and mkdir outside the sandbox', async () => {
    const ops = createConfinedFileOperations(sandboxDir);
    await expect(ops.write.writeFile(join(outsideDir, 'evil.txt'), 'x')).rejects.toThrow(
      /outside the run sandbox/,
    );
    await expect(ops.write.mkdir(join(outsideDir, 'evil'))).rejects.toThrow(/outside the run sandbox/);
    expect(existsSync(join(outsideDir, 'evil.txt'))).toBe(false);
  });

  it('refuses writing through a symlinked directory that points outside the sandbox', async () => {
    symlinkSync(outsideDir, join(sandboxDir, 'escape'), 'dir');
    const ops = createConfinedFileOperations(sandboxDir);
    await expect(ops.write.writeFile(join(sandboxDir, 'escape', 'evil.txt'), 'x')).rejects.toThrow(
      /outside the run sandbox/,
    );
    expect(existsSync(join(outsideDir, 'evil.txt'))).toBe(false);
  });

  it('edit operations are confined the same way', async () => {
    const ops = createConfinedFileOperations(sandboxDir);
    await expect(ops.edit.readFile(join(outsideDir, 'secret.txt'))).rejects.toThrow(
      /outside the run sandbox/,
    );
    await expect(ops.edit.writeFile(join(outsideDir, 'evil.txt'), 'x')).rejects.toThrow(
      /outside the run sandbox/,
    );
    await expect(ops.edit.access(join(outsideDir, 'secret.txt'))).rejects.toThrow(/outside the run sandbox/);
    const inside = join(sandboxDir, 'inside.txt');
    await ops.edit.access(inside);
    await ops.edit.writeFile(inside, 'edited');
    expect((await ops.edit.readFile(inside)).toString('utf8')).toBe('edited');
  });
});

describe('confinement policy derivation', () => {
  it('makes the sandbox the world: sandbox is read+write, toolchain is read-only, network stays on', () => {
    const policy = deriveConfinementPolicy(sandboxDir);
    const sandboxReal = realpathSync(sandboxDir);
    expect(policy.sandboxRoot).toBe(sandboxReal);
    expect(policy.writeRoots).toContain(sandboxReal);
    expect(policy.readRoots).toContain(sandboxReal);
    expect(policy.network).toBe(true);
    // The node that runs this test must be readable, derived from the live env.
    const nodePrefix = dirname(dirname(realpathSync(process.execPath)));
    expect(policy.readRoots.some((r) => nodePrefix.startsWith(r) || r === nodePrefix)).toBe(true);
  });

  it('does not grant the broad home dir, only specific cache subpaths', () => {
    const policy = deriveConfinementPolicy(sandboxDir);
    expect(policy.readRoots).not.toContain(homedir());
    expect(policy.writeRoots).not.toContain(homedir());
  });

  it('grants specific device nodes for writing, not the whole /dev tree', () => {
    const policy = deriveConfinementPolicy(sandboxDir);
    expect(policy.writeRoots).not.toContain('/dev');
    expect(policy.writeRoots).toContain('/dev/null');
  });
});

describe('seatbelt profile honors the network policy flag', () => {
  const base = { sandboxRoot: '/s', readRoots: ['/s'], writeRoots: ['/s'] };

  it('leaves network allowed by default (network: true)', () => {
    expect(compileSeatbeltProfile({ ...base, network: true })).not.toContain('(deny network');
  });

  it('denies network when the policy says so (network: false)', () => {
    expect(compileSeatbeltProfile({ ...base, network: false })).toContain('(deny network*)');
  });
});

describe.skipIf(!onMac)('seatbelt limit-mode profile (macOS)', () => {
  // A realistic read allowlist: the OS/toolchain base the derivation produces,
  // plus the sandbox. Crucially it does NOT include the sandbox's tmp parent,
  // so sibling temp dirs stay unreadable.
  const limitProfile = (extraRead: string[] = []) =>
    compileSeatbeltProfile({
      ...deriveConfinementPolicy(sandboxDir),
      readRoots: [...deriveConfinementPolicy(sandboxDir).readRoots, ...extraRead],
    });

  it('runs the toolchain and reads inside the sandbox', async () => {
    const ok = await runAsBashTool(
      wrapCommandInSeatbelt(limitProfile(), `cat ${join(sandboxDir, 'inside.txt')}`),
    );
    expect(ok.ok).toBe(true);
    expect(ok.stdout).toContain('inside');
  });

  it('denies reading a sibling outside the sandbox even though it shares the tmp parent', async () => {
    const read = await runAsBashTool(
      wrapCommandInSeatbelt(limitProfile(), `cat ${join(outsideDir, 'secret.txt')}`),
    );
    expect(read.ok).toBe(false);
    expect(read.stdout).not.toContain('secret');
  });

  it('denies writes outside the sandbox, allows them inside', async () => {
    const outside = await runAsBashTool(
      wrapCommandInSeatbelt(limitProfile(), `echo evil > ${join(outsideDir, 'evil.txt')}`),
    );
    expect(outside.ok).toBe(false);
    expect(existsSync(join(outsideDir, 'evil.txt'))).toBe(false);

    const inside = await runAsBashTool(
      wrapCommandInSeatbelt(limitProfile(), `echo ok > ${join(sandboxDir, 'ok.txt')}`),
    );
    expect(inside.ok).toBe(true);
    expect(readFileSync(join(sandboxDir, 'ok.txt'), 'utf8').trim()).toBe('ok');
  });

  it('survives single quotes in the wrapped command', async () => {
    const result = await runAsBashTool(wrapCommandInSeatbelt(limitProfile(), `echo 'it'\\''s quoted'`));
    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toBe("it's quoted");
  });

  // The real deployment shape: the sandbox lives under ~/.brunch, i.e. INSIDE a
  // denied zone. Correctness rests on the re-grant winning over the home deny.
  it('reads the sandbox even when it is nested inside the denied home zone, while a sibling secret stays denied', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'brunch-home-'));
    try {
      const nestedSandbox = join(fakeHome, '.brunch', 'cook', 'runs', 'r1', 'worktree');
      mkdirSync(nestedSandbox, { recursive: true });
      writeFileSync(join(nestedSandbox, 'work.txt'), 'work');
      mkdirSync(join(fakeHome, '.ssh'), { recursive: true });
      writeFileSync(join(fakeHome, '.ssh', 'id_rsa'), 'PRIVATE-KEY');

      const policy = { ...deriveConfinementPolicy(nestedSandbox), sandboxRoot: realpathSync(nestedSandbox) };
      policy.readRoots = [...policy.readRoots, realpathSync(nestedSandbox)];
      const profile = compileSeatbeltProfile(policy, realpathSync(fakeHome));

      const secret = await runAsBashTool(
        wrapCommandInSeatbelt(profile, `cat ${join(fakeHome, '.ssh', 'id_rsa')}`),
      );
      expect(secret.ok).toBe(false);
      expect(secret.stdout).not.toContain('PRIVATE-KEY');

      const work = await runAsBashTool(
        wrapCommandInSeatbelt(profile, `cat ${join(nestedSandbox, 'work.txt')}`),
      );
      expect(work.ok).toBe(true);
      expect(work.stdout).toContain('work');
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});

describe('SandboxGuard — per-run confinement object', () => {
  it('derives the policy once and reports the backend selected for the host', () => {
    const guard = createSandboxGuard(sandboxDir);
    expect(guard.policy.sandboxRoot).toBe(realpathSync(sandboxDir));
    if (onMac) {
      expect(guard.backend).toBe('seatbelt');
      expect(guard.enforcing).toBe(true);
    } else {
      expect(guard.backend).toBe('none');
      expect(guard.enforcing).toBe(false);
    }
  });

  it('degrades to a passthrough none backend on a host with no confinement mechanism', () => {
    const guard = createSandboxGuard(sandboxDir, { platform: 'win32' });
    expect(guard.backend).toBe('none');
    expect(guard.enforcing).toBe(false);
    // passthrough: argv and bash command come back untouched
    expect(guard.confineTest(['bun', 'test', 'a.test.ts'])).toEqual({
      command: 'bun',
      args: ['test', 'a.test.ts'],
    });
    const ctx = { command: 'echo hi', cwd: sandboxDir, env: {} as NodeJS.ProcessEnv };
    expect(guard.bashHook(ctx).command).toBe('echo hi');
  });

  it('selects the bwrap backend on Linux and wraps argv + bash through it', () => {
    const guard = createSandboxGuard(sandboxDir, { platform: 'linux' });
    expect(guard.backend).toBe('bwrap');
    expect(guard.enforcing).toBe(true);
    const confined = guard.confineTest(['bun', 'test', 'a.test.ts']);
    expect(confined.command).toBe('bwrap');
    expect(confined.args.slice(-4)).toEqual(['--', 'bun', 'test', 'a.test.ts']);
    const ctx = { command: 'echo hi', cwd: sandboxDir, env: {} as NodeJS.ProcessEnv };
    expect(guard.bashHook(ctx).command).toMatch(/^bwrap .* -- \/bin\/bash -c /);
  });
});

describe('bwrap arg synthesis (limit-mode binds)', () => {
  it('mounts the fs read-only, hides home, re-grants caches, and binds the sandbox writable — in that order', () => {
    const policy = {
      sandboxRoot: '/home/dev/.brunch/run/wt',
      readRoots: ['/usr', '/home/dev/.bun', '/home/dev/.brunch/run/wt'],
      writeRoots: ['/home/dev/.brunch/run/wt', '/home/dev/.cache'],
      network: true,
    };
    const args = compileBwrapArgs(policy, '/home/dev');
    const joined = args.join(' ');
    // base: whole fs read-only + a real /dev + private /tmp
    expect(joined).toContain('--ro-bind / /');
    expect(joined).toContain('--dev /dev');
    // home is hidden behind a tmpfs (secrets/TCC gone) BEFORE the cache re-grant
    const hideHome = joined.indexOf('--tmpfs /home/dev');
    const regrantCache = joined.indexOf('--ro-bind-try /home/dev/.bun');
    const bindSandbox = joined.indexOf('--bind-try /home/dev/.brunch/run/wt');
    expect(hideHome).toBeGreaterThanOrEqual(0);
    expect(hideHome).toBeLessThan(regrantCache); // hide before re-grant
    expect(regrantCache).toBeLessThan(bindSandbox); // reads before writable bind (later wins)
    expect(joined).toContain('--chdir /home/dev/.brunch/run/wt');
  });

  it('unshares the network only when the policy forbids it', () => {
    const base = { sandboxRoot: '/s', readRoots: ['/s'], writeRoots: ['/s'] };
    expect(compileBwrapArgs({ ...base, network: true }, '/home/dev')).not.toContain('--unshare-net');
    expect(compileBwrapArgs({ ...base, network: false }, '/home/dev')).toContain('--unshare-net');
  });

  it('bashHook rewrites only the command, preserves cwd, and redirects TMPDIR into the sandbox (macOS)', () => {
    if (!onMac) return;
    const guard = createSandboxGuard(sandboxDir);
    const ctx = { command: 'echo hi', cwd: sandboxDir, env: { PATH: '/usr/bin' } as NodeJS.ProcessEnv };
    const rewritten = guard.bashHook(ctx);
    expect(rewritten.command).toMatch(/^sandbox-exec -p /);
    expect(rewritten.command).toContain('echo hi');
    expect(rewritten.cwd).toBe(sandboxDir);
    expect(rewritten.env.TMPDIR).toContain(realpathSync(sandboxDir));
  });

  it('confineTest wraps the argv under sandbox-exec on macOS', () => {
    if (!onMac) return;
    const confined = createSandboxGuard(sandboxDir).confineTest(['bun', 'test', 'a.test.ts']);
    expect(confined.command).toBe('sandbox-exec');
    expect(confined.args.slice(0, 2)).toEqual(['-p', expect.stringContaining('(version 1)')]);
    expect(confined.args.slice(-3)).toEqual(['bun', 'test', 'a.test.ts']);
  });

  it('preflight runs a probe argv under confinement and reports the outcome', async () => {
    const guard = createSandboxGuard(sandboxDir);
    const ok = await guard.preflight(['true']);
    expect(ok.ok).toBe(true);
    expect(ok.backend).toBe(guard.backend);
    const bad = await guard.preflight(['false']);
    expect(bad.ok).toBe(false);
  });

  it('redirects test and preflight temp dirs into the sandbox under enforcing backends', () => {
    type TestBackend = NonNullable<NonNullable<Parameters<typeof createSandboxGuard>[1]>['backend']>;
    const backend: TestBackend = {
      id: 'seatbelt',
      enforces: true,
      wrap: ({ command, args }) => ({ command, args: [...args] }),
    };
    const guard = createSandboxGuard(sandboxDir, { backend });

    const confined = guard.confineTest(['node', '--version']);

    expect(confined.env?.TMPDIR).toBe(join(realpathSync(sandboxDir), '.brunch-tmp'));
    expect(confined.env?.TMP).toBe(confined.env?.TMPDIR);
    expect(confined.env?.TEMP).toBe(confined.env?.TMPDIR);
  });
});

describe('decidePreflight — fail-closed bootstrap decision', () => {
  const base = { backend: 'seatbelt' as const, enforcing: true, probe: ['bun', '--version'] };

  it('proceeds without probing when confinement is turned off', () => {
    expect(decidePreflight({ ...base, mode: 'off', confinedOk: null, unconfinedOk: true })).toEqual({
      action: 'proceed',
    });
  });

  it('proceeds degraded (with a warning) when no backend enforces on this host', () => {
    const d = decidePreflight({
      ...base,
      backend: 'none',
      enforcing: false,
      mode: 'on',
      confinedOk: null,
      unconfinedOk: true,
    });
    expect(d.action).toBe('proceed-degraded');
    if (d.action === 'proceed-degraded') expect(d.warning).toMatch(/unconfined/i);
  });

  it('proceeds when the toolchain runs fine under confinement', () => {
    expect(decidePreflight({ ...base, mode: 'on', confinedOk: true, unconfinedOk: true })).toEqual({
      action: 'proceed',
    });
  });

  it('refuses (fail-closed) when the toolchain runs unconfined but fails confined', () => {
    const d = decidePreflight({ ...base, mode: 'on', confinedOk: false, unconfinedOk: true });
    expect(d.action).toBe('refuse');
    if (d.action === 'refuse') {
      expect(d.reason).toMatch(/confinement/i);
      expect(d.reason).toMatch(/--confine=off/);
    }
  });

  it('refuses with a toolchain-broken reason when the probe fails even unconfined', () => {
    const d = decidePreflight({ ...base, mode: 'on', confinedOk: false, unconfinedOk: false });
    expect(d.action).toBe('refuse');
    if (d.action === 'refuse') {
      expect(d.reason).toMatch(/toolchain/i);
      expect(d.reason).not.toMatch(/--confine=off/);
    }
  });
});
