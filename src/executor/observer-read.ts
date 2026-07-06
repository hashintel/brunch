import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { readRunMetadata, runDirPath, runMetadataPath, type RunMetadata } from './run.js';

export interface RunPresence {
  readonly worktree: boolean;
  readonly reports: boolean;
  readonly petri: boolean;
  readonly promotion: boolean;
}

export interface RunSummary {
  readonly runId: string;
  readonly specId: string;
  readonly status: RunMetadata['status'];
  readonly activeSliceId?: string;
  readonly completedSliceIds?: readonly string[];
  readonly presence: RunPresence;
}

export interface UnreadableRun {
  readonly runId: string;
  readonly unreadable: true;
}

export type RunListEntry = RunSummary | UnreadableRun;

export interface RunReportEvent {
  readonly event: string;
  readonly [key: string]: unknown;
}

export interface RunDetail extends RunSummary {
  readonly planPath: string;
  readonly reportsTail: readonly RunReportEvent[];
  readonly reportsTotal: number;
  /** Raw parsed petrinaut/net.json — deliberately unshaped (frontier: raw view only). */
  readonly petriNet?: unknown;
}

export const DEFAULT_REPORTS_TAIL_LIMIT = 50;

function runsRootPath(cwd: string): string {
  return join(cwd, BRUNCH_DIR, 'cook', 'runs');
}

export async function listRuns(cwd: string): Promise<readonly RunListEntry[]> {
  let entries;
  try {
    entries = await readdir(runsRootPath(cwd), { withFileTypes: true });
  } catch {
    return [];
  }
  const runIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    runIds.map(async (runId) => {
      const metadata = await readRunMetadata(runMetadataPath(cwd, runId));
      if (metadata === undefined) {
        return { runId, unreadable: true as const };
      }
      return summarizeRun(cwd, runId, metadata);
    }),
  );
}

export async function readRunDetail(
  cwd: string,
  runId: string,
  options?: { readonly reportsTailLimit?: number },
): Promise<RunDetail | UnreadableRun | undefined> {
  const runDir = runDirPath(cwd, runId);
  if (!(await pathExists(runDir))) {
    return undefined;
  }
  const metadata = await readRunMetadata(runMetadataPath(cwd, runId));
  if (metadata === undefined) {
    return { runId, unreadable: true };
  }
  const summary = await summarizeRun(cwd, runId, metadata);
  const limit = options?.reportsTailLimit ?? DEFAULT_REPORTS_TAIL_LIMIT;
  const reports = await readReportsTail(reportsFilePath(cwd, runId, metadata), limit);
  const petriNet = await readPetriNet(petriFilePath(cwd, runId, metadata));
  return {
    ...summary,
    planPath: metadata.planPath,
    reportsTail: reports.tail,
    reportsTotal: reports.total,
    ...(petriNet === undefined ? {} : { petriNet }),
  };
}

async function summarizeRun(cwd: string, runId: string, metadata: RunMetadata): Promise<RunSummary> {
  const runDir = runDirPath(cwd, runId);
  const [worktree, reports, petri, promotion] = await Promise.all([
    pathExists(metadata.worktreeDir ?? join(runDir, 'worktree')),
    pathExists(reportsFilePath(cwd, runId, metadata)),
    pathExists(petriFilePath(cwd, runId, metadata)),
    pathExists(metadata.promotionPath ?? join(runDir, 'promotion', 'promotion.json')),
  ]);
  return {
    runId,
    specId: metadata.specId,
    status: metadata.status,
    ...(metadata.activeSliceId === undefined ? {} : { activeSliceId: metadata.activeSliceId }),
    ...(metadata.completedSliceIds === undefined ? {} : { completedSliceIds: metadata.completedSliceIds }),
    presence: { worktree, reports, petri, promotion },
  };
}

function reportsFilePath(cwd: string, runId: string, metadata: RunMetadata): string {
  return metadata.reportsPath ?? join(runDirPath(cwd, runId), 'reports.jsonl');
}

function petriFilePath(cwd: string, runId: string, metadata: RunMetadata): string {
  return metadata.petriPath ?? join(runDirPath(cwd, runId), 'petrinaut', 'net.json');
}

async function readPetriNet(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

async function readReportsTail(
  path: string,
  limit: number,
): Promise<{ tail: readonly RunReportEvent[]; total: number }> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return { tail: [], total: 0 };
  }
  // Every complete event line ends with the newline written in the same append;
  // a non-empty final segment is an in-flight partial append and is skipped.
  // ceiling: whole-file read per call; stream from the tail if reports.jsonl grows past a few MB.
  const events: RunReportEvent[] = [];
  for (const line of raw.split('\n').slice(0, -1)) {
    if (line.length === 0) {
      continue;
    }
    try {
      events.push(JSON.parse(line) as RunReportEvent);
    } catch {
      // A torn or corrupt line never blocks the readable remainder of the log.
    }
  }
  return { tail: events.slice(-limit), total: events.length };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
