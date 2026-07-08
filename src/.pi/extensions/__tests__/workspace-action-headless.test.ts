import { describe, expect, it } from 'vitest';

import type {
  SpecSessionActivationCoordinator,
  SpecSessionActivationDecision,
  WorkspaceActivationState,
  WorkspaceLaunchInventory,
  WorkspaceSessionReadyState,
} from '../../../session/workspace-session-coordinator.js';
import { runBrunchWorkspaceAction, type BrunchWorkspaceActionContext } from '../workspace/index.js';

const inventory: WorkspaceLaunchInventory = {
  cwd: '/tmp/project',
  currentSpec: { id: 1, title: 'Spec One' },
  currentSessionFile: '/tmp/project/.brunch/sessions/session-one.jsonl',
  needsNewSpec: false,
  specs: [
    {
      spec: { id: 1, title: 'Spec One' },
      sessions: [
        {
          id: 'session-one',
          file: '/tmp/project/.brunch/sessions/session-one.jsonl',
          specId: 1,
          specTitle: 'Spec One',
          available: true,
        },
      ],
    },
  ],
  unavailableSessions: [],
};

const readyWorkspace: WorkspaceSessionReadyState = {
  status: 'ready',
  cwd: inventory.cwd,
  spec: { id: 1, title: 'Spec One' },
  session: {
    id: 'session-one',
    file: '/tmp/project/.brunch/sessions/session-one.jsonl',
    manager: {} as never,
  },
  chrome: {
    cwd: inventory.cwd,
    spec: { id: 1, title: 'Spec One' },
  },
};

function coordinatorHarness(activation: WorkspaceActivationState = readyWorkspace) {
  const decisions: SpecSessionActivationDecision[] = [];
  const coordinator: SpecSessionActivationCoordinator = {
    inspectWorkspace: async () => inventory,
    activateWorkspace: async (decision) => {
      decisions.push(decision);
      return activation;
    },
  };
  return { coordinator, decisions };
}

function contextHarness(options: { decision?: SpecSessionActivationDecision; hasUI?: boolean } = {}) {
  const notifications: Array<{ message: string; level?: 'info' | 'warning' | 'error' }> = [];
  const customCalls: unknown[] = [];
  const ctx: BrunchWorkspaceActionContext = {
    hasUI: options.hasUI ?? true,
    ui: {
      notify(message: string, level?: 'info' | 'warning' | 'error') {
        notifications.push({ message, level });
      },
    },
    sessionManager: {
      getSessionFile: () => '/tmp/project/.brunch/sessions/other.jsonl',
    },
  } as never;
  if (options.decision) {
    const ui = ctx.ui as BrunchWorkspaceActionContext['ui'] & {
      custom: <T>(factory: unknown, customOptions: unknown) => Promise<T>;
    };
    ui.custom = async <T>(_factory: unknown, customOptions: unknown) => {
      customCalls.push(customOptions);
      return options.decision as T;
    };
  }
  return { ctx, notifications, customCalls };
}

describe('Brunch workspace action', () => {
  it('degrades without UI custom support instead of activating an undefined decision', async () => {
    const { coordinator, decisions } = coordinatorHarness();
    const { ctx, notifications } = contextHarness({ hasUI: false });

    await expect(runBrunchWorkspaceAction(ctx, coordinator)).resolves.toBeUndefined();

    expect(decisions).toEqual([]);
    expect(notifications).toEqual([
      {
        message: 'Spec/session switch requires interactive UI.',
        level: 'warning',
      },
    ]);
  });

  it('treats hasUI false as headless even if a custom stub is present', async () => {
    const decision: SpecSessionActivationDecision = { action: 'cancel' };
    const { coordinator, decisions } = coordinatorHarness();
    const { ctx, notifications, customCalls } = contextHarness({ decision, hasUI: false });

    await runBrunchWorkspaceAction(ctx, coordinator);

    expect(customCalls).toEqual([]);
    expect(decisions).toEqual([]);
    expect(notifications).toEqual([
      {
        message: 'Spec/session switch requires interactive UI.',
        level: 'warning',
      },
    ]);
  });

  it('keeps UI-capable decisions flowing to activation', async () => {
    const decision: SpecSessionActivationDecision = {
      action: 'continue',
      specId: 1,
      sessionFile: '/tmp/project/.brunch/sessions/session-one.jsonl',
    };
    const { coordinator, decisions } = coordinatorHarness();
    const { ctx, customCalls } = contextHarness({ decision });

    await runBrunchWorkspaceAction(ctx, coordinator);

    expect(customCalls).toEqual([
      {
        overlay: true,
        overlayOptions: {
          anchor: 'center',
          width: 80,
          maxHeight: '90%',
          margin: 1,
        },
      },
    ]);
    expect(decisions).toEqual([decision]);
  });

  it('keeps UI-capable cancelled and needs-human branches intact', async () => {
    const cancelDecision: SpecSessionActivationDecision = { action: 'cancel' };
    const cancelled = contextHarness({ decision: cancelDecision });
    const cancelledCoordinator = coordinatorHarness({
      status: 'cancelled',
      cwd: inventory.cwd,
      chrome: { cwd: inventory.cwd, spec: null },
    });

    await runBrunchWorkspaceAction(cancelled.ctx, cancelledCoordinator.coordinator);

    expect(cancelledCoordinator.decisions).toEqual([cancelDecision]);
    expect(cancelled.notifications).toEqual([{ message: 'Spec/session switch cancelled.', level: 'info' }]);

    const needsHumanDecision: SpecSessionActivationDecision = { action: 'newSession', specId: 1 };
    const needsHuman = contextHarness({ decision: needsHumanDecision });
    const needsHumanCoordinator = coordinatorHarness({
      status: 'needs_human',
      cwd: inventory.cwd,
      reason: 'Create a spec before switching sessions.',
      chrome: { cwd: inventory.cwd, spec: null },
    });

    await runBrunchWorkspaceAction(needsHuman.ctx, needsHumanCoordinator.coordinator);

    expect(needsHumanCoordinator.decisions).toEqual([needsHumanDecision]);
    expect(needsHuman.notifications).toEqual([
      { message: 'Create a spec before switching sessions.', level: 'warning' },
    ]);
  });
});
