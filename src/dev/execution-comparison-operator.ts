import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseExecutionAttempt,
  writeExecutionAttemptImmutable,
} from './execution-comparison/artifact-contract.js';
import { runPetriEditorBrowserOracle } from './execution-comparison/browser-oracle.js';
import {
  listExecutionCases,
  prepareExecutionTarget,
  resolveExecutionCase,
} from './execution-comparison/operator-cli.js';
import { loadControllerOraclePack } from './execution-comparison/oracle-pack.js';

export const EXECUTION_COMPARISON_SHARED_FRAMING = [
  'Implement the frozen specification and public contract supplied in this isolated target.',
  'Treat their bytes as immutable input: do not normalize, repair, or replace either file.',
  'Work only in the target repository and do not inspect controller paths or seek hidden comparison material.',
  'Deliver the static browser application in dist/ and run npm test followed by npm run build.',
  'Stop after those commands and report the visible result; do not add a backend or runtime network dependency.',
].join('\n');

const DEFAULT_CASES_ROOT = fileURLToPath(
  new URL('../../testing/execution-comparisons/cases/', import.meta.url),
);

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
      process.stdout.write(
        `${JSON.stringify(
          {
            directoryId: selected.directoryId,
            caseId: selected.caseId,
            caseDir: selected.caseDir,
            publicPacketSha256: selected.packet.packetSha256,
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
      assertOnlyOptions(options, ['case', 'lane', 'target']);
      const lane = required(options, 'lane');
      if (lane !== 'brunch' && lane !== 'claude_code') {
        throw new Error('--lane must be brunch or claude_code');
      }
      const prepared = await prepareExecutionTarget({
        lane,
        caseReference: required(options, 'case'),
        casesRoot,
        targetDir: resolve(required(options, 'target')),
      });
      process.stdout.write(`${JSON.stringify(prepared, null, 2)}\n`);
      return;
    }
    case 'oracle': {
      assertOnlyOptions(options, ['case', 'app', 'out']);
      const selected = await resolveExecutionCase(required(options, 'case'), casesRoot);
      const oraclePack = await loadControllerOraclePack({
        caseDir: selected.caseDir,
        implementationFiles: [
          fileURLToPath(new URL('./execution-comparison/browser-oracle.ts', import.meta.url)),
          fileURLToPath(new URL('./execution-comparison/browser-oracle/journey-runner.ts', import.meta.url)),
          fileURLToPath(new URL('./execution-comparison/petri-reference.ts', import.meta.url)),
        ],
      });
      const report = await runPetriEditorBrowserOracle({
        appDir: resolve(required(options, 'app')),
        caseDir: selected.caseDir,
      });
      const out = resolve(required(options, 'out'));
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      process.stdout.write(
        `${JSON.stringify({
          out,
          status: report.status,
          oraclePackSha256: oraclePack.packSha256,
          browserSuiteVersion: oraclePack.manifest.browserSuiteVersion,
        })}\n`,
      );
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runExecutionComparisonOperatorCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
