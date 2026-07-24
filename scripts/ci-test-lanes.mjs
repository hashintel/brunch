import { execFile } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const NON_RUNTIME_DIRECTORIES = ['.agents/', '.changeset/', '.claude/', '.codex/', 'docs/', 'memory/'];
const NON_RUNTIME_ROOT_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'README.md',
  'TESTING_FINDINGS.md',
  'TESTING_PLAN.md',
]);

export function isClosedNonRuntimePath(path) {
  return (
    NON_RUNTIME_ROOT_FILES.has(path) ||
    NON_RUNTIME_DIRECTORIES.some((directory) => path.startsWith(directory))
  );
}

export function selectCiTestLanes({ eventName, diffComplete, changedPaths }) {
  if (eventName === 'merge_group') {
    return { comparison: true, reason: 'merge-group-full-gate' };
  }
  if (eventName !== 'pull_request') {
    return { comparison: true, reason: 'unknown-event' };
  }
  if (!diffComplete || changedPaths.length === 0) {
    return { comparison: true, reason: 'incomplete-or-empty-diff' };
  }
  if (changedPaths.every(isClosedNonRuntimePath)) {
    return { comparison: false, reason: 'closed-non-runtime-diff' };
  }
  return { comparison: true, reason: 'runtime-or-unknown-path' };
}

export async function changedPathsFromGit({ baseSha, headSha, cwd = process.cwd() }) {
  if (!baseSha || !headSha) return { complete: false, paths: [] };
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--name-only', '-z', '--no-renames', `${baseSha}...${headSha}`],
      {
        cwd,
        encoding: 'buffer',
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    return {
      complete: true,
      paths: stdout
        .toString('utf8')
        .split('\0')
        .filter((path) => path.length > 0),
    };
  } catch {
    return { complete: false, paths: [] };
  }
}

async function writeOutputs(result) {
  const lines = [`comparison=${String(result.comparison)}`, `reason=${result.reason}`];
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`, 'utf8');
  } else {
    process.stdout.write(`${lines.join('\n')}\n`);
  }
}

async function main() {
  const eventName = process.env.EVENT_NAME ?? '';
  const diff =
    eventName === 'pull_request'
      ? await changedPathsFromGit({
          baseSha: process.env.BASE_SHA ?? '',
          headSha: process.env.HEAD_SHA ?? '',
        })
      : { complete: true, paths: [] };
  const result = selectCiTestLanes({
    eventName,
    diffComplete: diff.complete,
    changedPaths: diff.paths,
  });
  await writeOutputs(result);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
