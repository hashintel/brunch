import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const releaseWorkflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
const testWorkflow = await readFile(new URL('../.github/workflows/test.yml', import.meta.url), 'utf8');

describe('FE-1050 release workflow contracts', () => {
  it('fails the publish run when a protected release tag cannot be pushed', () => {
    expect(releaseWorkflow).toContain('commitMode: git-cli');
    expect(releaseWorkflow).not.toContain('commitMode: github-api');
  });

  it('limits the worker token to release operations in this repository', () => {
    expect(releaseWorkflow).toContain('permission-contents: write');
    expect(releaseWorkflow).toContain('permission-pull-requests: write');
  });

  it('requires explicit release intent on ordinary pull requests', () => {
    expect(testWorkflow).toContain('fetch-depth: 0');
    expect(testWorkflow).toContain("github.base_ref == 'next'");
    expect(testWorkflow).toContain("!startsWith(github.head_ref, 'changeset-release/')");
    expect(testWorkflow).toContain('BASE_REF: ${{ github.base_ref }}');
    expect(testWorkflow).toContain('changeset status --since="origin/$BASE_REF"');
    expect(testWorkflow).not.toContain('changeset status --since=origin/${{ github.base_ref }}');
  });
});
