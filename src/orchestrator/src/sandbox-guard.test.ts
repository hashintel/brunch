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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConfinedFileOperations } from './sandbox-guard.js';

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
