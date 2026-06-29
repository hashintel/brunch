import { describe, expect, it } from 'vitest';

import type { WorkspaceOverview } from '../../../../session/workspace-overview-context.js';
import type { WorkspaceCwdInventory } from '../../../../workspace/cwd-inventory.js';
import { renderWorkspaceContext } from '../workspace-context.js';

const topology = {
  name: '.',
  kind: 'directory' as const,
  fileCount: 12,
  children: [
    { name: 'README.md', kind: 'file' as const, fileCount: 1 },
    {
      name: 'docs',
      kind: 'directory' as const,
      fileCount: 3,
      children: [
        { name: 'README.md', kind: 'file' as const, fileCount: 1 },
        { name: 'design', kind: 'directory' as const, fileCount: 2 },
      ],
    },
  ],
};

describe('renderWorkspaceContext', () => {
  it('renders cwd inventory in the workspace house style without sessions or ATX headings', async () => {
    const rendered = renderWorkspaceContext({
      status: 'ready',
      cwd: '/tmp/brunch-project',
      project: { name: 'Brunch Project', slug: 'brunch-project', source: 'directory' },
      hasBrunchDir: true,
      topology,
    } satisfies WorkspaceCwdInventory);

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/workspace-cwd-context.md');
    expect(rendered).toMatch(/^<workspace>\n/);
    expect(rendered).toContain('Project:\n- name: Brunch Project');
    expect(rendered).toContain('Specifications:\n| id | title | nodes | sessions |');
    expect(rendered).toContain('Topology:\n```tree');
    expect(rendered).toContain('┬ . (12)');
    expect(rendered).not.toContain('session-1.jsonl');
    expect(rendered).not.toMatch(/^#{1,6}\s/m);
  });

  it('renders workspace overview specs as a markdown table and excludes session rows', async () => {
    const rendered = renderWorkspaceContext({
      status: 'ready',
      cwd: '/tmp/brunch-project',
      project: { name: 'Brunch Project', slug: 'brunch-project', source: 'directory' },
      specs: [
        { id: 1, title: 'Context render house style', nodeCount: 42, sessionCount: 3 },
        { id: 2, title: 'Web as driver streaming', nodeCount: 8, sessionCount: 1 },
      ],
      sessions: [
        {
          id: 's1',
          file: 'session-1.jsonl',
          specId: 1,
          specTitle: 'Context render house style',
          turnCount: 5,
        },
      ],
      topology,
    } satisfies WorkspaceOverview);

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/workspace-overview-context.md');
    expect(rendered).toContain('| 1 | Context render house style | 42 | 3 |');
    expect(rendered).not.toContain('session-1.jsonl');
    expect(rendered).not.toMatch(/^#{1,6}\s/m);
  });
});
