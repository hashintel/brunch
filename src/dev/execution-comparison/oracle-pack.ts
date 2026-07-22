import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';

export interface PetriControllerOracleManifest {
  readonly schemaVersion: 1;
  readonly id: 'minimal-petri-net-editor-oracles-v2';
  readonly publicCaseId: 'minimal-petri-net-editor-v1';
  readonly browserSuiteVersion: 'petri-editor-browser-v2';
  readonly referenceModelVersion: 'weighted-pt-v1';
  readonly journeys: readonly {
    readonly id: string;
    readonly claims: readonly string[];
    readonly [key: string]: unknown;
  }[];
  readonly validityRules: readonly string[];
  readonly replacementRule: string;
  readonly catastrophicVisualGate: readonly string[];
}

export interface BrunchHostLandingControllerOracleManifest {
  readonly schemaVersion: 1;
  readonly id: 'brunch-host-landing-oracles-v1';
  readonly publicCaseId: 'brunch-host-landing-v1';
  readonly runnerVersion: 'brunch-host-landing-v1';
  readonly referenceModelVersion: 'git-full-range-v1';
  readonly checks: readonly {
    readonly id: string;
    readonly claims: readonly string[];
  }[];
  readonly validityRules: readonly string[];
  readonly replacementRule: string;
}

export interface PetrinautOptimizationControllerOracleManifest {
  readonly schemaVersion: 1;
  readonly id: 'petrinaut-optimization-oracles-v1';
  readonly publicCaseId: 'petrinaut-optimization-v1';
  readonly runnerVersion: 'petrinaut-optimization-browser-v1';
  readonly fixtureVersion: 'deterministic-optimizer-v1';
  readonly checks: readonly {
    readonly id:
      | 'route-and-accessibility'
      | 'scenario-configuration'
      | 'request-contract'
      | 'progress-and-completion'
      | 'service-error'
      | 'cancel-and-abort'
      | 'private-origin-secrecy';
    readonly claims: readonly string[];
  }[];
  readonly validityRules: readonly string[];
  readonly replacementRule: string;
}

export type ControllerOracleManifest =
  | PetriControllerOracleManifest
  | BrunchHostLandingControllerOracleManifest
  | PetrinautOptimizationControllerOracleManifest;

export function isPetriControllerOracleManifest(
  value: ControllerOracleManifest,
): value is PetriControllerOracleManifest {
  return value.id === 'minimal-petri-net-editor-oracles-v2';
}

export function isPetrinautOptimizationControllerOracleManifest(
  value: ControllerOracleManifest,
): value is PetrinautOptimizationControllerOracleManifest {
  return value.id === 'petrinaut-optimization-oracles-v1';
}

export interface ControllerOraclePack {
  readonly manifest: ControllerOracleManifest;
  readonly files: readonly {
    readonly path: string;
    readonly sha256: string;
  }[];
  readonly packSha256: string;
}

const REQUIRED_JOURNEYS = [
  'mount',
  'node-lifecycle',
  'weighted-fire-reset-reload',
  'invalid-and-cascade',
  'round-trip-and-clear',
] as const;
const IGNORED_GENERATED_DIRECTORIES = new Set(['dist', 'node_modules', '.git']);

export async function loadControllerOraclePack(input: {
  readonly caseDir: string;
  readonly implementationFiles: readonly string[];
}): Promise<ControllerOraclePack> {
  const controllerDir = join(input.caseDir, 'controller');
  const controllerFiles = await listFiles(controllerDir);
  const files: { path: string; sha256: string }[] = [];
  for (const file of controllerFiles) {
    files.push({
      path: `controller/${slash(relative(controllerDir, file))}`,
      sha256: `sha256:${hash(await readFile(file))}`,
    });
  }
  for (const file of input.implementationFiles) {
    files.push({
      path: `implementation/${basename(file)}`,
      sha256: `sha256:${hash(await readFile(file))}`,
    });
  }
  files.sort((left, right) => codePointCompare(left.path, right.path));
  if (new Set(files.map((file) => file.path)).size !== files.length) {
    throw new Error('controller oracle pack contains duplicate file paths');
  }

  const manifest = await loadControllerOracleManifest(input.caseDir);
  const packSha256 = `sha256:${hash(files.map((file) => `${file.path}:${file.sha256}\n`).join(''))}`;
  return { manifest, files, packSha256 };
}

export async function loadControllerOracleManifest(caseDir: string): Promise<ControllerOracleManifest> {
  const manifestRaw = await readFile(join(caseDir, 'controller', 'oracle-manifest.json'), 'utf8');
  return parseControllerOracleManifest(parseJson(manifestRaw));
}

export function parseControllerOracleManifest(value: unknown): ControllerOracleManifest {
  if (!record(value)) invalid();
  if (value['id'] === 'brunch-host-landing-oracles-v1') {
    return parseBrunchHostLandingManifest(value);
  }
  if (value['id'] === 'petrinaut-optimization-oracles-v1') {
    return parsePetrinautOptimizationManifest(value);
  }
  return parsePetriManifest(value);
}

export function oracleManifestClaimIds(manifest: ControllerOracleManifest): readonly string[] {
  const entries = manifest.id === 'minimal-petri-net-editor-oracles-v2' ? manifest.journeys : manifest.checks;
  return [...new Set(entries.flatMap(({ claims }) => claims))].sort(codePointCompare);
}

export function assertOracleClaimCoverage(
  manifest: ControllerOracleManifest,
  requirementClaimIds: readonly string[],
): void {
  const assigned = oracleManifestClaimIds(manifest);
  const required = [...new Set(requirementClaimIds)].sort(codePointCompare);
  if (assigned.length !== required.length || assigned.some((claim, index) => claim !== required[index])) {
    throw new Error('controller oracle manifest does not assign every requirement claim exactly');
  }
}

function parsePetriManifest(value: Record<string, unknown>): PetriControllerOracleManifest {
  const journeys = value['journeys'];
  if (
    value['schemaVersion'] !== 1 ||
    value['id'] !== 'minimal-petri-net-editor-oracles-v2' ||
    value['publicCaseId'] !== 'minimal-petri-net-editor-v1' ||
    value['browserSuiteVersion'] !== 'petri-editor-browser-v2' ||
    value['referenceModelVersion'] !== 'weighted-pt-v1' ||
    !Array.isArray(journeys) ||
    journeys.length !== REQUIRED_JOURNEYS.length ||
    !journeys.every(
      (journey, index) =>
        record(journey) && journey['id'] === REQUIRED_JOURNEYS[index] && nonemptyStrings(journey['claims']),
    ) ||
    !nonemptyStrings(value['validityRules']) ||
    !value['validityRules'].some(
      (rule) => typeof rule === 'string' && rule.includes('promotion_prepared') && rule.includes('landed'),
    ) ||
    !nonempty(value['replacementRule']) ||
    !nonemptyStrings(value['catastrophicVisualGate'])
  ) {
    invalid();
  }
  return value as unknown as PetriControllerOracleManifest;
}

function parseBrunchHostLandingManifest(
  value: Record<string, unknown>,
): BrunchHostLandingControllerOracleManifest {
  const checks = value['checks'];
  if (
    !exactKeys(value, [
      'schemaVersion',
      'id',
      'publicCaseId',
      'runnerVersion',
      'referenceModelVersion',
      'checks',
      'validityRules',
      'replacementRule',
    ]) ||
    value['schemaVersion'] !== 1 ||
    value['id'] !== 'brunch-host-landing-oracles-v1' ||
    value['publicCaseId'] !== 'brunch-host-landing-v1' ||
    value['runnerVersion'] !== 'brunch-host-landing-v1' ||
    value['referenceModelVersion'] !== 'git-full-range-v1' ||
    !Array.isArray(checks) ||
    checks.length === 0 ||
    !checks.every(
      (check) =>
        record(check) &&
        exactKeys(check, ['id', 'claims']) &&
        nonempty(check['id']) &&
        nonemptyStrings(check['claims']),
    ) ||
    new Set(checks.map((check) => (check as { id: string }).id)).size !== checks.length ||
    !nonemptyStrings(value['validityRules']) ||
    !(value['validityRules'] as string[]).join('\n').includes('promotion_prepared') ||
    !(value['validityRules'] as string[]).join('\n').includes('landed') ||
    !nonempty(value['replacementRule'])
  ) {
    invalid();
  }
  return value as unknown as BrunchHostLandingControllerOracleManifest;
}

const PETRINAUT_OPTIMIZATION_CHECKS = [
  'route-and-accessibility',
  'scenario-configuration',
  'request-contract',
  'progress-and-completion',
  'service-error',
  'cancel-and-abort',
  'private-origin-secrecy',
] as const;

function parsePetrinautOptimizationManifest(
  value: Record<string, unknown>,
): PetrinautOptimizationControllerOracleManifest {
  const checks = value['checks'];
  if (
    !exactKeys(value, [
      'schemaVersion',
      'id',
      'publicCaseId',
      'runnerVersion',
      'fixtureVersion',
      'checks',
      'validityRules',
      'replacementRule',
    ]) ||
    value['schemaVersion'] !== 1 ||
    value['id'] !== 'petrinaut-optimization-oracles-v1' ||
    value['publicCaseId'] !== 'petrinaut-optimization-v1' ||
    value['runnerVersion'] !== 'petrinaut-optimization-browser-v1' ||
    value['fixtureVersion'] !== 'deterministic-optimizer-v1' ||
    !Array.isArray(checks) ||
    checks.length !== PETRINAUT_OPTIMIZATION_CHECKS.length ||
    !checks.every(
      (check, index) =>
        record(check) &&
        exactKeys(check, ['id', 'claims']) &&
        check['id'] === PETRINAUT_OPTIMIZATION_CHECKS[index] &&
        nonemptyStrings(check['claims']),
    ) ||
    !nonemptyStrings(value['validityRules']) ||
    !petrinautValidityRules(value['validityRules'] as string[]) ||
    !nonempty(value['replacementRule'])
  ) {
    invalid();
  }
  return value as unknown as PetrinautOptimizationControllerOracleManifest;
}

function petrinautValidityRules(rules: readonly string[]): boolean {
  const joined = rules.join('\n');
  return (
    joined.includes('Before candidate execution') &&
    joined.includes('compiled immutable dependency preparation') &&
    joined.includes('package-registry network') &&
    joined.includes('network-denied candidate execution lane') &&
    joined.includes('promotion_prepared') &&
    joined.includes('After lane termination') &&
    joined.includes('compiled focused build preparation') &&
    joined.includes('/optimization')
  );
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => codePointCompare(left.name, right.name))) {
    if (IGNORED_GENERATED_DIRECTORIES.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`controller oracle pack may not contain symlinks: ${path}`);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid controller oracle manifest JSON');
  }
}

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function slash(path: string): string {
  return sep === '/' ? path : path.split(sep).join('/');
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function nonemptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonempty);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort(codePointCompare);
  const wanted = [...expected].sort(codePointCompare);
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function invalid(): never {
  throw new Error('invalid fixed controller oracle manifest');
}
