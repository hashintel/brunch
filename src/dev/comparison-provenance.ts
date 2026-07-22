import { execFile } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const COMPARISON_PROVENANCE_SCHEMA_VERSION = 1 as const;
export const COMPARISON_PROVENANCE_FILENAME = 'provenance.json';

export type ComparisonKind = 'elicitation' | 'execution' | 'end_to_end';

export interface ComparisonProvenance {
  readonly schemaVersion: typeof COMPARISON_PROVENANCE_SCHEMA_VERSION;
  readonly comparisonKind: ComparisonKind;
  readonly runId: string;
  readonly capturedAt: string;
  readonly rootPackage: {
    readonly name: string;
    readonly version: string;
  };
  readonly exactTag: string | null;
  readonly controller: {
    readonly commitSha: string;
    readonly commitUrl: string;
    readonly branch: string | null;
    readonly dirty: boolean;
  };
}

interface RootPackageJson {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly repository?: unknown;
}

const DEFAULT_CONTROLLER_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/u;

export async function captureComparisonProvenance(input: {
  readonly runDirectory: string;
  readonly comparisonKind: ComparisonKind;
  readonly runId: string;
  readonly controllerRoot?: string;
  readonly capturedAt?: string;
}): Promise<{ readonly provenancePath: string; readonly provenance: ComparisonProvenance }> {
  const comparisonKind = parseComparisonKind(input.comparisonKind);
  const runId = parseRunId(input.runId);
  const capturedAt = parseCapturedAt(input.capturedAt ?? new Date().toISOString());
  const controllerRoot = await resolveControllerRoot(input.controllerRoot ?? DEFAULT_CONTROLLER_ROOT);
  const rootPackage = await loadRootPackage(controllerRoot);
  const commitSha = await gitOutput(controllerRoot, ['rev-parse', 'HEAD']);
  if (!COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new Error(`controller commit must be a full 40-character SHA, received: ${commitSha}`);
  }

  const provenance: ComparisonProvenance = {
    schemaVersion: COMPARISON_PROVENANCE_SCHEMA_VERSION,
    comparisonKind,
    runId,
    capturedAt,
    rootPackage: {
      name: rootPackage.name,
      version: rootPackage.version,
    },
    exactTag: await gitOptionalOutput(controllerRoot, ['describe', '--tags', '--exact-match', 'HEAD']),
    controller: {
      commitSha,
      commitUrl: `${rootPackage.repositoryUrl}/commit/${commitSha}`,
      branch: await gitOptionalOutput(controllerRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
      dirty: (await gitOutput(controllerRoot, ['status', '--porcelain=v1', '--untracked-files=all'])) !== '',
    },
  };

  const runDirectory = resolve(input.runDirectory);
  await mkdir(runDirectory, { recursive: true });
  const provenancePath = join(runDirectory, COMPARISON_PROVENANCE_FILENAME);
  try {
    await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      throw new Error(`comparison provenance already exists: ${provenancePath}`);
    }
    throw error;
  }

  return { provenancePath, provenance };
}

export function parseComparisonProvenance(value: unknown): ComparisonProvenance {
  const record = requiredRecord(value, 'comparison provenance');
  const rootPackage = requiredRecord(record.rootPackage, 'comparison provenance rootPackage');
  const controller = requiredRecord(record.controller, 'comparison provenance controller');
  const parsed: ComparisonProvenance = {
    schemaVersion: requiredLiteral(
      record.schemaVersion,
      COMPARISON_PROVENANCE_SCHEMA_VERSION,
      'comparison provenance schemaVersion',
    ),
    comparisonKind: parseComparisonKind(record.comparisonKind),
    runId: parseRunId(record.runId),
    capturedAt: parseCapturedAt(record.capturedAt),
    rootPackage: {
      name: requiredNonEmptyString(rootPackage.name, 'comparison provenance rootPackage.name'),
      version: requiredNonEmptyString(rootPackage.version, 'comparison provenance rootPackage.version'),
    },
    exactTag:
      record.exactTag === null
        ? null
        : requiredNonEmptyString(record.exactTag, 'comparison provenance exactTag'),
    controller: {
      commitSha: requiredPattern(
        controller.commitSha,
        COMMIT_SHA_PATTERN,
        'comparison provenance controller.commitSha',
      ),
      commitUrl: requiredHttpUrl(controller.commitUrl, 'comparison provenance controller.commitUrl'),
      branch:
        controller.branch === null
          ? null
          : requiredNonEmptyString(controller.branch, 'comparison provenance controller.branch'),
      dirty: requiredBoolean(controller.dirty, 'comparison provenance controller.dirty'),
    },
  };
  const expectedCommitUrlSuffix = `/commit/${parsed.controller.commitSha}`;
  if (!parsed.controller.commitUrl.endsWith(expectedCommitUrlSuffix)) {
    throw new Error('comparison provenance controller.commitUrl must identify controller.commitSha');
  }
  return parsed;
}

export async function runComparisonProvenanceCli(args: readonly string[]): Promise<void> {
  const [command, ...rest] = args;
  if (command !== 'capture') {
    throw new Error(
      'Usage: comparison-provenance capture --run-directory <path> --comparison-kind <elicitation|execution|end_to_end> --run-id <id> [--controller-root <path>]',
    );
  }
  const options = parseOptions(rest);
  assertOnlyOptions(options, ['run-directory', 'comparison-kind', 'run-id', 'controller-root']);
  const comparisonKind = parseComparisonKind(required(options, 'comparison-kind'));
  const controllerRoot = options.get('controller-root');
  const result = await captureComparisonProvenance({
    runDirectory: required(options, 'run-directory'),
    comparisonKind,
    runId: required(options, 'run-id'),
    ...(controllerRoot === undefined ? {} : { controllerRoot }),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function resolveControllerRoot(path: string): Promise<string> {
  const root = await realpath(resolve(path));
  const gitRoot = await realpath(await gitOutput(root, ['rev-parse', '--show-toplevel']));
  if (root !== gitRoot) {
    throw new Error(`controller root must be the Git worktree root: ${root}`);
  }
  return root;
}

async function loadRootPackage(
  controllerRoot: string,
): Promise<{ readonly name: string; readonly version: string; readonly repositoryUrl: string }> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(join(controllerRoot, 'package.json'), 'utf8')) as unknown;
  } catch (error) {
    throw new Error(
      `controller root package.json is unreadable or malformed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const packageJson = requiredRecord(value, 'controller root package.json') as RootPackageJson;
  return {
    name: requiredNonEmptyString(packageJson.name, 'controller root package name'),
    version: requiredNonEmptyString(packageJson.version, 'controller root package version'),
    repositoryUrl: normalizeRepositoryUrl(packageJson.repository),
  };
}

function normalizeRepositoryUrl(repository: unknown): string {
  const raw =
    typeof repository === 'string'
      ? repository
      : isRecord(repository) && typeof repository.url === 'string'
        ? repository.url
        : undefined;
  if (raw === undefined || raw.trim() === '') {
    throw new Error('controller root package repository URL is required');
  }
  const trimmed = raw.trim().replace(/^git\+/u, '');
  const sshMatch = /^git@([^:]+):(.+)$/u.exec(trimmed);
  const normalized = sshMatch
    ? `https://${sshMatch[1]}/${sshMatch[2]}`
    : trimmed.replace(/^ssh:\/\/git@/u, 'https://');
  const withoutGitSuffix = normalized.replace(/\.git$/u, '').replace(/\/$/u, '');
  return requiredHttpUrl(withoutGitSuffix, 'controller root package repository URL');
}

async function gitOutput(cwd: string, args: readonly string[]): Promise<string> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    return result.stdout.trim();
  } catch (error) {
    throw new Error(
      `git ${args.join(' ')} failed: ${isExecError(error) ? error.stderr.trim() || error.message : String(error)}`,
    );
  }
}

async function gitOptionalOutput(cwd: string, args: readonly string[]): Promise<string | null> {
  try {
    return await gitOutput(cwd, args);
  } catch {
    return null;
  }
}

function parseComparisonKind(value: unknown): ComparisonKind {
  if (value !== 'elicitation' && value !== 'execution' && value !== 'end_to_end') {
    throw new Error('comparison kind must be elicitation, execution, or end_to_end');
  }
  return value;
}

function parseRunId(value: unknown): string {
  if (typeof value !== 'string' || !RUN_ID_PATTERN.test(value)) {
    throw new Error(
      'comparison run id must start with an alphanumeric character and contain only alphanumerics, dot, underscore, or hyphen (maximum 128 characters)',
    );
  }
  return value;
}

function parseCapturedAt(value: unknown): string {
  const capturedAt = requiredNonEmptyString(value, 'comparison provenance capturedAt');
  const date = new Date(capturedAt);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== capturedAt) {
    throw new Error('comparison provenance capturedAt must be a canonical ISO timestamp');
  }
  return capturedAt;
}

function parseOptions(args: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`invalid comparison provenance option near ${name ?? '(end)'}`);
    }
    const key = name.slice(2);
    if (options.has(key)) throw new Error(`duplicate comparison provenance option: --${key}`);
    options.set(key, value);
  }
  return options;
}

function assertOnlyOptions(options: ReadonlyMap<string, string>, allowed: readonly string[]): void {
  for (const name of options.keys()) {
    if (!allowed.includes(name)) throw new Error(`unknown comparison provenance option: --${name}`);
  }
}

function required(options: ReadonlyMap<string, string>, name: string): string {
  const value = options.get(name);
  if (value === undefined || value.length === 0) throw new Error(`missing required option --${name}`);
  return value;
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requiredNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requiredPattern(value: unknown, pattern: RegExp, label: string): string {
  const text = requiredNonEmptyString(value, label);
  if (!pattern.test(text)) throw new Error(`${label} has an invalid format`);
  return text;
}

function requiredHttpUrl(value: unknown, label: string): string {
  const text = requiredNonEmptyString(value, label);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label} must use http or https`);
  }
  return url.toString().replace(/\/$/u, '');
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function requiredLiteral<const Value extends number>(value: unknown, expected: Value, label: string): Value {
  if (value !== expected) throw new Error(`${label} must be ${expected}`);
  return expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isExecError(
  error: unknown,
): error is Error & { readonly stderr: string; readonly stdout: string; readonly code: number } {
  return (
    error instanceof Error &&
    'stderr' in error &&
    typeof error.stderr === 'string' &&
    'stdout' in error &&
    typeof error.stdout === 'string'
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runComparisonProvenanceCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
