import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { sha256Bytes, writeImmutableHandoff } from '../handoff-contract.js';

const roots: string[] = [];
const STUDY_HASH = `sha256:${'b'.repeat(64)}`;

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('immutable elicitation handoff', () => {
  it('writes the approved specification byte-for-byte and records its provenance once', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-handoff-'));
    roots.push(root);
    const runRoot = join(root, 'elicitation-run');
    const sourcePath = join(runRoot, 'lanes', 'brunch', 'final-document.md');
    await mkdir(join(runRoot, 'lanes', 'brunch'), { recursive: true });
    const source = Buffer.from('# Exact target-authored specification\n\nDo not normalize me.  \n');
    await writeFile(sourcePath, source);

    const result = await writeImmutableHandoff({
      elicitationRunRoot: runRoot,
      sourcePath,
      handoffsRoot: join(root, 'handoffs'),
      controllerRoot: join(root, 'controller'),
      targetRoots: [join(root, 'targets', 'brunch'), join(root, 'targets', 'claude')],
      elicitationRunId: 'petri-editor-e2e-r1',
      specSource: 'brunch_spec',
      expectedSpecificationSha256: sha256Bytes(source),
      approvedBy: 'operator@example.com',
      approvedAt: '2026-07-21T13:00:00.000Z',
      studyContractSha256: STUDY_HASH,
    });

    expect(await readFile(result.specificationPath)).toEqual(source);
    expect(result.record).toMatchObject({
      schemaVersion: 1,
      elicitationRunId: 'petri-editor-e2e-r1',
      specSource: 'brunch_spec',
      specificationSha256: sha256Bytes(source),
      studyContractSha256: STUDY_HASH,
    });
    await expect(
      writeImmutableHandoff({
        elicitationRunRoot: runRoot,
        sourcePath,
        handoffsRoot: join(root, 'handoffs'),
        controllerRoot: join(root, 'controller'),
        targetRoots: [join(root, 'targets', 'brunch')],
        elicitationRunId: 'petri-editor-e2e-r1',
        specSource: 'brunch_spec',
        expectedSpecificationSha256: sha256Bytes(source),
        approvedBy: 'operator@example.com',
        approvedAt: '2026-07-21T13:00:00.000Z',
        studyContractSha256: STUDY_HASH,
      }),
    ).rejects.toThrow('handoff brunch_spec already exists');
  });

  it('rejects source drift, source escape, and controller material', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-handoff-'));
    roots.push(root);
    const runRoot = join(root, 'elicitation-run');
    await mkdir(runRoot);
    const sourcePath = join(runRoot, 'spec.md');
    await writeFile(sourcePath, '# changed');

    const base = {
      elicitationRunRoot: runRoot,
      sourcePath,
      handoffsRoot: join(root, 'handoffs'),
      controllerRoot: join(root, 'controller'),
      targetRoots: [join(root, 'targets', 'brunch')],
      elicitationRunId: 'petri-editor-e2e-r1',
      specSource: 'claude_spec' as const,
      expectedSpecificationSha256: `sha256:${'c'.repeat(64)}`,
      approvedBy: 'operator@example.com',
      approvedAt: '2026-07-21T13:00:00.000Z',
      studyContractSha256: STUDY_HASH,
    };
    await expect(writeImmutableHandoff(base)).rejects.toThrow('approved specification hash drifted');
    await expect(
      writeImmutableHandoff({
        ...base,
        sourcePath: join(root, 'outside.md'),
      }),
    ).rejects.toThrow('approved specification must stay inside the elicitation run');
    await expect(
      writeImmutableHandoff({
        ...base,
        sourcePath: join(root, 'controller', 'private.md'),
        elicitationRunRoot: root,
      }),
    ).rejects.toThrow('approved specification may not come from the controller root');
  });
});
