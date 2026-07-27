import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface FixtureCandidateFileReport {
  present: boolean;
  validJson: boolean | null;
}

export interface FixtureCandidateReport {
  parseReady: boolean;
  structureReady: boolean;
  files: Record<string, FixtureCandidateFileReport>;
  workspaceState: { expected: boolean; present: boolean; path: string };
  runStatus: { kind: 'completed' | 'error-run'; turnsAnswered: number; errorCount: number } | null;
  normalizationDebt: string[];
  errors: string[];
}

export function inspectFixtureCandidate(
  artifactDir: string,
  { expectWorkspaceState = false }: { expectWorkspaceState?: boolean } = {},
): FixtureCandidateReport {
  const errors: string[] = [];
  const files = {
    'artifact-bundle.json': inspectJsonFile(join(artifactDir, 'artifact-bundle.json'), errors),
    'summary.json': inspectJsonFile(join(artifactDir, 'summary.json'), errors),
    'raw-jsonl.ndjson': inspectNdjsonFile(join(artifactDir, 'raw-jsonl.ndjson'), errors),
    'final-chat.json': inspectJsonFile(join(artifactDir, 'final-chat.json'), errors),
  };
  const workspaceStatePath = join(artifactDir, 'workspace-state');
  const workspaceState = {
    expected: expectWorkspaceState,
    present: existsSync(workspaceStatePath),
    path: workspaceStatePath,
  };
  if (expectWorkspaceState && !workspaceState.present) {
    errors.push('workspace-state is missing');
  }

  const parseReady = Object.values(files).every((file) => file.present && file.validJson !== false);
  const summary = readJson(join(artifactDir, 'summary.json'));
  const bundle = readJson(join(artifactDir, 'artifact-bundle.json'));
  const finalChat = readJson(join(artifactDir, 'final-chat.json'));
  const rawJsonlTranscript = readNdjson(join(artifactDir, 'raw-jsonl.ndjson'));
  validateCandidateStructure({ bundle, summary, finalChat, rawJsonlTranscript, errors });
  const runStatus = getRunStatus(summary);
  const normalizationDebt = collectNormalizationDebt({
    bundle,
    summary,
    hasErrors: runStatus?.kind === 'error-run',
  });

  return {
    parseReady,
    structureReady: parseReady && errors.length === 0,
    files,
    workspaceState,
    runStatus,
    normalizationDebt,
    errors,
  };
}

function inspectJsonFile(path: string, errors: string[]): FixtureCandidateFileReport {
  if (!existsSync(path)) {
    errors.push(`${fileName(path)} is missing`);
    return { present: false, validJson: null };
  }

  try {
    JSON.parse(readFileSync(path, 'utf8'));
    return { present: true, validJson: true };
  } catch {
    errors.push(`${fileName(path)} is not valid JSON`);
    return { present: true, validJson: false };
  }
}

function inspectNdjsonFile(path: string, errors: string[]): FixtureCandidateFileReport {
  if (!existsSync(path)) {
    errors.push(`${fileName(path)} is missing`);
    return { present: false, validJson: null };
  }

  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '');
  try {
    for (const line of lines) {
      JSON.parse(line);
    }
    return { present: true, validJson: true };
  } catch {
    errors.push(`${fileName(path)} contains invalid NDJSON`);
    return { present: true, validJson: false };
  }
}

function readJson(path: string): unknown {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readNdjson(path: string): unknown[] | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as unknown);
  } catch {
    return null;
  }
}

function validateCandidateStructure({
  bundle,
  summary,
  finalChat,
  rawJsonlTranscript,
  errors,
}: {
  bundle: unknown;
  summary: unknown;
  finalChat: unknown;
  rawJsonlTranscript: unknown[] | null;
  errors: string[];
}): void {
  validateSummaryStructure(summary, errors);
  validateBundleStructure(bundle, errors);

  if (isRecord(bundle)) {
    if (!deepEqual(bundle.summary, summary)) {
      errors.push('artifact-bundle.summary does not match summary.json');
    }
    if (!deepEqual(bundle.finalChat, finalChat)) {
      errors.push('artifact-bundle.finalChat does not match final-chat.json');
    }
    if (!Array.isArray(rawJsonlTranscript) || !deepEqual(bundle.rawJsonlTranscript, rawJsonlTranscript)) {
      errors.push('artifact-bundle.rawJsonlTranscript does not match raw-jsonl.ndjson');
    }
  }
}

function validateSummaryStructure(summary: unknown, errors: string[]): void {
  if (!isRecord(summary)) {
    errors.push('summary.json is not an object');
    return;
  }

  requireField(summary, 'turnsAnswered', 'number', 'summary.json', errors);
  if (typeof summary.finalFrontierState !== 'string' && summary.finalFrontierState !== null) {
    errors.push('summary.json finalFrontierState must be a string or null');
  }
  requireField(summary, 'durationMs', 'number', 'summary.json', errors);
  requireArrayField(summary, 'questionAnswers', 'summary.json', errors);
  requireArrayField(summary, 'errors', 'summary.json', errors);
}

function validateBundleStructure(bundle: unknown, errors: string[]): void {
  if (!isRecord(bundle)) {
    errors.push('artifact-bundle.json is not an object');
    return;
  }

  if (bundle.schemaVersion !== 1) {
    errors.push('artifact-bundle.json schemaVersion must be 1');
  }
  requireRecordField(bundle, 'scenario', 'artifact-bundle.json', errors);
  requireRecordField(bundle, 'workspace', 'artifact-bundle.json', errors);
  requireArrayField(bundle, 'commandSequence', 'artifact-bundle.json', errors);
  requireArrayField(bundle, 'rawJsonlTranscript', 'artifact-bundle.json', errors);
  requireArrayField(bundle, 'parsedEvents', 'artifact-bundle.json', errors);
  if (!('finalChat' in bundle)) {
    errors.push('artifact-bundle.json finalChat is missing');
  }
  requireRecordField(bundle, 'summary', 'artifact-bundle.json', errors);
  requireArrayField(bundle, 'errors', 'artifact-bundle.json', errors);
  requireArrayField(bundle, 'simulatedUserEvents', 'artifact-bundle.json', errors);
  requireRecordField(bundle, 'environment', 'artifact-bundle.json', errors);
}

function requireField(
  record: Record<string, unknown>,
  field: string,
  type: 'number' | 'string',
  label: string,
  errors: string[],
): void {
  if (typeof record[field] !== type) {
    errors.push(`${label} ${field} must be a ${type}`);
  }
}

function requireArrayField(
  record: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[],
): void {
  if (!Array.isArray(record[field])) {
    errors.push(`${label} ${field} must be an array`);
  }
}

function requireRecordField(
  record: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[],
): void {
  if (!isRecord(record[field])) {
    errors.push(`${label} ${field} must be an object`);
  }
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getRunStatus(summary: unknown): FixtureCandidateReport['runStatus'] {
  if (!isRecord(summary)) {
    return null;
  }
  const turnsAnswered = typeof summary.turnsAnswered === 'number' ? summary.turnsAnswered : 0;
  const errors = Array.isArray(summary.errors) ? summary.errors : [];
  return {
    kind: errors.length > 0 ? 'error-run' : 'completed',
    turnsAnswered,
    errorCount: errors.length,
  };
}

function collectNormalizationDebt({
  bundle,
  summary,
  hasErrors,
}: {
  bundle: unknown;
  summary: unknown;
  hasErrors: boolean;
}): string[] {
  const debt = new Set<string>();

  if (isRecord(summary) && typeof summary.durationMs === 'number') {
    debt.add('summary.durationMs');
  }

  if (isRecord(bundle)) {
    const environment = isRecord(bundle.environment) ? bundle.environment : null;
    if (environment) {
      if (typeof environment.nodeVersion === 'string') debt.add('artifact-bundle.environment.nodeVersion');
      if (typeof environment.platform === 'string') debt.add('artifact-bundle.environment.platform');
      if (typeof environment.arch === 'string') debt.add('artifact-bundle.environment.arch');
    }

    const workspace = isRecord(bundle.workspace) ? bundle.workspace : null;
    if (workspace) {
      if (typeof workspace.cwd === 'string') debt.add('artifact-bundle.workspace.cwd');
      if (typeof workspace.preservedStatePath === 'string') {
        debt.add('artifact-bundle.workspace.preservedStatePath');
      }
    }

    const bundleSummary = isRecord(bundle.summary) ? bundle.summary : null;
    if (bundleSummary && typeof bundleSummary.durationMs === 'number') {
      debt.add('artifact-bundle.summary.durationMs');
    }

    if (Array.isArray(bundle.rawJsonlTranscript) && bundle.rawJsonlTranscript.length > 0) {
      debt.add('raw-jsonl request/response ids and resource ids');
    }
  }

  debt.add('final-chat generated question wording');
  if (hasErrors) {
    debt.add('error messages may need provider-specific redaction review');
  }

  return [...debt];
}

function fileName(path: string): string {
  return path.split('/').at(-1) ?? path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
