import { describe, expect, it } from 'vitest';

import { buildObserverCaptureContextPack, type ObserverContextPackInput } from './context-pack.js';
import type { TurnWithOptions } from './core.js';
import { buildObserverSystemPrompt } from './observer-prompt.js';
import {
  buildObserverCapturePromptScenario,
  buildPromptScenarioProbeArtifact,
  serializePromptScenarioProbeArtifact,
  type PromptScenarioDefinition,
} from './scenario-runner.js';

const observerCaptureScenario: PromptScenarioDefinition = {
  scenario: 'observer-capture',
  prompt: { source: 'composed', id: 'observer.system', rendered: buildObserverSystemPrompt('grounding') },
  context: {
    scenario: 'observer-capture',
    rendered: 'Current turn #5:\n  Phase: grounding\n  Question: What is the goal?',
    data: {
      currentTurn: { id: 5, phase: 'grounding' },
    },
  },
  model: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0,
  },
};

function emptyEntities(): ObserverContextPackInput['entities'] {
  return {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
  };
}

function makeTurn(overrides: Partial<TurnWithOptions> = {}): TurnWithOptions {
  return {
    id: 5,
    specification_id: 1,
    parent_turn_id: 4,
    phase: 'grounding',
    turn_kind: 'question',
    question: 'What is the goal?',
    answer: 'Make prompt probes reviewable before UI work.',
    why: 'Goal clarity shapes the probe design.',
    impact: 'high',
    is_resolution: false,
    user_parts: null,
    assistant_parts: null,
    created_at: '2026-01-01',
    ...overrides,
  };
}

describe('prompt scenario runner', () => {
  it('builds a no-provider observer-capture probe artifact from a seeded scenario', () => {
    const artifact = buildPromptScenarioProbeArtifact(observerCaptureScenario);

    expect(artifact).toMatchObject({
      schemaVersion: 1,
      scenario: 'observer-capture',
      prompt: {
        id: 'observer.system',
        asset: 'observer-system.md',
      },
      context: {
        scenario: 'observer-capture',
        rendered: 'Current turn #5:\n  Phase: grounding\n  Question: What is the goal?',
      },
      model: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0,
      },
      execution: {
        status: 'not-run',
        rawOutput: null,
      },
      structuredParse: {
        status: 'not-run',
        value: null,
        error: null,
      },
      review: {
        notes: [],
      },
    });
    expect(artifact.prompt.rendered).toContain(
      'You are an observer agent analyzing a spec elicitation interview turn.',
    );
  });

  it('builds an observer-capture scenario from a typed context pack and resolved production prompt', () => {
    const contextPack = buildObserverCaptureContextPack({
      turn: makeTurn(),
      activePathSummary: 'Turn 1: User wants pre-UI prompt probes.',
      entities: {
        ...emptyEntities(),
        goals: [{ id: 2, content: 'Review prompt behavior before product UI exists' }],
      },
    });

    const scenario = buildObserverCapturePromptScenario({
      contextPack,
      model: observerCaptureScenario.model,
    });
    const artifact = buildPromptScenarioProbeArtifact(scenario);

    expect(scenario.prompt).toMatchObject({
      source: 'composed',
      id: 'observer.system',
    });
    expect(scenario.context.rendered).toContain('Existing knowledge anchors:\n#2 goal');
    expect(scenario.context.data).toBe(contextPack.data);
    expect(artifact.prompt.asset).toBe('observer-system.md');
    expect(artifact.prompt.rendered).toContain(
      'For grounding-mode turns, prioritize **goal**, **term**, **context**, and **constraint** items.',
    );
    expect(artifact.prompt.rendered).toContain('"relationships":[{"relation":"derived_from"');
    expect(artifact.prompt.rendered).not.toContain('{{');
  });

  it('rejects unresolved prompt asset templates before they become reviewable snapshots', () => {
    expect(() =>
      buildPromptScenarioProbeArtifact({
        ...observerCaptureScenario,
        prompt: { source: 'asset', id: 'observer.system' },
      }),
    ).toThrow('Prompt scenario asset source observer.system contains unresolved template variables');
  });

  it('serializes probe artifacts deterministically for reviewable snapshots', () => {
    const artifact = buildPromptScenarioProbeArtifact(observerCaptureScenario);

    expect(serializePromptScenarioProbeArtifact(artifact)).toBe(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          scenario: 'observer-capture',
          prompt: {
            id: 'observer.system',
            asset: 'observer-system.md',
            rendered: artifact.prompt.rendered,
          },
          context: observerCaptureScenario.context,
          model: observerCaptureScenario.model,
          execution: {
            status: 'not-run',
            rawOutput: null,
          },
          structuredParse: {
            status: 'not-run',
            value: null,
            error: null,
          },
          review: {
            notes: [],
          },
        },
        null,
        2,
      )}\n`,
    );
  });
});
