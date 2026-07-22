import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveCompiledExecutionOracle } from '../../execution-comparison-operator.js';
import {
  assertOracleClaimCoverage,
  loadControllerOracleManifest,
  loadControllerOraclePack,
  parseControllerOracleManifest,
} from '../oracle-pack.js';

const casesRoot = fileURLToPath(new URL('../../../../testing/execution-comparisons/cases/', import.meta.url));
const requirementsPath = fileURLToPath(
  new URL(
    '../../../../testing/end-to-end-comparisons/cases/brunch-host-landing/controller/requirement-registry.json',
    import.meta.url,
  ),
);
const petrinautRequirementsPath = fileURLToPath(
  new URL(
    '../../../../testing/end-to-end-comparisons/cases/petrinaut-optimization/controller/requirement-registry.json',
    import.meta.url,
  ),
);
const prospectRequirementsPath = fileURLToPath(
  new URL(
    '../../../../testing/end-to-end-comparisons/cases/prospect-research-workspace/controller/requirement-registry.json',
    import.meta.url,
  ),
);

describe('compiled controller oracle manifests', () => {
  it('accepts exactly four compiled variants with complete non-Petri claim coverage', async () => {
    const [petri, prospect, brunch, petrinaut, registry, petrinautRegistry, prospectRegistry] =
      await Promise.all([
        loadControllerOracleManifest(join(casesRoot, 'minimal-petri-net-editor')),
        loadControllerOracleManifest(join(casesRoot, 'prospect-research-workspace')),
        loadControllerOracleManifest(join(casesRoot, 'brunch-host-landing')),
        loadControllerOracleManifest(join(casesRoot, 'petrinaut-optimization')),
        readFile(requirementsPath, 'utf8').then(
          (raw) => JSON.parse(raw) as { rows: readonly { id: string }[] },
        ),
        readFile(petrinautRequirementsPath, 'utf8').then(
          (raw) => JSON.parse(raw) as { rows: readonly { id: string }[] },
        ),
        readFile(prospectRequirementsPath, 'utf8').then(
          (raw) => JSON.parse(raw) as { rows: readonly { id: string }[] },
        ),
      ]);

    expect(petri.id).toBe('minimal-petri-net-editor-oracles-v2');
    expect(prospect.id).toBe('prospect-research-workspace-oracles-v1');
    expect(brunch.id).toBe('brunch-host-landing-oracles-v1');
    expect(petrinaut.id).toBe('petrinaut-optimization-oracles-v1');
    expect(() =>
      assertOracleClaimCoverage(
        prospect,
        prospectRegistry.rows.map(({ id }) => id),
      ),
    ).not.toThrow();
    expect(() =>
      assertOracleClaimCoverage(
        brunch,
        registry.rows.map(({ id }) => id),
      ),
    ).not.toThrow();
    expect(() =>
      assertOracleClaimCoverage(
        petrinaut,
        petrinautRegistry.rows.map(({ id }) => id),
      ),
    ).not.toThrow();
    expect(JSON.stringify(brunch)).not.toMatch(/manifestPath|command|plugin|implementationPath/u);
    expect(JSON.stringify(petrinaut)).not.toMatch(/manifestPath|command|plugin|implementationPath/u);
    expect(JSON.stringify(prospect)).not.toMatch(/manifestPath|command|plugin|implementationPath/u);
    const prospectPack = await loadControllerOraclePack({
      caseDir: join(casesRoot, 'prospect-research-workspace'),
      implementationFiles: resolveCompiledExecutionOracle('prospect-research-workspace-oracles-v1')
        .implementationFiles,
    });
    expect(prospectPack.files.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'controller/fixtures/provider-failure.json',
        'controller/fixtures/research-batch.json',
        'controller/known-good/src/client.tsx',
        'controller/known-good/src/server.ts',
        'controller/oracle-manifest.json',
        'controller/rivals/confidence-only-qualification.ts',
        'controller/rivals/destructive-reasonless-override.ts',
        'controller/rivals/discarded-provenance.ts',
        'controller/rivals/external-runtime-request.ts',
        'controller/rivals/in-memory-only-state.ts',
        'controller/rivals/non-dominant-suppression.ts',
        'controller/rivals/overbroad-export.ts',
        'controller/rivals/provider-failure-laundering.ts',
        'controller/rivals/unapproved-research.ts',
        'implementation/journeys.ts',
        'implementation/journey-runner.ts',
        'implementation/lifecycle.ts',
        'implementation/prospect-research-workspace-oracle.ts',
        'implementation/reference.ts',
        'implementation/runner.ts',
        'implementation/sqlite-evidence.ts',
        'implementation/types.ts',
      ]),
    );
    expect(prospectPack.packSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(() =>
      parseControllerOracleManifest({
        ...petrinaut,
        validityRules: [
          'The candidate execution lane terminates at promotion_prepared before controller dependency preparation.',
          'The browser opens /optimization after preparation.',
        ],
      }),
    ).toThrow('invalid fixed controller oracle manifest');
  });

  it('rejects unknown ids and runtime implementation selectors', () => {
    expect(() =>
      parseControllerOracleManifest({
        schemaVersion: 1,
        id: 'unknown-oracle',
      }),
    ).toThrow('invalid fixed controller oracle manifest');
    expect(() =>
      parseControllerOracleManifest({
        schemaVersion: 1,
        id: 'brunch-host-landing-oracles-v1',
        publicCaseId: 'brunch-host-landing-v1',
        runnerVersion: 'brunch-host-landing-v1',
        referenceModelVersion: 'git-full-range-v1',
        checks: [{ id: 'x', claims: ['REQ1'] }],
        validityRules: ['promotion_prepared then controller landed'],
        replacementRule: 'retain',
        plugin: './oracle.js',
      }),
    ).toThrow('invalid fixed controller oracle manifest');
  });
});
