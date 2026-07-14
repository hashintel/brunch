import { describe, expect, it } from 'vitest';

import type { WorkspaceLaunchInventory } from '../../../session/workspace-session-coordinator.js';
import { createWorkspaceDialogComponent } from './component.js';

const inventory: WorkspaceLaunchInventory = {
  cwd: '/tmp/brunch',
  currentSpec: null,
  currentSessionFile: null,
  needsNewSpec: true,
  specs: [],
  unavailableSessions: [],
};

describe('WorkspaceDialogComponent', () => {
  it('keeps spec and session creation available without rendering an auth warning', () => {
    const component = createWorkspaceDialogComponent({
      inventory,
      onDecision: () => {},
    });

    const rendered = component.render(80).join('\n');

    expect(rendered).toContain('Start a new specification');
    expect(rendered).not.toContain('No model auth');
    expect(rendered).not.toContain('brunch login');
    expect(rendered).not.toContain('/login');
  });
});
