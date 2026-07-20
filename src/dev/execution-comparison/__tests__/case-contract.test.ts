import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadPublicCasePacket } from '../case-contract.js';
import { loadControllerOraclePack } from '../oracle-pack.js';

const caseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/minimal-petri-net-editor/', import.meta.url),
);

describe('execution comparison public case contract', () => {
  it('freezes only the approved specification and public contract', async () => {
    const packet = await loadPublicCasePacket(caseDir);

    expect(packet.contract.case).toMatchObject({
      id: 'minimal-petri-net-editor-v1',
      specification: 'spec.md',
      specificationSha256: '0b817fb7451762b4adaf37d2555ce9fefc27bfcf3765e5b4343ef741a10edfc2',
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      repository: { substrate: 'empty_dir', base: 'fresh-empty-commit' },
    });
    expect(packet.contract.budgets).toEqual({
      elapsedMinutes: 90,
      mechanicalInterventions: 2,
      substantiveHumanInterventions: 0,
    });
    expect(packet.contract.delivery).toMatchObject({
      staticOutput: 'dist',
      runtimeNetwork: 'forbidden',
    });
    expect(packet.files.map((file) => file.path)).toEqual(['public-contract.json', 'spec.md']);
    expect(packet.files.every((file) => /^sha256:[a-f0-9]{64}$/u.test(file.sha256))).toBe(true);
    expect(packet.packetSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('rejects controller references and a changed approved specification', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-execution-case-'));
    await cp(caseDir, root, { recursive: true });

    const contractPath = join(root, 'public-contract.json');
    const contract = JSON.parse(await readFile(contractPath, 'utf8')) as Record<string, unknown>;
    contract['rules'] = ['Read controller/oracle-manifest.json'];
    await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
    await expect(loadPublicCasePacket(root)).rejects.toThrow('controller-only');

    await cp(join(caseDir, 'public-contract.json'), contractPath);
    await writeFile(join(root, 'spec.md'), '# Changed\n', 'utf8');
    await expect(loadPublicCasePacket(root)).rejects.toThrow('specification hash');
  });

  it('rejects dynamic accessible-name patterns outside the frozen contract', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-execution-case-pattern-'));
    await cp(caseDir, root, { recursive: true });

    const contractPath = join(root, 'public-contract.json');
    const contract = JSON.parse(await readFile(contractPath, 'utf8')) as {
      accessibility: { dynamic: { transition: { namePattern: string } } };
    };
    contract.accessibility.dynamic.transition.namePattern = '^(a+)+$';
    await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');

    await expect(loadPublicCasePacket(root)).rejects.toThrow('invalid fixed public execution contract');
  });

  it('content-addresses the hidden manifest, fixtures, and oracle implementations separately', async () => {
    const pack = await loadControllerOraclePack({
      caseDir,
      implementationFiles: [
        fileURLToPath(new URL('../browser-oracle.ts', import.meta.url)),
        fileURLToPath(new URL('../petri-reference.ts', import.meta.url)),
      ],
    });

    expect(pack.manifest).toMatchObject({
      id: 'minimal-petri-net-editor-oracles-v1',
      publicCaseId: 'minimal-petri-net-editor-v1',
      browserSuiteVersion: 'petri-editor-browser-v1',
      referenceModelVersion: 'weighted-pt-v1',
    });
    expect(pack.manifest.journeys.map((journey) => journey.id)).toEqual([
      'mount',
      'node-lifecycle',
      'weighted-fire-reset-reload',
      'invalid-and-cascade',
      'round-trip-and-clear',
    ]);
    expect(pack.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'controller/oracle-manifest.json',
        'controller/fixtures/invalid/not-json.txt',
        'controller/fixtures/invalid/schema-invalid.json',
        'implementation/browser-oracle.ts',
        'implementation/petri-reference.ts',
      ]),
    );
    expect(pack.files.some((file) => file.path.includes('/dist/'))).toBe(false);
    expect(pack.packSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });
});
