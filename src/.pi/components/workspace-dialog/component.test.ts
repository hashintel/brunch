import { describe, expect, it } from 'vitest';

import type { WorkspaceLaunchInventory } from '../../../session/workspace-session-coordinator.js';
import { createWorkspaceDialogComponent, type WorkspaceDialogNoAuthGuidance } from './component.js';

const noAuthGuidance: WorkspaceDialogNoAuthGuidance = {
  title: 'No Brunch model auth',
  lines: [
    'Run brunch login, or use /login in this session.',
    '- Claude Sonnet 4.6 (Anthropic)',
    '- Claude Sonnet 4.6 (OpenRouter)',
  ],
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

    expect(rendered).toContain('No Brunch model auth');
    expect(rendered).toContain('brunch login');
    expect(rendered).toContain('/login');
    expect(rendered).toContain('Claude Sonnet 4.6 (Anthropic)');
    expect(rendered).toContain('Claude Sonnet 4.6 (OpenRouter)');
    expect(rendered).toContain('Start a new specification');
  });

  it('omits login guidance when an allowlisted model is available', () => {
    const component = createWorkspaceDialogComponent({
      inventory,
      modelAvailable: true,
      onDecision: () => {},
    });

    const rendered = component.render(80).join('\n');

    expect(rendered).not.toContain('No Brunch model auth');
    expect(rendered).not.toContain('brunch login');
  });
});
