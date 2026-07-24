import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveCompiledExecutionOracle } from '../../execution-comparison-operator.js';
import {
  runProspectResearchWorkspaceOracle,
  type ProspectResearchWorkspaceOracleReport,
} from '../prospect-research-workspace-oracle.js';
import { runManagedProspectJourney } from '../prospect-research-workspace-oracle/journey-runner.js';

const caseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/prospect-research-workspace/', import.meta.url),
);
const knownGood = join(caseDir, 'controller', 'known-good');
const rivalsDir = join(caseDir, 'controller', 'rivals');
const rootNodeModules = fileURLToPath(new URL('../../../../node_modules', import.meta.url));
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (path) => await rm(path, { recursive: true, force: true })),
  );
});

describe('compiled prospect research workspace oracle', () => {
  it('passes the exact public lifecycle and every independent claim against the known-good full stack', async () => {
    const report = await runProspectResearchWorkspaceOracle({ candidateRoot: knownGood, caseDir });

    expect(report.status).toBe('passed');
    expect(report.commands.map(({ id, command, args, status }) => ({ id, command, args, status }))).toEqual([
      { id: 'test', command: 'npm', args: ['test'], status: 'passed' },
      { id: 'build', command: 'npm', args: ['run', 'build'], status: 'passed' },
    ]);
    expect(report.checks).toHaveLength(7);
    expect(report.checks.every(({ status }) => status === 'passed')).toBe(true);
    expect(report.checks.every(({ cleanup }) => cleanup.processStopped && cleanup.browserClosed)).toBe(true);
    expect(report.externalRuntimeRequests).toEqual([]);
    expect(report.checks.flatMap(({ evidence }) => evidence.map(({ source }) => source))).toEqual(
      expect.arrayContaining(['browser', 'http', 'sqlite', 'export']),
    );
  }, 120_000);

  it.each([
    ['unapproved-research', 'project-approval-and-research'],
    ['confidence-only-qualification', 'qualification-and-deduplication'],
    ['discarded-provenance', 'qualification-and-deduplication'],
    ['non-dominant-suppression', 'suppression-and-rerun'],
    ['destructive-reasonless-override', 'override-and-export'],
    ['overbroad-export', 'override-and-export'],
    ['provider-failure-laundering', 'provider-failure'],
    ['in-memory-only-state', 'restart-persistence'],
  ] as const)(
    '%s rival fails its owning claim while later claims remain assessable',
    async (rival, owner) => {
      const candidateRoot = await materializeRival(rival);
      const report = await runProspectResearchWorkspaceOracle({ candidateRoot, caseDir });

      expect(check(report, owner).status).toBe('assertion_failed');
      expect(report.checks).toHaveLength(7);
      expect(report.checks.every(({ cleanup }) => cleanup.processStopped && cleanup.browserClosed)).toBe(
        true,
      );
      const ownerIndex = report.checks.findIndex(({ id }) => id === owner);
      expect(report.checks.slice(ownerIndex + 1).every(({ status }) => status !== 'setup_failed')).toBe(true);
    },
    120_000,
  );

  it('rejects an external browser runtime request and still cleans up the process and browser', async () => {
    const candidateRoot = await materializeRival('external-runtime-request');
    const report = await runProspectResearchWorkspaceOracle({ candidateRoot, caseDir });

    expect(report.status).toBe('assertion_failed');
    expect(report.externalRuntimeRequests).toContain('https://runtime.invalid/prospect-oracle');
    expect(report.checks.every(({ cleanup }) => cleanup.processStopped && cleanup.browserClosed)).toBe(true);
  }, 120_000);

  it('registers every private helper in the closed compiled dispatch', () => {
    const oracle = resolveCompiledExecutionOracle('prospect-research-workspace-oracles-v1');
    expect(oracle.implementationFiles.map((path) => path.split('/').at(-1))).toEqual([
      'prospect-research-workspace-oracle.ts',
      'runner.ts',
      'journeys.ts',
      'journey-runner.ts',
      'lifecycle.ts',
      'reference.ts',
      'sqlite-evidence.ts',
      'types.ts',
    ]);
    expect(() => resolveCompiledExecutionOracle('prospect-runtime-plugin')).toThrow(
      'unknown compiled execution oracle id',
    );
  });

  it.each([
    ['success', async () => {}, async () => {}, 'passed'],
    [
      'setup failure',
      async () => {
        throw new Error('setup failed');
      },
      async () => {},
      'setup_failed',
    ],
    [
      'assertion failure',
      async () => {},
      async () => {
        throw new Error('assertion failed');
      },
      'assertion_failed',
    ],
    ['timeout', async () => {}, async () => await new Promise<void>(() => {}), 'assertion_failed'],
  ] as const)(
    '%s deterministically stops process and browser state',
    async (_name, setup, assertion, status) => {
      const cleanup = { processStopped: false, browserClosed: false };
      const result = await runManagedProspectJourney({
        open: async () => cleanup,
        setup,
        assert: assertion,
        close: async (context) => {
          context.processStopped = true;
          context.browserClosed = true;
        },
        timeoutMs: 5,
      });

      expect(result.status).toBe(status);
      expect(cleanup).toEqual({ processStopped: true, browserClosed: true });
      expect(result.message.length).toBeLessThan(1_000);
    },
  );
});

async function materializeRival(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `brunch-prospect-${name}-`));
  temporaryRoots.push(root);
  await cp(knownGood, root, { recursive: true });
  await symlink(rootNodeModules, join(root, 'node_modules'), 'dir');
  await writeFile(
    join(root, 'src', 'behavior.ts'),
    await readFile(join(rivalsDir, `${name}.ts`), 'utf8'),
    'utf8',
  );
  return root;
}

function check(
  report: ProspectResearchWorkspaceOracleReport,
  id: ProspectResearchWorkspaceOracleReport['checks'][number]['id'],
) {
  const selected = report.checks.find((candidate) => candidate.id === id);
  if (selected === undefined) throw new Error(`missing check ${id}`);
  return selected;
}
