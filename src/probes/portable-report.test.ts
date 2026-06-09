import { describe, expect, it } from 'vitest';

import { assertPortableRunId } from './portable-report.js';

describe('portable report helpers', () => {
  it('rejects run ids that are not portable single path segments', () => {
    for (const runId of ['../escape', 'nested/run', 'nested\\run', '.', '..', '']) {
      expect(() => assertPortableRunId(runId)).toThrow(
        'Artifact runId must be a portable single path segment',
      );
    }
  });

  it('accepts existing default and sample run id shapes', () => {
    for (const runId of [
      '2026-06-08-capture-quality-sample',
      'fixture-curation-2026-06-05T104440Z',
      'introspection-2026-06-09T000000000Z',
    ]) {
      expect(assertPortableRunId(runId)).toBe(runId);
    }
  });
});
