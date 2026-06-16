import { describe, expect, it } from 'vitest';

import { cookBannerLines, cookSummaryLines } from './cook-report.js';

describe('cookBannerLines', () => {
  it('renders the cook banner block byte-for-byte', () => {
    expect(
      cookBannerLines({
        policy: 'serial',
        epicCount: 2,
        sliceCount: 5,
        maxRetries: 3,
        sandboxDir: '/runs/abc/worktree',
        reportsPath: '/runs/abc/reports.jsonl',
      }),
    ).toEqual([
      '',
      '  brunch cook',
      '  ──────────────────────────────────────',
      '  policy     serial',
      '  plan       2 epics, 5 slices',
      '  retries    3',
      '  sandbox    /runs/abc/worktree',
      '  reports    /runs/abc/reports.jsonl',
      '',
    ]);
  });
});

describe('cookSummaryLines', () => {
  it('renders a completed run with its epic/slice tree and event count', () => {
    expect(
      cookSummaryLines({
        status: 'completed',
        duration: '1m02s',
        warnings: [],
        epics: [{ epicId: 'api', status: 'completed' }],
        slices: [
          { sliceId: 'login', status: 'completed' },
          { sliceId: 'logout', status: 'completed' },
        ],
        planSlices: [
          { id: 'login', epic_id: 'api' },
          { id: 'logout', epic_id: 'api' },
        ],
        reportCount: 12,
        reportsPath: '/runs/abc/reports.jsonl',
      }),
    ).toEqual([
      '',
      '  ──────────────────────────────────────',
      '  ✓  completed  (1m02s)',
      '',
      '  ✓  api',
      '     ✓ login  ✓ logout',
      '',
      '  12 events → /runs/abc/reports.jsonl',
      '',
    ]);
  });

  it('renders a halted run with its reason and warnings, and per-epic/slice failure marks', () => {
    expect(
      cookSummaryLines({
        status: 'halted',
        reason: 'budget exhausted',
        duration: '8.4s',
        warnings: ['retry budget hit on login'],
        epics: [{ epicId: 'api', status: 'halted' }],
        slices: [
          { sliceId: 'login', status: 'failed' },
          { sliceId: 'logout', status: 'completed' },
        ],
        planSlices: [
          { id: 'login', epic_id: 'api' },
          { id: 'logout', epic_id: 'api' },
        ],
        reportCount: 7,
        reportsPath: '/r.jsonl',
      }),
    ).toEqual([
      '',
      '  ──────────────────────────────────────',
      '  ✗  halted — budget exhausted  (8.4s)',
      '  !  retry budget hit on login',
      '',
      '  ✗  api',
      '     ✗ login  ✓ logout',
      '',
      '  7 events → /r.jsonl',
      '',
    ]);
  });
});
