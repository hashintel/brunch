// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { EntitiesData, WorkflowState } from '@/shared/api-types.js';
import type { SpecificationTurn as ProjectStateTurn } from '@/shared/specification.js';

import { InterviewView } from '../-interview-view.js';

function createTurn({
  id,
  question,
  answer,
  assistantParts,
  options,
}: {
  id: number;
  question: string;
  answer: string | null;
  assistantParts: Array<Record<string, unknown>>;
  options?: NonNullable<ProjectStateTurn['options']>;
}): ProjectStateTurn {
  return {
    id,
    specification_id: 1,
    parent_turn_id: id === 1 ? null : id - 1,
    phase: 'grounding',
    turn_kind: 'question',
    question,
    why: 'This frames the next move.',
    impact: 'high',
    answer,
    is_resolution: false,
    user_parts: answer === null ? null : JSON.stringify([{ type: 'text', text: answer }]),
    assistant_parts: JSON.stringify(assistantParts),
    created_at: '2026-04-16 10:00:00',
    options,
    captured_items: [],
  };
}

const testState = vi.hoisted(() => {
  const groundingWorkflow: WorkflowState = {
    phases: {
      grounding: {
        status: 'in_progress',
        closeability: false,
        readiness: 'medium',
        closureBasis: null,
        proposalPending: false,
        turnId: 2,
        summary: null,
      },
      design: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      requirements: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      criteria: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
    },
  };

  const emptyEntities: EntitiesData = {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
  };

  const answeredTurn = createTurn({
    id: 1,
    question: 'What should we build first?',
    answer: 'Web',
    assistantParts: [
      {
        type: 'data-activity-summary',
        data: { seconds: 3, tools: ['structured question'] },
      },
    ],
  });

  const activeTurn = createTurn({
    id: 2,
    question: 'Which platform should we target next?',
    answer: null,
    assistantParts: [
      {
        type: 'data-activity-summary',
        data: { seconds: 2, tools: ['structured question'] },
      },
    ],
    options: [
      { id: 21, position: 0, content: 'Web', is_recommended: true, is_selected: false },
      { id: 22, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
    ],
  });

  return { activeTurn, answeredTurn, emptyEntities, groundingWorkflow };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: import('react').ReactNode }) => <a href="#">{children}</a>,
  useLoaderData: () => testState.emptyEntities,
}));

vi.mock('../-interview-controller.js', () => ({
  useInterviewController: () => ({
    project: {
      id: 1,
      name: 'Project 1',
      mode: 'greenfield',
      active_turn_id: 2,
      created_at: '2026-04-16 10:00:00',
      updated_at: '2026-04-16 10:00:00',
    },
    workflow: testState.groundingWorkflow,
    phaseTurns: [testState.answeredTurn, testState.activeTurn],
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
    bottomArtifact: {
      kind: 'persisted-turn',
      turn: testState.activeTurn,
      state: 'active',
      disabled: false,
      errorMessage: null,
      liveActivity: { seconds: 5, tools: ['phase closure proposal'] },
      submitTurnResponse: vi.fn(),
    },
  }),
}));

describe('transcript parity activity replay', () => {
  it('renders persisted history activity and live bottom-artifact activity beside the right cards', () => {
    render(<InterviewView phase="grounding" />);

    expect(screen.getByText('What should we build first?')).toBeTruthy();
    expect(screen.getByText('Which platform should we target next?')).toBeTruthy();
    expect(screen.getAllByText('Thought for 3s').length).toBe(1);
    expect(screen.getAllByText('Thought for 5s').length).toBe(1);
    expect(screen.getAllByText('Tools: structured question').length).toBe(1);
    expect(screen.getAllByText('Tools: phase closure proposal').length).toBe(1);
  });
});
