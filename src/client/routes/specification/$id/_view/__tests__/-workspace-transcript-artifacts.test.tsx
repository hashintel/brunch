// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { SpecificationTurn } from '@/shared/specification.js';

import type { WorkspaceStreamArtifact } from '../-workspace-stream-projector.js';
import { WorkspaceTranscriptArtifacts } from '../-workspace-transcript-artifacts.js';

afterEach(() => cleanup());

function createTurn(overrides: Partial<SpecificationTurn> = {}): SpecificationTurn {
  return {
    id: 7,
    specification_id: 1,
    parent_turn_id: null,
    phase: 'grounding',
    turn_kind: 'question',
    question: 'What is the goal?',
    why: null,
    impact: 'medium',
    answer: 'Ship something',
    is_resolution: false,
    user_parts: null,
    assistant_parts: null,
    created_at: '2026-04-03T10:00:00.000Z',
    ...overrides,
  };
}

const noop = () => null;

describe('WorkspaceTranscriptArtifacts', () => {
  it('does not render any secondary chat surface beneath turn artifacts', () => {
    const turn = createTurn({ id: 7 });
    const artifacts: readonly WorkspaceStreamArtifact[] = [
      { kind: 'answered-turn', turn, questionCode: 'Q1' },
    ];

    render(
      <WorkspaceTranscriptArtifacts
        streamArtifacts={artifacts}
        specificationId="1"
        phaseTurns={[turn]}
        captureStatusByTurnId={new Map()}
        showLockedState={false}
        renderPersistedActivity={noop}
        renderLiveActivity={noop}
      />,
    );

    expect(screen.queryByTestId('secondary-chat-collapsible')).toBeNull();
    expect(screen.queryByTestId(/^secondary-chats-for-turn-/)).toBeNull();
  });
});
