import { describe, expect, it } from 'vitest';

import type {
  WorkspaceLaunchInventory,
  SpecSessionActivationDecision,
} from '../../../session/workspace-session-coordinator.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { runWorkspaceDialogPreflight } from '../workspace-dialog/preflight.js';

describe('workspace dialog preflight harness', () => {
  it('renders the spec/session picker home screen and resolves on Enter', async () => {
    const terminal = new VirtualTerminal(100, 32);
    const decisionPromise = runWorkspaceDialogPreflight(inventory(), { terminal });

    try {
      await terminal.waitForRender();

      const viewport = terminal.getViewport().join('\n');
      expect(viewport).toContain('Choose a specification');
      expect(viewport).toContain('Continue your latest spec and session');

      terminal.sendInput('\r');
      const decision = await decisionPromise;
      expect(decision).toEqual({
        action: 'continue',
        specId: 1,
        sessionFile: '/sessions/alpha-current.jsonl',
      } as SpecSessionActivationDecision);
    } finally {
      terminal.stop();
    }
  });
});

function inventory(): WorkspaceLaunchInventory {
  return {
    cwd: '/project',
    currentSpec: { id: 1, title: 'Alpha' },
    currentSessionFile: '/sessions/alpha-current.jsonl',
    needsNewSpec: false,
    specs: [
      {
        spec: { id: 1, title: 'Alpha', origin: 'greenfield' },
        sessions: [
          {
            id: 'session-alpha-current',
            file: '/sessions/alpha-current.jsonl',
            specId: 1,
            specTitle: 'Alpha',
            available: true,
          },
          {
            id: 'session-alpha-older',
            file: '/sessions/alpha-older.jsonl',
            specId: 1,
            specTitle: 'Alpha',
            available: true,
          },
        ],
      },
      {
        spec: { id: 2, title: 'Beta', origin: 'greenfield' },
        sessions: [
          {
            id: 'session-beta',
            file: '/sessions/beta.jsonl',
            specId: 2,
            specTitle: 'Beta',
            available: true,
          },
        ],
      },
    ],
    unavailableSessions: [],
  };
}
