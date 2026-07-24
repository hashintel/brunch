import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const workflow = await readFile(new URL('../.github/workflows/test.yml', import.meta.url), 'utf8');

describe('Test workflow lane contracts', () => {
  it('derives lane selection from complete pull-request diff evidence', () => {
    expect(workflow).toContain('id: test-lanes');
    expect(workflow).toContain('EVENT_NAME: ${{ github.event_name }}');
    expect(workflow).toContain('BASE_SHA: ${{ github.event.pull_request.base.sha }}');
    expect(workflow).toContain('HEAD_SHA: ${{ github.sha }}');
    expect(workflow).toContain('node scripts/ci-test-lanes.mjs');
  });

  it('always runs the default and non-comparison slow tests', () => {
    expect(workflow).toContain('name: Test (default + non-comparison slow)');
    expect(workflow).toContain('npm run test && npm run test:slow:core');
  });

  it('conditions only the expensive comparison oracle lane', () => {
    expect(workflow).toMatch(
      /name: Test \(expensive comparison oracles\)\n\s+if: steps\.test-lanes\.outputs\.comparison == 'true'\n\s+run: npm run test:comparison/,
    );
    expect(workflow).toMatch(/name: Build\n\s+run: npm run build/);
  });

  it('retains one stable required full-gate job', () => {
    expect(workflow.match(/name: Full gate/g)).toHaveLength(1);
    expect(workflow).toContain('merge_group:');
  });
});
