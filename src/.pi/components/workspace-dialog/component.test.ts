import { describe, expect, it } from 'vitest';

import type { WorkspaceLaunchInventory } from '../../../session/workspace-session-coordinator.js';
import { createWorkspaceDialogComponent, type WorkspaceDialogNoAuthGuidance } from './component.js';

const noAuthGuidance: WorkspaceDialogNoAuthGuidance = {
  title: 'No model auth',
  lines: ['Open a spec/session and run /login, or use brunch login before launching.'],
};

const inventory: WorkspaceLaunchInventory = {
  cwd: '/tmp/brunch',
  currentSpec: null,
  currentSessionFile: null,
  needsNewSpec: true,
  specs: [],
  unavailableSessions: [],
};

describe('WorkspaceDialogComponent', () => {
  it('shows non-blocking login guidance when no allowlisted model is available', () => {
    const component = createWorkspaceDialogComponent({
      inventory,
      modelAvailable: false,
      noAuthGuidance,
      onDecision: () => {},
    });

    const rendered = component.render(80).join('\n');

    expect(rendered).toContain('No model auth');
    expect(rendered).toContain('brunch login');
    expect(rendered).toContain('/login');
    expect(rendered).not.toContain('Claude Sonnet 4.6');
    expect(rendered).not.toContain('allowlist');
    expect(rendered).toContain('Start a new specification');
  });

  it('omits login guidance when an allowlisted model is available', () => {
    const component = createWorkspaceDialogComponent({
      inventory,
      modelAvailable: true,
      onDecision: () => {},
    });

    const rendered = component.render(80).join('\n');

    expect(rendered).not.toContain('No model auth');
    expect(rendered).not.toContain('brunch login');
  });
});
