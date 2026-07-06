import { readFile } from 'node:fs/promises';

export type SliceVerificationVerdict =
  | { readonly status: 'passed' }
  | { readonly status: 'failed'; readonly failedSliceIds: readonly string[] }
  | { readonly status: 'missing'; readonly missingSliceIds: readonly string[] };

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
    const event = JSON.parse(line) as {
      readonly event?: unknown;
      readonly sliceId?: unknown;
      readonly status?: unknown;
    };
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
