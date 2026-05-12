import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface FixtureCandidateFileReport {
  present: boolean;
  validJson: boolean | null;
}

export interface FixtureCandidateReport {
  ready: boolean;
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

  const summary = readJson(join(artifactDir, 'summary.json'));
  const bundle = readJson(join(artifactDir, 'artifact-bundle.json'));
  const runStatus = getRunStatus(summary);
  const normalizationDebt = collectNormalizationDebt({
    bundle,
    summary,
    hasErrors: runStatus?.kind === 'error-run',
  });

  return {
    ready:
      Object.values(files).every((file) => file.present && file.validJson !== false) && errors.length === 0,
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
