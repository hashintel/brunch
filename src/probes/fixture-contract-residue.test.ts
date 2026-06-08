import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const RETIRED_CONTRACT_TOKENS = ['graphSnapshotJson', 'graph-snapshot', 'workspace.snapshot'] as const;

describe('committed probe reports', () => {
  it('do not contain retired graph artifact or workspace topic tokens', () => {
    const reportPaths = execFileSync('git', ['ls-files', '.fixtures/**/report.json'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);

    const residue = reportPaths.flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      return RETIRED_CONTRACT_TOKENS.flatMap((token) => (text.includes(token) ? [`${path}: ${token}`] : []));
    });

    expect(residue).toEqual([]);
  });
});
