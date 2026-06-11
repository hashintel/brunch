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
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildSeatbeltProfile,
  createConfinedFileOperations,
  createSeatbeltSpawnHook,
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

describe.skipIf(!onMac)('seatbelt-confined bash commands (macOS)', () => {
  const profileFor = (sandbox: string, denyRead: string[]) =>
    buildSeatbeltProfile({ writeRoots: [sandbox], denyReadSubpaths: denyRead });

  it('denies writes outside the sandbox and allows them inside', async () => {
    const profile = profileFor(sandboxDir, []);
    const outside = await runAsBashTool(
      wrapCommandInSeatbelt(profile, `echo evil > ${join(outsideDir, 'evil.txt')}`),
    );
    expect(outside.ok).toBe(false);
    expect(existsSync(join(outsideDir, 'evil.txt'))).toBe(false);

    const inside = await runAsBashTool(
      wrapCommandInSeatbelt(profile, `echo ok > ${join(sandboxDir, 'ok.txt')}`),
    );
    expect(inside.ok).toBe(true);
    expect(readFileSync(join(sandboxDir, 'ok.txt'), 'utf8').trim()).toBe('ok');
  });

  it('denies reads of protected subpaths', async () => {
    const profile = profileFor(sandboxDir, [outsideDir]);
    const read = await runAsBashTool(wrapCommandInSeatbelt(profile, `cat ${join(outsideDir, 'secret.txt')}`));
    expect(read.ok).toBe(false);
    expect(read.stdout).not.toContain('secret');
  });

  it('survives single quotes in the wrapped command', async () => {
    const profile = profileFor(sandboxDir, []);
    const result = await runAsBashTool(wrapCommandInSeatbelt(profile, `echo 'it'\\''s quoted'`));
    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toBe("it's quoted");
  });
});

describe('seatbelt spawn hook', () => {
  it('rewrites only the command, preserving cwd and env', () => {
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
    expect(rewritten.env).toBe(ctx.env);
  });

  it('denies reading TCC-protected user folders by default', () => {
    if (!onMac) return;
    const hook = createSeatbeltSpawnHook(sandboxDir)!;
    const { command } = hook({ command: 'ls', cwd: sandboxDir, env: process.env });
    for (const folder of ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures']) {
      expect(command).toContain(`/${folder}`);
    }
  });
});
