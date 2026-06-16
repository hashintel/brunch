import { describe, expect, it } from 'vitest';

import type { RuntimeStateProjection } from '../../../projections/session/runtime-state.js';
import { renderRuntimeFrame } from '../runtime-frame.js';

function readyProjection(): RuntimeStateProjection {
  return {
    status: 'ready',
    specId: 1,
    sessionId: 'session-1',
    agent: {
      operationalMode: 'elicit',
      role: 'elicitor',
      strategy: 'project-graph',
      lens: 'oracle',
      goal: 'commit-converge',
    },
    mentions: {
      graphNodes: [{ id: 'node-1', handle: 'D12', title: 'Decision seam', seenLsn: 7 }],
      files: [{ path: 'src/session/runtime-state.ts', seenGitHead: 'abc123' }],
    },
    world: {
      graph: { latestLsn: 12 },
      git: { head: 'def456' },
    },
    lifecycle: {
      specOrigin: 'existing',
      sessionOrigin: 'resumed',
      sessionIndexInSpec: 10,
      isFirstSessionForSpec: false,
      isTenthSessionForSpec: true,
    },
  };
}

describe('renderRuntimeFrame', () => {
  it('locks the ready runtime-frame preview and renders projected graph handles', async () => {
    const rendered = renderRuntimeFrame(readyProjection());

    await expect(rendered).toMatchFileSnapshot('../__previews__/runtime-frame-ready.md');
    expect(rendered).toContain('#D12');
    expect(rendered).not.toContain('node-1');
    expect(rendered).toContain(
      'mode=elicit; role=elicitor; strategy=project-graph; lens=oracle; goal=commit-converge',
    );
  });

  it('renders not-ready state without throwing', () => {
    expect(
      renderRuntimeFrame({ status: 'not_ready', reason: 'missing_binding', sessionId: 'session-1' }),
    ).toContain('status: not_ready');
  });
});
