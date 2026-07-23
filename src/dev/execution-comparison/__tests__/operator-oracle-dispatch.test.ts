import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  EXECUTION_COMPARISON_SHARED_FRAMING,
  resolveCompiledExecutionOracle,
  retainCompiledOracleReport,
} from '../../execution-comparison-operator.js';
import { loadControllerOraclePack } from '../oracle-pack.js';

const petrinautCaseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/petrinaut-optimization/', import.meta.url),
);

describe('execution comparison compiled oracle dispatch', () => {
  it('keeps shared framing neutral across browser and backend delivery contracts', () => {
    expect(EXECUTION_COMPARISON_SHARED_FRAMING).toContain('case-specific delivery');
    expect(EXECUTION_COMPARISON_SHARED_FRAMING).not.toContain('static browser');
    expect(EXECUTION_COMPARISON_SHARED_FRAMING).not.toContain('do not add a backend');
  });

  it('selects only the four compiled implementations and rejects unknown ids before launch', () => {
    const petri = resolveCompiledExecutionOracle('minimal-petri-net-editor-oracles-v2');
    const brunch = resolveCompiledExecutionOracle('brunch-host-landing-oracles-v1');
    const petrinaut = resolveCompiledExecutionOracle('petrinaut-optimization-oracles-v1');
    const prospect = resolveCompiledExecutionOracle('prospect-research-workspace-oracles-v1');

    expect(petri.implementationFiles).toEqual(
      expect.arrayContaining([expect.stringContaining('browser-oracle.ts')]),
    );
    expect(brunch.implementationFiles).toEqual(
      expect.arrayContaining([expect.stringContaining('host-landing-oracle.ts')]),
    );
    expect(petrinaut.implementationFiles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('petrinaut-optimization-oracle.ts'),
        expect.stringContaining('petrinaut-optimization-oracle/browser.ts'),
        expect.stringContaining('petrinaut-optimization-oracle/calibration-seed.json'),
        expect.stringContaining('petrinaut-optimization-oracle/claims.ts'),
        expect.stringContaining('petrinaut-optimization-oracle/fake-optimizer.ts'),
      ]),
    );
    expect(prospect.implementationFiles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('prospect-research-workspace-oracle.ts'),
        expect.stringContaining('prospect-research-workspace-oracle/lifecycle.ts'),
        expect.stringContaining('prospect-research-workspace-oracle/reference.ts'),
        expect.stringContaining('prospect-research-workspace-oracle/sqlite-evidence.ts'),
      ]),
    );
    expect(() => resolveCompiledExecutionOracle('runtime-plugin')).toThrow(
      'unknown compiled execution oracle id',
    );
  });

  it('retains a claim-linked report beside its immutable oracle-pack hash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-oracle-dispatch-'));
    const out = join(root, 'report.json');
    const report = {
      schemaVersion: 1 as const,
      caseId: 'brunch-host-landing-v1' as const,
      oracleId: 'brunch-host-landing-oracles-v1' as const,
      status: 'assertion_failed' as const,
      scenario: 'final_commit_only' as const,
      checks: [
        {
          id: 'brownfield-full-range' as const,
          claims: ['REQ2'],
          status: 'failed' as const,
          evidence: ['missing slice content'],
        },
      ],
      terminalEvidence: [],
      gitEvidence: {
        before: snapshot(),
        preConfirm: snapshot(),
        after: snapshot(),
        expectedTree: 'a'.repeat(40),
        actualTree: 'b'.repeat(40),
        changedPaths: ['src/c.ts'],
      },
    };
    const oraclePackSha256 = `sha256:${'c'.repeat(64)}`;

    await expect(
      retainCompiledOracleReport({
        out,
        oracleId: 'brunch-host-landing-oracles-v1',
        oraclePackSha256,
        report,
      }),
    ).resolves.toEqual({
      out,
      status: 'assertion_failed',
      oraclePackSha256,
      oracleId: 'brunch-host-landing-oracles-v1',
    });
    expect(JSON.parse(await readFile(out, 'utf8'))).toEqual(report);
    await expect(
      retainCompiledOracleReport({
        out,
        oracleId: 'brunch-host-landing-oracles-v1',
        oraclePackSha256,
        report,
      }),
    ).rejects.toMatchObject({ code: 'EEXIST' });
  });

  it('changes the Petrinaut oracle-pack identity when its calibration seed changes', async () => {
    const oracle = resolveCompiledExecutionOracle('petrinaut-optimization-oracles-v1');
    const seedPath = oracle.implementationFiles.find((path) => path.endsWith('calibration-seed.json'));
    expect(seedPath).toBeDefined();
    if (seedPath === undefined) return;

    const root = await mkdtemp(join(tmpdir(), 'brunch-oracle-seed-rival-'));
    const rivalSeedPath = join(root, 'calibration-seed.json');
    await writeFile(rivalSeedPath, `${await readFile(seedPath, 'utf8')}\n`);
    const [knownPack, rivalPack] = await Promise.all([
      loadControllerOraclePack({
        caseDir: petrinautCaseDir,
        implementationFiles: oracle.implementationFiles,
      }),
      loadControllerOraclePack({
        caseDir: petrinautCaseDir,
        implementationFiles: oracle.implementationFiles.map((path) =>
          path === seedPath ? rivalSeedPath : path,
        ),
      }),
    ]);

    expect(rivalPack.packSha256).not.toBe(knownPack.packSha256);
  });
});

function snapshot() {
  return {
    head: '1'.repeat(40),
    tree: '2'.repeat(40),
    status: '',
    runMetadataSha256: '3'.repeat(64),
    runMetadataBytes: '{"status":"promotion_prepared"}\n',
  };
}
