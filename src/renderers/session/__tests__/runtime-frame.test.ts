import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { RuntimeStateProjection } from '../../../projections/session/runtime-state.js';
import { renderRuntimeFrame } from '../runtime-frame.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = resolve(HERE, '../__previews__');
const GOLDEN_PATH = resolve(PREVIEWS_DIR, 'runtime-frame-ready.md');

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
    const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

    mkdirSync(PREVIEWS_DIR, { recursive: true });
    await expect(locked).toMatchFileSnapshot(GOLDEN_PATH);
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
