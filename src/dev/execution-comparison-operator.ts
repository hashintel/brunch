import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseExecutionAttempt,
  writeExecutionAttemptImmutable,
} from './execution-comparison/artifact-contract.js';
import {
  runPetriEditorBrowserOracle,
  type BrowserOracleReport,
} from './execution-comparison/browser-oracle.js';
import {
  runBrunchHostLandingOracle,
  type HostLandingOracleReport,
} from './execution-comparison/host-landing-oracle.js';
import {
  listExecutionCases,
  prepareExecutionTarget,
  resolveExecutionCase,
} from './execution-comparison/operator-cli.js';
import {
  loadControllerOracleManifest,
  loadControllerOraclePack,
} from './execution-comparison/oracle-pack.js';
import {
  runPetrinautOptimizationOracle,
  type PetrinautOptimizationOracleReport,
} from './execution-comparison/petrinaut-optimization-oracle.js';

type CompiledOracleId =
  | 'minimal-petri-net-editor-oracles-v2'
  | 'brunch-host-landing-oracles-v1'
  | 'petrinaut-optimization-oracles-v1';

interface CompiledOracle {
  readonly implementationFiles: readonly string[];
  readonly run: (input: {
    readonly appDir: string;
    readonly caseDir: string;
  }) => Promise<BrowserOracleReport | HostLandingOracleReport | PetrinautOptimizationOracleReport>;
}

const COMPILED_ORACLES: Readonly<Record<CompiledOracleId, CompiledOracle>> = {
  'minimal-petri-net-editor-oracles-v2': {
    implementationFiles: [
      fileURLToPath(new URL('./execution-comparison/browser-oracle.ts', import.meta.url)),
      fileURLToPath(new URL('./execution-comparison/browser-oracle/journey-runner.ts', import.meta.url)),
      fileURLToPath(new URL('./execution-comparison/petri-reference.ts', import.meta.url)),
    ],
    run: runPetriEditorBrowserOracle,
  },
  'brunch-host-landing-oracles-v1': {
    implementationFiles: [
      fileURLToPath(new URL('./execution-comparison/host-landing-oracle.ts', import.meta.url)),
      fileURLToPath(new URL('./execution-comparison/host-landing-oracle/types.ts', import.meta.url)),
      fileURLToPath(new URL('./execution-comparison/host-landing-oracle/git-model.ts', import.meta.url)),
      fileURLToPath(new URL('./execution-comparison/host-landing-oracle/fixture.ts', import.meta.url)),
      fileURLToPath(new URL('./execution-comparison/host-landing-oracle/runner.ts', import.meta.url)),
      fileURLToPath(new URL('./tui-driver.ts', import.meta.url)),
      fileURLToPath(new URL('./tui-driver/session.ts', import.meta.url)),
      fileURLToPath(new URL('./tui-driver/screen.ts', import.meta.url)),
    ],
    run: async ({ appDir }) => await runBrunchHostLandingOracle({ candidateRoot: appDir }),
  },
  'petrinaut-optimization-oracles-v1': {
    implementationFiles: [
      fileURLToPath(new URL('./execution-comparison/petrinaut-optimization-oracle.ts', import.meta.url)),
      fileURLToPath(
        new URL('./execution-comparison/petrinaut-optimization-oracle/types.ts', import.meta.url),
      ),
      fileURLToPath(
        new URL('./execution-comparison/petrinaut-optimization-oracle/runner.ts', import.meta.url),
      ),
      fileURLToPath(
        new URL('./execution-comparison/petrinaut-optimization-oracle/browser.ts', import.meta.url),
      ),
      fileURLToPath(
        new URL(
          './execution-comparison/petrinaut-optimization-oracle/calibration-seed.json',
          import.meta.url,
        ),
      ),
      fileURLToPath(
        new URL('./execution-comparison/petrinaut-optimization-oracle/claims.ts', import.meta.url),
      ),
      fileURLToPath(
        new URL('./execution-comparison/petrinaut-optimization-oracle/fake-optimizer.ts', import.meta.url),
      ),
    ],
    run: async ({ appDir, caseDir }) =>
      await runPetrinautOptimizationOracle({ candidateRoot: appDir, caseDir }),
  },
};

export function resolveCompiledExecutionOracle(id: string): CompiledOracle {
  if (
    id !== 'minimal-petri-net-editor-oracles-v2' &&
    id !== 'brunch-host-landing-oracles-v1' &&
    id !== 'petrinaut-optimization-oracles-v1'
  ) {
    throw new Error(`unknown compiled execution oracle id: ${id}`);
  }
  return COMPILED_ORACLES[id];
}

export async function retainCompiledOracleReport(input: {
  readonly out: string;
  readonly oracleId: CompiledOracleId;
  readonly oraclePackSha256: string;
  readonly report: BrowserOracleReport | HostLandingOracleReport | PetrinautOptimizationOracleReport;
}): Promise<{
  readonly out: string;
  readonly status: 'passed' | 'failed' | 'assertion_failed' | 'setup_failed';
  readonly oraclePackSha256: string;
  readonly oracleId: CompiledOracleId;
}> {
  const out = resolve(input.out);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(input.report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return {
    out,
    status: input.report.status,
    oraclePackSha256: input.oraclePackSha256,
    oracleId: input.oracleId,
  };
}

export const EXECUTION_COMPARISON_SHARED_FRAMING = [
  'Implement the frozen specification and public contract supplied in this isolated target.',
  'Treat their bytes as immutable input: do not normalize, repair, or replace either file.',
  'Work only in the target repository and do not inspect controller paths or seek hidden comparison material.',
  'Follow the case-specific delivery, acceptance, network, and terminal rules exactly.',
  'Stop at the contract-declared execution terminal and report only target-visible results.',
].join('\n');

const DEFAULT_CASES_ROOT = fileURLToPath(
  new URL('../../testing/execution-comparisons/cases/', import.meta.url),
);
const DEFAULT_CONTROLLER_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export async function runExecutionComparisonOperatorCli(args: readonly string[]): Promise<void> {
  const [command, ...rest] = args;
  const options = parseOptions(rest);
  const casesRoot = DEFAULT_CASES_ROOT;

  switch (command) {
    case 'list-cases': {
      assertOnlyOptions(options, []);
      process.stdout.write(`${JSON.stringify(await listExecutionCases(casesRoot), null, 2)}\n`);
      return;
    }
    case 'inspect': {
      assertOnlyOptions(options, ['case']);
      const selected = await resolveExecutionCase(required(options, 'case'), casesRoot);
      const manifest = await loadControllerOracleManifest(selected.caseDir);
      const repository = selected.packet.contract.case.repository;
      process.stdout.write(
        `${JSON.stringify(
          {
            directoryId: selected.directoryId,
            caseId: selected.caseId,
            caseDir: selected.caseDir,
            publicPacketSha256: selected.packet.packetSha256,
            oracleId: manifest.id,
            repository,
            requiresSourceRepository: repository.substrate === 'pinned_git',
            files: selected.packet.files,
            sharedFraming: EXECUTION_COMPARISON_SHARED_FRAMING,
            specification: await readFile(join(selected.caseDir, 'spec.md'), 'utf8'),
            publicContract: await readFile(join(selected.caseDir, 'public-contract.json'), 'utf8'),
          },
          null,
          2,
        )}\n`,
      );
      return;
    }
    case 'prepare': {
      assertOnlyOptions(options, ['case', 'lane', 'target', 'source-repository']);
      const lane = required(options, 'lane');
      if (lane !== 'brunch' && lane !== 'claude_code') {
        throw new Error('--lane must be brunch or claude_code');
      }
      const sourceRepository = options.has('source-repository')
        ? requiredAbsolute(options, 'source-repository')
        : undefined;
      const prepared = await prepareExecutionTarget({
        lane,
        caseReference: required(options, 'case'),
        casesRoot,
        targetDir: resolve(required(options, 'target')),
        controllerRoot: DEFAULT_CONTROLLER_ROOT,
        ...(sourceRepository === undefined ? {} : { sourceRepositoryDir: sourceRepository }),
      });
      process.stdout.write(`${JSON.stringify(prepared, null, 2)}\n`);
      return;
    }
    case 'oracle': {
      assertOnlyOptions(options, ['case', 'app', 'out']);
      const out = requiredAbsolute(options, 'out');
      const selected = await resolveExecutionCase(required(options, 'case'), casesRoot);
      const manifest = await loadControllerOracleManifest(selected.caseDir);
      const oracle = resolveCompiledExecutionOracle(manifest.id);
      const oraclePack = await loadControllerOraclePack({
        caseDir: selected.caseDir,
        implementationFiles: oracle.implementationFiles,
      });
      const report = await oracle.run({
        appDir: resolve(required(options, 'app')),
        caseDir: selected.caseDir,
      });
      const retained = await retainCompiledOracleReport({
        out,
        oracleId: oraclePack.manifest.id,
        oraclePackSha256: oraclePack.packSha256,
        report,
      });
      process.stdout.write(`${JSON.stringify(retained)}\n`);
      return;
    }
    case 'retain-attempt': {
      assertOnlyOptions(options, ['attempt-file', 'attempts-root']);
      const value = JSON.parse(await readFile(resolve(required(options, 'attempt-file')), 'utf8')) as unknown;
      const attempt = parseExecutionAttempt(value);
      const attemptsRoot = resolve(required(options, 'attempts-root'));
      await mkdir(attemptsRoot, { recursive: true });
      const stored = await writeExecutionAttemptImmutable(attemptsRoot, attempt);
      process.stdout.write(`${JSON.stringify({ stored })}\n`);
      return;
    }
    default:
      throw new Error(
        'Usage: execution-comparison-operator <list-cases|inspect|prepare|oracle|retain-attempt> [options]',
      );
  }
}

function parseOptions(args: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`invalid execution comparison operator option near ${name ?? '(end)'}`);
    }
    const key = name.slice(2);
    if (options.has(key)) throw new Error(`duplicate execution comparison operator option: --${key}`);
    options.set(key, value);
  }
  return options;
}

function assertOnlyOptions(options: ReadonlyMap<string, string>, allowed: readonly string[]): void {
  for (const name of options.keys()) {
    if (!allowed.includes(name)) throw new Error(`unknown execution comparison operator option: --${name}`);
  }
}

function required(options: ReadonlyMap<string, string>, name: string): string {
  const value = options.get(name);
  if (value === undefined || value.length === 0) throw new Error(`missing required option --${name}`);
  return value;
}

function requiredAbsolute(options: ReadonlyMap<string, string>, name: string): string {
  const value = required(options, name);
  if (!isAbsolute(value)) {
    throw new Error(`--${name} must be an absolute path`);
  }
  return resolve(value);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runExecutionComparisonOperatorCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
