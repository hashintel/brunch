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
  compileSeatbeltProfile,
  confineTestCommand,
  createConfinedFileOperations,
  createSeatbeltSpawnHook,
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

describe('seatbelt spawn hook', () => {
  it('rewrites only the command, preserving cwd, and redirects TMPDIR into the sandbox', () => {
    const hook = createSeatbeltSpawnHook(sandboxDir);
    if (!onMac) {
      expect(hook).toBeUndefined();
      return;
    }
    expect(hook).toBeDefined();
    const ctx = { command: 'echo hi', cwd: sandboxDir, env: { PATH: '/usr/bin' } as NodeJS.ProcessEnv };
    const rewritten = hook!(ctx);
    expect(rewritten.command).toMatch(/^sandbox-exec -p /);
    expect(rewritten.command).toContain('echo hi');
    expect(rewritten.cwd).toBe(sandboxDir);
    expect(rewritten.env.TMPDIR).toContain(realpathSync(sandboxDir));
  });
});

describe('test-runner confinement', () => {
  it('wraps the spawn argv under sandbox-exec on macOS, passthrough elsewhere', () => {
    const confined = confineTestCommand(sandboxDir, 'bun', ['test', 'a.test.ts']);
    if (onMac) {
      expect(confined.command).toBe('sandbox-exec');
      expect(confined.args.slice(0, 2)).toEqual(['-p', expect.stringContaining('(version 1)')]);
      expect(confined.args.slice(-3)).toEqual(['bun', 'test', 'a.test.ts']);
    } else {
      expect(confined).toEqual({ command: 'bun', args: ['test', 'a.test.ts'] });
    }
  });
});
