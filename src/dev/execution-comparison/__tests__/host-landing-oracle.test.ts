import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  evaluateHostLandingGitOutcome,
  snapshotGitState,
  type HostLandingScenario,
} from '../host-landing-oracle.js';

const execFileAsync = promisify(execFile);
const oracleSources = [
  '../host-landing-oracle.ts',
  '../host-landing-oracle/types.ts',
  '../host-landing-oracle/git-model.ts',
  '../host-landing-oracle/fixture.ts',
  '../host-landing-oracle/runner.ts',
].map((path) => fileURLToPath(new URL(path, import.meta.url)));
const IDENTITY = ['-c', 'user.name=oracle', '-c', 'user.email=oracle@invalid.local'] as const;

describe('controller-owned host-landing oracle boundary', () => {
  it('depends only on the public candidate launch, TUI driver, Git, and controller outputs', async () => {
    const source = (await Promise.all(oracleSources.map((path) => readFile(path, 'utf8')))).join('\n');
    const imports = source
      .split('\n')
      .filter((line) => line.startsWith('import ') || line.startsWith('} from '));

    expect(imports.join('\n')).not.toMatch(
      /landing\.js|git-host-land-port|execute-land|executor\/|historical|FE-1201/iu,
    );
    expect(source).toContain("join(input.candidateRoot, 'bin', 'brunch.js')");
    expect(source).toContain("'/usr/bin/env'");
    expect(source).toContain("'PI_OFFLINE=1'");
  });

  it.each(['final_commit_only', 'bookkeeping_retained'] as const)(
    'rejects the focused %s rival against the independent expected tree',
    async (scenario) => {
      const fixture = await rivalFixture(scenario);
      const report = await evaluateHostLandingGitOutcome({
        scenario,
        hostDir: fixture.hostDir,
        metadataPath: fixture.metadataPath,
        canonicalExpectedTree: fixture.expectedTree,
        before: fixture.snapshot,
        preConfirm: fixture.snapshot,
        terminalEvidence: ['3 commits across the complete range'],
        providerActivity: false,
      });

      expect(report.status).toBe('assertion_failed');
      expect(report.checks.find(({ id }) => id === 'brownfield-full-range')?.status).toBe('failed');
    },
  );

  it.each(['decline', 'dirty_host', 'conflict', 'stale_acceptance'] as const)(
    'accepts byte-identical %s refusal evidence without a landed status',
    async (scenario) => {
      const fixture = await refusalFixture();
      const report = await evaluateHostLandingGitOutcome({
        scenario,
        hostDir: fixture.hostDir,
        metadataPath: fixture.metadataPath,
        canonicalExpectedTree: fixture.snapshot.tree,
        before: fixture.snapshot,
        preConfirm: fixture.snapshot,
        terminalEvidence: ['complete range; Nothing changed'],
        providerActivity: false,
      });

      expect(report.status).toBe('passed');
      expect(report.checks.find(({ id }) => id === 'refusal-safety')?.status).toBe('passed');
    },
  );
});

async function rivalFixture(
  scenario: Extract<HostLandingScenario, 'final_commit_only' | 'bookkeeping_retained'>,
) {
  const root = await mkdtemp(join(tmpdir(), `brunch-host-oracle-${scenario}-`));
  const model = join(root, 'model');
  await init(model);
  await commit(model, 'src/a.ts', 'a\n', 'a');
  await commit(model, 'src/b.ts', 'b\n', 'b');
  await commit(model, 'src/c.ts', 'c\n', 'c');
  const expectedTree = await git(model, ['rev-parse', 'HEAD^{tree}']);

  const hostDir = join(root, 'host');
  await init(hostDir);
  if (scenario === 'final_commit_only') {
    await commit(hostDir, 'src/c.ts', 'c\n', 'tip only');
  } else {
    await commit(hostDir, 'src/a.ts', 'a\n', 'a');
    await commit(hostDir, 'src/b.ts', 'b\n', 'b');
    await commit(hostDir, 'src/c.ts', 'c\n', 'c');
    await commit(hostDir, '.brunch/leak.json', '{}\n', 'bookkeeping');
  }
  const metadataPath = join(hostDir, '.brunch/controller-run.json');
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(metadataPath, '{"status":"landed"}\n');
  const snapshot = await snapshotGitState(hostDir, metadataPath);
  return { hostDir, metadataPath, expectedTree, snapshot };
}

async function refusalFixture() {
  const root = await mkdtemp(join(tmpdir(), 'brunch-host-oracle-refusal-'));
  const hostDir = join(root, 'host');
  await init(hostDir);
  const metadataPath = join(hostDir, '.brunch/controller-run.json');
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(metadataPath, '{"status":"promotion_prepared"}\n');
  return { hostDir, metadataPath, snapshot: await snapshotGitState(hostDir, metadataPath) };
}

async function init(cwd: string): Promise<void> {
  await mkdir(cwd);
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd });
  await execFileAsync('git', [...IDENTITY, 'commit', '--allow-empty', '-q', '-m', 'base'], { cwd });
}

async function commit(cwd: string, path: string, content: string, message: string): Promise<void> {
  await mkdir(dirname(join(cwd, path)), { recursive: true });
  await writeFile(join(cwd, path), content);
  await execFileAsync('git', ['add', '--', path], { cwd });
  await execFileAsync('git', [...IDENTITY, 'commit', '-q', '-m', message], { cwd });
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  return (await execFileAsync('git', [...args], { cwd })).stdout.trim();
}
