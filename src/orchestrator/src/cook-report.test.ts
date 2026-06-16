import { describe, expect, it } from 'vitest';

import { cookBannerLines, cookFinishLines, cookSummaryLines } from './cook-report.js';

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

describe('cookFinishLines', () => {
  it('renders a brownfield promotion (not landed) with merge-when-ready next steps', () => {
    expect(
      cookFinishLines({
        shape: 'brownfield',
        dir: '/repo',
        branch: 'brunch/run/abc',
        commit: '8004de40c0ffee',
      }),
    ).toEqual([
      '  ──────────────────────────────────────',
      '  ✓  cook → promoted',
      '',
      '  dir     /repo',
      '  branch  brunch/run/abc',
      '  commit  8004de40',
      '',
      '  next  — merge into your branch when ready',
      '    git log --oneline brunch/run/abc -10',
      '    git merge brunch/run/abc',
      '',
    ]);
  });

  it('renders a brownfield run that landed into the active branch', () => {
    expect(
      cookFinishLines({
        shape: 'brownfield',
        dir: '/repo',
        branch: 'brunch/run/abc',
        commit: '8004de40c0ffee',
        land: { kind: 'landed', branch: 'main', mode: 'fast-forward' },
      }),
    ).toEqual([
      '  ──────────────────────────────────────',
      '  ✓  cook → promoted + landed',
      '',
      '  dir     /repo',
      '  branch  brunch/run/abc',
      '  commit  8004de40',
      '  landed  main (fast-forward)',
      '',
      '  next  — landed on main',
      '    git log --oneline -10',
      '',
    ]);
  });

  it('renders a brownfield run whose land was refused on a dirty tree', () => {
    expect(
      cookFinishLines({
        shape: 'brownfield',
        dir: '/repo',
        branch: 'brunch/run/abc',
        commit: '8004de40c0ffee',
        land: { kind: 'refused', reason: 'dirty' },
      }),
    ).toEqual([
      '  ──────────────────────────────────────',
      '  ✓  cook → promoted',
      '',
      '  dir     /repo',
      '  branch  brunch/run/abc',
      '  commit  8004de40',
      '',
      '  next  — not landed (working tree dirty); merge when ready',
      '    git merge brunch/run/abc',
      '',
    ]);
  });

  it('renders a greenfield promotion with cd-into-the-target next steps', () => {
    expect(
      cookFinishLines({
        shape: 'greenfield',
        dir: '/out/app',
        branch: 'main',
        commit: '8004de40c0ffee',
      }),
    ).toEqual([
      '  ──────────────────────────────────────',
      '  ✓  cook → promoted',
      '',
      '  dir     /out/app',
      '  branch  main',
      '  commit  8004de40',
      '',
      '  next',
      '    cd /out/app',
      '    git log -1',
      '',
    ]);
  });
});
