import { readFile } from 'node:fs/promises';

export type SliceVerificationVerdict =
  | { readonly status: 'passed' }
  | { readonly status: 'failed'; readonly failedSliceIds: readonly string[] }
  | { readonly status: 'missing'; readonly missingSliceIds: readonly string[] };

interface ReportEventCandidate {
  readonly event?: unknown;
  readonly sliceId?: unknown;
  readonly status?: unknown;
  readonly epicId?: unknown;
}

export type EpicVerificationVerdict =
  | { readonly status: 'passed' }
  | { readonly status: 'failed'; readonly failedEpicIds: readonly string[] }
  | { readonly status: 'missing'; readonly missingEpicIds: readonly string[] };

export async function readEpicVerificationVerdict(args: {
  readonly reportsPath: string;
  readonly expectedEpicIds: readonly string[];
}): Promise<EpicVerificationVerdict> {
  if (args.expectedEpicIds.length === 0) return { status: 'passed' };
  const expected = new Set(args.expectedEpicIds);
  const latest = new Map<string, 'passed' | 'failed'>();
  let content: string;
  try {
    content = await readFile(args.reportsPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { status: 'missing', missingEpicIds: args.expectedEpicIds };
    }
    throw error;
  }
  for (const rawLine of content.split('\n')) {
    try {
      const event = JSON.parse(rawLine) as ReportEventCandidate;
      if (event.event !== 'epic_test_result') continue;
      if (typeof event.epicId !== 'string' || !expected.has(event.epicId)) continue;
      if (event.status !== 'passed' && event.status !== 'failed') continue;
      latest.set(event.epicId, event.status);
    } catch {
      continue;
    }
  }
  const failedEpicIds = args.expectedEpicIds.filter((epicId) => latest.get(epicId) === 'failed');
  if (failedEpicIds.length) return { status: 'failed', failedEpicIds };
  const missingEpicIds = args.expectedEpicIds.filter((epicId) => !latest.has(epicId));
  return missingEpicIds.length ? { status: 'missing', missingEpicIds } : { status: 'passed' };
}

export async function readSliceVerificationVerdict(args: {
  readonly reportsPath: string;
  readonly expectedSliceIds: readonly string[];
}): Promise<SliceVerificationVerdict> {
  if (args.expectedSliceIds.length === 0) return { status: 'missing', missingSliceIds: [] };

  const expected = new Set(args.expectedSliceIds);
  const latest = new Map<string, 'passed' | 'failed'>();

  let content: string;
  try {
    content = await readFile(args.reportsPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { status: 'missing', missingSliceIds: args.expectedSliceIds };
    }
    throw error;
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    let event: ReportEventCandidate;
    try {
      event = JSON.parse(line) as ReportEventCandidate;
    } catch {
      continue;
    }
    if (event.event !== 'slice_test_result') continue;
    if (typeof event.sliceId !== 'string' || !expected.has(event.sliceId)) continue;
    if (event.status !== 'passed' && event.status !== 'failed') continue;
    latest.set(event.sliceId, event.status);
  }

  const failedSliceIds = args.expectedSliceIds.filter((sliceId) => latest.get(sliceId) === 'failed');
  if (failedSliceIds.length > 0) return { status: 'failed', failedSliceIds };

  const missingSliceIds = args.expectedSliceIds.filter((sliceId) => !latest.has(sliceId));
  if (missingSliceIds.length > 0) return { status: 'missing', missingSliceIds };

  return { status: 'passed' };
}
