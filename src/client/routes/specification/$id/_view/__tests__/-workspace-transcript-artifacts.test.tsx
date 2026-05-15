// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { secondaryChatStateSchema } from '@/shared/api-types.js';
import type { SpecificationTurn } from '@/shared/specification.js';

vi.mock('@/client/components/secondary-chat-trigger', () => ({
  useSetSecondaryChatModeMutation: () => ({
    setMode: vi.fn(),
    isPending: false,
    errorMessage: null,
    clearError: vi.fn(),
  }),
}));

import type { WorkspaceStreamArtifact } from '../-workspace-stream-projector.js';
import { WorkspaceTranscriptArtifacts } from '../-workspace-transcript-artifacts.js';

type SecondaryChatState = z.infer<typeof secondaryChatStateSchema>;

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

function createSecondaryChat(overrides: Partial<SecondaryChatState['chat']> = {}): SecondaryChatState {
  return {
    chat: {
      id: 99,
      specification_id: 1,
      kind: 'side_chat',
      parent_chat_id: 1,
      invoked_in_turn_id: 7,
      pinned_item_id: null,
      pinned_span_hint: null,
      mode: 'explore',
      ...overrides,
    },
    kickoffTurn: {
      id: 100,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'grounding',
      turn_kind: 'kickoff',
      question: '',
      why: null,
      impact: null,
      answer: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: 'Editing this item.',
      created_at: '2026-04-03T10:01:00.000Z',
    },
    turns: [],
  };
}

const noop = () => null;

describe('WorkspaceTranscriptArtifacts secondary-chat inline rendering', () => {
  it('renders SecondaryChatCollapsible after the answered turn whose id matches the map key', () => {
    const turn = createTurn({ id: 7 });
    const artifacts: readonly WorkspaceStreamArtifact[] = [
      { kind: 'answered-turn', turn, questionCode: 'Q1' },
    ];
    const map: ReadonlyMap<number, readonly SecondaryChatState[]> = new Map([
      [7, [createSecondaryChat({ id: 99, invoked_in_turn_id: 7 })]],
    ]);

    render(
      <WorkspaceTranscriptArtifacts
        streamArtifacts={artifacts}
        specificationId="1"
        phaseTurns={[turn]}
        captureStatusByTurnId={new Map()}
        showLockedState={false}
        renderPersistedActivity={noop}
        renderLiveActivity={noop}
        secondaryChatsByInvokedTurnId={map}
      />,
    );

    const inlineSlot = screen.getByTestId('secondary-chats-for-turn-7');
    expect(inlineSlot).toBeTruthy();
    expect(inlineSlot.querySelectorAll('[data-testid="secondary-chat-collapsible"]')).toHaveLength(1);
  });

  it('starts the inline secondary chat collapsed (kickoff content not visible)', () => {
    const turn = createTurn({ id: 7 });
    const artifacts: readonly WorkspaceStreamArtifact[] = [
      { kind: 'answered-turn', turn, questionCode: 'Q1' },
    ];
    const map: ReadonlyMap<number, readonly SecondaryChatState[]> = new Map([
      [7, [createSecondaryChat({ id: 99, invoked_in_turn_id: 7 })]],
    ]);

    render(
      <WorkspaceTranscriptArtifacts
        streamArtifacts={artifacts}
        specificationId="1"
        phaseTurns={[turn]}
        captureStatusByTurnId={new Map()}
        showLockedState={false}
        renderPersistedActivity={noop}
        renderLiveActivity={noop}
        secondaryChatsByInvokedTurnId={map}
      />,
    );

    expect(screen.queryByText('Editing this item.')).toBeNull();
  });

  it('does not render orphan secondary chats when the parent turn is not in the stream', () => {
    const turn = createTurn({ id: 7 });
    const artifacts: readonly WorkspaceStreamArtifact[] = [
      { kind: 'answered-turn', turn, questionCode: 'Q1' },
    ];
    const map: ReadonlyMap<number, readonly SecondaryChatState[]> = new Map([
      [9999, [createSecondaryChat({ id: 99, invoked_in_turn_id: 9999 })]],
    ]);

    render(
      <WorkspaceTranscriptArtifacts
        streamArtifacts={artifacts}
        specificationId="1"
        phaseTurns={[turn]}
        captureStatusByTurnId={new Map()}
        showLockedState={false}
        renderPersistedActivity={noop}
        renderLiveActivity={noop}
        secondaryChatsByInvokedTurnId={map}
      />,
    );

    expect(screen.queryByTestId('secondary-chats-for-turn-9999')).toBeNull();
    expect(screen.queryByTestId('secondary-chat-collapsible')).toBeNull();
  });

  it('renders multiple secondary chats anchored to the same parent turn', () => {
    const turn = createTurn({ id: 7 });
    const artifacts: readonly WorkspaceStreamArtifact[] = [
      { kind: 'answered-turn', turn, questionCode: 'Q1' },
    ];
    const map: ReadonlyMap<number, readonly SecondaryChatState[]> = new Map([
      [
        7,
        [
          createSecondaryChat({ id: 100, invoked_in_turn_id: 7 }),
          createSecondaryChat({ id: 101, invoked_in_turn_id: 7 }),
        ],
      ],
    ]);

    render(
      <WorkspaceTranscriptArtifacts
        streamArtifacts={artifacts}
        specificationId="1"
        phaseTurns={[turn]}
        captureStatusByTurnId={new Map()}
        showLockedState={false}
        renderPersistedActivity={noop}
        renderLiveActivity={noop}
        secondaryChatsByInvokedTurnId={map}
      />,
    );

    expect(screen.getAllByTestId('secondary-chat-collapsible')).toHaveLength(2);
  });
});
