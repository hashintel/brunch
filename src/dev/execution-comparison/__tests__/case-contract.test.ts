import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadPublicCasePacket, parsePublicCaseContract } from '../case-contract.js';
import { isPetriControllerOracleManifest, loadControllerOraclePack } from '../oracle-pack.js';

const caseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/minimal-petri-net-editor/', import.meta.url),
);

describe('execution comparison public case contract', () => {
  it('accepts only the frozen greenfield and two exact brownfield profile variants', () => {
    const brunchContract = {
      schemaVersion: 1,
      case: {
        id: 'brunch-host-landing-v1',
        specification: 'spec.md',
        specificationSha256: 'a'.repeat(64),
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        product: 'brunch',
        mode: 'brownfield',
        scope: 'single_feature',
        surface: 'backend',
        repository: {
          substrate: 'pinned_git',
          parentCommit: '1'.repeat(40),
          parentTree: '2'.repeat(40),
        },
      },
      budgets: {
        elapsedMinutes: 90,
        mechanicalInterventions: 2,
        substantiveHumanInterventions: 0,
      },
      delivery: {
        runtimeNetwork: 'forbidden',
        dependencyInstallNetwork: 'forbidden',
      },
      acceptance: {
        publicCommand: '/brunch:land',
        executionTerminal: 'promotion_prepared',
      },
      rules: ['Work only in the target repository.'],
    };

    expect(parsePublicCaseContract(brunchContract)).toEqual(brunchContract);
    for (const mutation of [
      { accessibility: { application: { role: 'application', name: 'Browser-only leak' } } },
      { case: { ...brunchContract.case, mode: 'greenfield' } },
      { case: { ...brunchContract.case, repository: { substrate: 'empty_dir' } } },
      { delivery: { ...brunchContract.delivery, test: { command: 'sh', args: ['oracle.sh'] } } },
    ]) {
      expect(() => parsePublicCaseContract({ ...brunchContract, ...mutation })).toThrow(
        'invalid fixed public execution contract',
      );
    }

    const petrinautContract = {
      ...brunchContract,
      case: {
        ...brunchContract.case,
        id: 'petrinaut-optimization-v1',
        product: 'petrinaut',
        surface: 'frontend',
        repository: {
          substrate: 'pinned_git',
          parentCommit: '5c7a2d9db5caa851c38938f4b1bac19005b0e978',
          parentTree: 'a3e08cf75e00cc9016c931f4665341506e03533e',
        },
      },
      delivery: {
        runtimeNetwork: 'forbidden',
        dependencyInstallNetwork: 'controller_only',
      },
      acceptance: {
        publicRoute: '/optimization',
        sameOriginApi: '/api/petrinaut-opt/optimize/all',
        executionTerminal: 'promotion_prepared',
      },
      mechanicalAddresses: {
        skipTour: { kind: 'roleName', role: 'button', name: 'Skip tour' },
        dismissAssistant: { kind: 'roleName', role: 'button', name: 'Dismiss' },
        simulateMode: { kind: 'roleName', role: 'radio', name: 'Simulate' },
        optimizationsNav: { kind: 'roleValue', role: 'radio', value: 'optimizations' },
        viewTitle: { kind: 'exactText', text: 'Optimizations' },
        create: { kind: 'roleName', role: 'button', name: 'Create' },
        createDrawer: { kind: 'roleName', role: 'dialog', name: 'Create an optimization' },
        scenario: { kind: 'roleContents', role: 'combobox', contents: 'Select a scenario' },
        metric: { kind: 'roleContents', role: 'combobox', contents: 'Select a metric' },
        metricCode: { kind: 'roleName', role: 'textbox', name: 'Editor content' },
        directionMaximize: { kind: 'roleName', role: 'radio', name: 'Maximize' },
        directionMinimize: { kind: 'roleName', role: 'radio', name: 'Minimize' },
        run: { kind: 'roleName', role: 'button', name: 'Run' },
        cancel: { kind: 'roleName', role: 'button', name: 'Cancel' },
        statusComplete: { kind: 'exactText', text: 'Complete' },
        statusError: { kind: 'exactText', text: 'Error' },
        statusCancelled: { kind: 'exactText', text: 'Cancelled' },
      },
    };
    expect(parsePublicCaseContract(petrinautContract)).toEqual(petrinautContract);
    for (const mutation of [
      { case: { ...petrinautContract.case, product: 'brunch' } },
      { case: { ...petrinautContract.case, surface: 'backend' } },
      {
        case: {
          ...petrinautContract.case,
          repository: { ...petrinautContract.case.repository, parentTree: '2'.repeat(40) },
        },
      },
      { acceptance: { ...petrinautContract.acceptance, publicRoute: '/processes/draft' } },
      {
        mechanicalAddresses: {
          ...petrinautContract.mechanicalAddresses,
          create: { kind: 'roleName', role: 'button', name: 'Create optimization' },
        },
      },
      {
        mechanicalAddresses: {
          ...petrinautContract.mechanicalAddresses,
          create: { kind: 'roleName', role: 'button', name: 'Create' },
          extra: { kind: 'roleName', role: 'button', name: 'Extra' },
        },
      },
    ]) {
      expect(() => parsePublicCaseContract({ ...petrinautContract, ...mutation })).toThrow(
        'invalid fixed public execution contract',
      );
    }
  });

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
        fileURLToPath(new URL('../browser-oracle/journey-runner.ts', import.meta.url)),
        fileURLToPath(new URL('../petri-reference.ts', import.meta.url)),
      ],
    });

    expect(pack.manifest).toMatchObject({
      id: 'minimal-petri-net-editor-oracles-v2',
      publicCaseId: 'minimal-petri-net-editor-v1',
      browserSuiteVersion: 'petri-editor-browser-v2',
      referenceModelVersion: 'weighted-pt-v1',
    });
    if (!isPetriControllerOracleManifest(pack.manifest)) throw new Error('expected Petri manifest');
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
        'implementation/journey-runner.ts',
        'implementation/petri-reference.ts',
      ]),
    );
    expect(pack.files.some((file) => file.path.includes('/dist/'))).toBe(false);
    expect(pack.packSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });
});
