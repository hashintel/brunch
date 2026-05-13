// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkflowState } from '@/shared/api-types.js';

import type { ContinuousWorkspaceController } from '../-continuous-workspace-controller.js';
import { ContinuousWorkspaceView } from '../-continuous-workspace-view.js';
import { WorkspaceFocusProvider, useWorkspaceFocus } from '../../-workspace-focus.js';

const controller = vi.fn<() => ContinuousWorkspaceController>();

vi.mock('../-continuous-workspace-controller.js', () => ({
  useContinuousWorkspaceController: () => controller(),
}));

vi.mock('../-workspace-transcript-artifacts.js', () => ({
  WorkspaceTranscriptArtifacts: () => <div data-testid="workspace-artifacts" />,
}));

function createWorkflow(): WorkflowState {
  const phase = {
    status: 'unstarted' as const,
    closeability: false,
    readiness: 'low' as const,
    closureBasis: null,
    proposalPending: false,
    turnId: null,
    summary: null,
  };

  return {
    phases: {
      grounding: { ...phase, status: 'in_progress' },
      design: { ...phase },
      requirements: { ...phase },
      criteria: { ...phase },
    },
  };
}

function createController(): ContinuousWorkspaceController {
  return {
    specification: {
      id: 42,
      name: 'Test specification',
      mode: 'greenfield',
      active_turn_id: null,
      created_at: '2026-04-03T10:00:00.000Z',
      updated_at: '2026-04-03T10:00:00.000Z',
    },
    workflow: createWorkflow(),
    sections: [{ phase: 'grounding', artifacts: [], phaseTurns: [], isActive: true }],
    activePhase: 'grounding',
    captureStatusByTurnId: new Map(),
    chat: {
      messages: [],
      status: 'ready',
      isLoading: false,
      isStreaming: false,
      submitText: vi.fn(),
      confirmPhaseClosure: vi.fn(),
      forcePhaseClosure: vi.fn(),
    },
    bottomArtifact: null,
  };
}

class ImmediateIntersectionObserver {
  readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          intersectionRatio: 1,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }

  disconnect() {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve() {}
}

function FocusProbe() {
  const workspaceFocus = useWorkspaceFocus();

  return <div data-testid="focused-phase">{workspaceFocus?.focusedPhase ?? 'none'}</div>;
}

function WorkspaceHarness() {
  const [mounted, setMounted] = useState(true);

  return (
    <WorkspaceFocusProvider>
      <FocusProbe />
      {mounted ? <ContinuousWorkspaceView initialPhase="grounding" /> : null}
      <button type="button" onClick={() => setMounted(false)}>
        Leave workspace
      </button>
    </WorkspaceFocusProvider>
  );
}

beforeEach(() => {
  controller.mockReturnValue(createController());
  vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ContinuousWorkspaceView', () => {
  it('clears workspace focus when the continuous workspace unmounts', async () => {
    render(<WorkspaceHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('focused-phase').textContent).toBe('grounding');
    });

    screen.getByRole('button', { name: 'Leave workspace' }).click();

    await waitFor(() => {
      expect(screen.getByTestId('focused-phase').textContent).toBe('none');
    });
  });
});
