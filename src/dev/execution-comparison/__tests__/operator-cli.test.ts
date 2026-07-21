import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listExecutionCases, prepareExecutionTarget, resolveExecutionCase } from '../operator-cli.js';

const casesRoot = fileURLToPath(new URL('../../../../testing/execution-comparisons/cases/', import.meta.url));
const frozenCase = join(casesRoot, 'minimal-petri-net-editor');

describe('execution comparison operator case selection', () => {
  it('lists and resolves eligible case ids only inside the cases root', async () => {
    await expect(listExecutionCases(casesRoot)).resolves.toEqual([
      {
        caseId: 'minimal-petri-net-editor-v1',
        directoryId: 'minimal-petri-net-editor',
      },
    ]);
    await expect(resolveExecutionCase('minimal-petri-net-editor', casesRoot)).resolves.toMatchObject({
      caseId: 'minimal-petri-net-editor-v1',
      directoryId: 'minimal-petri-net-editor',
      caseDir: frozenCase,
    });
  });

  it.each(['/tmp/minimal-petri-net-editor', '../minimal-petri-net-editor', 'controller', 'x/controller/y'])(
    'rejects unsafe case reference %s',
    async (reference) => {
      await expect(resolveExecutionCase(reference, casesRoot)).rejects.toThrow(
        /absolute|traversal|controller|case id/u,
      );
    },
  );

  it('rejects an ambiguous public case id without guessing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-execution-case-selection-'));
    try {
      await cp(frozenCase, join(root, 'first'), { recursive: true });
      await cp(frozenCase, join(root, 'second'), { recursive: true });

      await expect(resolveExecutionCase('minimal-petri-net-editor-v1', root)).rejects.toThrow(
        'ambiguous execution case id',
      );
      await expect(resolveExecutionCase('first', root)).resolves.toMatchObject({
        directoryId: 'first',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not follow case or public-file symlinks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-execution-case-symlink-'));
    try {
      await symlink(frozenCase, join(root, 'linked-case'));
      const linkedFiles = join(root, 'linked-files');
      await mkdir(linkedFiles);
      await symlink(join(frozenCase, 'spec.md'), join(linkedFiles, 'spec.md'));
      await symlink(join(frozenCase, 'public-contract.json'), join(linkedFiles, 'public-contract.json'));

      await expect(listExecutionCases(root)).resolves.toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('execution comparison target preparation', () => {
  it.each(['brunch', 'claude_code'] as const)(
    'keeps controller material out of a fresh %s target',
    async (lane) => {
      const root = await mkdtemp(join(tmpdir(), `brunch-execution-${lane}-`));
      const targetDir = join(root, 'target');
      try {
        const prepared = await prepareExecutionTarget({
          lane,
          caseReference: 'minimal-petri-net-editor',
          casesRoot,
          targetDir,
        });
        const paths = await readdir(targetDir, { recursive: true });

        expect(paths.some((path) => path.toLowerCase().includes('controller'))).toBe(false);
        expect(prepared.packet.files.map((file) => file.path)).toEqual(['public-contract.json', 'spec.md']);
        if (prepared.lane === 'claude_code') {
          expect(await readFile(join(targetDir, 'spec.md'), 'utf8')).toBe(
            await readFile(join(frozenCase, 'spec.md'), 'utf8'),
          );
          expect(await readFile(join(targetDir, 'public-contract.json'), 'utf8')).toBe(
            await readFile(join(frozenCase, 'public-contract.json'), 'utf8'),
          );
          expect(prepared.baseSha).toMatch(/^[a-f0-9]{40}$/u);
        } else {
          expect(prepared.specId).toBe(1);
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});
