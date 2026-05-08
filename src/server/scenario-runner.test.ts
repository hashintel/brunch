import { describe, expect, it } from 'vitest';

import {
  buildCandidateSpecContextPack,
  buildObserverCaptureContextPack,
  buildWebResearchContextPack,
  type ObserverContextPackInput,
} from './context-pack.js';
import type { TurnWithOptions } from './core.js';
import { buildObserverSystemPrompt } from './observer-prompt.js';
import {
  buildCandidateSpecPromptScenario,
  buildObserverCapturePromptScenario,
  buildPromptScenarioProbeArtifact,
  buildWebResearchPromptScenario,
  executeWebResearchPromptScenario,
  serializePromptScenarioProbeArtifact,
  type PromptScenarioDefinition,
  type PromptScenarioModelAdapter,
} from './scenario-runner.js';

const observerSystemPrompt = buildObserverSystemPrompt('grounding');

const observerCaptureScenario: PromptScenarioDefinition = {
  scenario: 'observer-capture',
  prompt: { source: 'composed', id: 'observer.system', rendered: observerSystemPrompt },
  context: {
    scenario: 'observer-capture',
    rendered: 'Current turn #5:\n  Phase: grounding\n  Question: What is the goal?',
    data: {
      existingKnowledgeAnchors: [],
      currentTurn: { id: 5, phase: 'grounding' },
    },
  },
  model: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0,
  },
  capabilities: ['workspace.readFile', 'intentGraph.validateEdge'],
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
      schemaVersion: 2,
      scenario: 'observer-capture',
      prompt: {
        id: 'observer.system',
        asset: 'observer-system.md',
        fingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      },
      context: {
        scenario: 'observer-capture',
        fingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        rendered: 'Current turn #5:\n  Phase: grounding\n  Question: What is the goal?',
      },
      model: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0,
      },
      capabilities: [
        {
          id: 'workspace.readFile',
          authority: 'read_only',
          summary: 'Read a file from the workspace context.',
          handler: null,
        },
        {
          id: 'intentGraph.validateEdge',
          authority: 'read_only',
          summary: 'Validate an intent graph edge against relation policy without mutating graph truth.',
          handler: null,
        },
      ],
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
    expect(artifact.capabilities).toEqual([
      expect.objectContaining({ id: 'workspace.readFile', authority: 'read_only' }),
      expect.objectContaining({ id: 'workspace.search', authority: 'read_only' }),
      expect.objectContaining({ id: 'intentGraph.validateEdge', authority: 'read_only' }),
      expect.objectContaining({ id: 'scenario.render', authority: 'read_only' }),
    ]);
  });

  it('builds a candidate-spec scenario as a no-provider proposal artifact', () => {
    const contextPack = buildCandidateSpecContextPack({
      objective: 'Offer reaction-ready directions for a partially specified feature.',
      requestedCandidateCount: 2,
      entities: {
        ...emptyEntities(),
        goals: [{ id: 1, content: 'Help users choose between plausible directions' }],
        constraints: [{ id: 4, content: 'Do not mutate durable intent graph truth' }],
        decisions: [{ id: 7, content: 'Candidate sets are turn-owned artifacts' }],
        assumptions: [{ id: 8, content: 'Candidate proposals reduce interview fatigue' }],
      },
    });

    const artifact = buildPromptScenarioProbeArtifact(
      buildCandidateSpecPromptScenario({ contextPack, model: observerCaptureScenario.model }),
    );

    expect(artifact).toMatchObject({
      schemaVersion: 2,
      scenario: 'candidate-spec',
      prompt: {
        id: 'candidate-spec.system',
        asset: 'candidate-spec-system.md',
      },
      context: {
        scenario: 'candidate-spec',
      },
      execution: {
        status: 'not-run',
        rawOutput: null,
      },
    });
    expect(artifact.prompt.rendered).toContain('candidate-spec direction set');
    expect(artifact.prompt.rendered).not.toContain('{{');
    expect(artifact.context.rendered).toContain('Known intent anchors:\n#1 goal');
    expect(artifact.context.rendered).toContain('Requested candidate count:\n2');
    expect(artifact.capabilities).toEqual([
      expect.objectContaining({ id: 'scenario.render', authority: 'read_only' }),
    ]);
    expect(artifact.capabilities).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'changeset.submit' })]),
    );
  });

  it('builds a web-research scenario without executing web tools', () => {
    const contextPack = buildWebResearchContextPack({
      researchObjective: 'Find current docs for OpenRouter tool use and structured output support.',
      triggeringQuestion: 'Can OpenRouter preserve Brunch interviewer and observer behavior?',
      constraints: ['Use vendor documentation first.'],
      entities: {
        ...emptyEntities(),
        assumptions: [{ id: 74, content: 'OpenRouter may reduce first-run friction' }],
      },
    });

    const artifact = buildPromptScenarioProbeArtifact(
      buildWebResearchPromptScenario({ contextPack, model: observerCaptureScenario.model }),
    );

    expect(artifact).toMatchObject({
      schemaVersion: 2,
      scenario: 'web-research',
      prompt: {
        id: 'web-research.system',
        asset: 'web-research-system.md',
      },
      context: {
        scenario: 'web-research',
      },
      execution: {
        status: 'not-run',
        rawOutput: null,
      },
    });
    expect(artifact.context.rendered).toContain('Known intent anchors:\n#74 assumption');
    expect(artifact.prompt.rendered).toContain('You plan web research for Brunch spec elicitation.');
    expect(artifact.capabilities).toEqual([
      expect.objectContaining({ id: 'web.search', authority: 'read_only' }),
      expect.objectContaining({ id: 'web.fetchPage', authority: 'read_only' }),
      expect.objectContaining({ id: 'scenario.render', authority: 'read_only' }),
    ]);
  });

  it('executes a web-research scenario through an injected model adapter', async () => {
    const contextPack = buildWebResearchContextPack({
      researchObjective: 'Find current docs for OpenRouter tool use and structured output support.',
      triggeringQuestion: 'Can OpenRouter preserve Brunch interviewer and observer behavior?',
      constraints: ['Use vendor documentation first.'],
      entities: {
        ...emptyEntities(),
        assumptions: [{ id: 74, content: 'OpenRouter may reduce first-run friction' }],
      },
    });
    const scenario = buildWebResearchPromptScenario({ contextPack, model: observerCaptureScenario.model });
    const calls: Parameters<PromptScenarioModelAdapter>[0][] = [];
    const fakeAdapter: PromptScenarioModelAdapter = async (input) => {
      calls.push(input);
      return { text: 'OpenRouter supports tool calling for compatible models.' };
    };

    const artifact = await executeWebResearchPromptScenario(scenario, fakeAdapter);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      scenario: 'web-research',
      prompt: {
        id: 'web-research.system',
        rendered: expect.stringContaining('You plan web research for Brunch spec elicitation.'),
      },
      context: {
        scenario: 'web-research',
        rendered: expect.stringContaining('Known intent anchors:\n#74 assumption'),
      },
      model: observerCaptureScenario.model,
      capabilities: [
        expect.objectContaining({ id: 'web.search', authority: 'read_only' }),
        expect.objectContaining({ id: 'web.fetchPage', authority: 'read_only' }),
        expect.objectContaining({ id: 'scenario.render', authority: 'read_only' }),
      ],
    });
    expect(artifact.execution).toEqual({
      status: 'succeeded',
      rawOutput: 'OpenRouter supports tool calling for compatible models.',
      error: null,
    });
    expect(artifact.structuredParse).toEqual({
      status: 'not-applicable',
      value: null,
      error: null,
    });
  });

  it('captures web-research execution failures without provider side effects', async () => {
    const contextPack = buildWebResearchContextPack({
      researchObjective: 'Find current docs for OpenRouter tool use and structured output support.',
      triggeringQuestion: 'Can OpenRouter preserve Brunch interviewer and observer behavior?',
      entities: emptyEntities(),
    });
    const fakeAdapter: PromptScenarioModelAdapter = async () => {
      throw new Error('provider unavailable');
    };

    const artifact = await executeWebResearchPromptScenario(
      buildWebResearchPromptScenario({ contextPack, model: observerCaptureScenario.model }),
      fakeAdapter,
    );

    expect(artifact.execution).toEqual({
      status: 'failed',
      rawOutput: null,
      error: 'provider unavailable',
    });
    expect(artifact.structuredParse).toEqual({
      status: 'not-applicable',
      value: null,
      error: null,
    });
  });

  it('redacts API-key-like values from web-research execution failure artifacts', async () => {
    const contextPack = buildWebResearchContextPack({
      researchObjective: 'Find current docs for OpenRouter tool use and structured output support.',
      triggeringQuestion: 'Can OpenRouter preserve Brunch interviewer and observer behavior?',
      entities: emptyEntities(),
    });
    const fakeAdapter: PromptScenarioModelAdapter = async () => {
      throw new Error('Anthropic authentication failed for sk-ant-api03-secret-token-value');
    };

    const artifact = await executeWebResearchPromptScenario(
      buildWebResearchPromptScenario({ contextPack, model: observerCaptureScenario.model }),
      fakeAdapter,
    );

    expect(artifact.execution).toEqual({
      status: 'failed',
      rawOutput: null,
      error: 'Provider execution failed with sensitive details redacted.',
    });
    expect(serializePromptScenarioProbeArtifact(artifact)).not.toContain('sk-ant-api03-secret-token-value');
  });

  it('summarizes non-Error web-research execution failures without object dumps', async () => {
    const contextPack = buildWebResearchContextPack({
      researchObjective: 'Find current docs for OpenRouter tool use and structured output support.',
      triggeringQuestion: 'Can OpenRouter preserve Brunch interviewer and observer behavior?',
      entities: emptyEntities(),
    });
    const fakeAdapter: PromptScenarioModelAdapter = async () => {
      throw { reason: 'provider unavailable', retryAfter: 30 };
    };

    const artifact = await executeWebResearchPromptScenario(
      buildWebResearchPromptScenario({ contextPack, model: observerCaptureScenario.model }),
      fakeAdapter,
    );

    expect(artifact.execution).toEqual({
      status: 'failed',
      rawOutput: null,
      error: 'Provider execution failed with a non-Error rejection.',
    });
    expect(serializePromptScenarioProbeArtifact(artifact)).not.toContain('[object Object]');
  });

  it('changes rendered-content fingerprints when prompt or context changes', () => {
    const baseArtifact = buildPromptScenarioProbeArtifact(observerCaptureScenario);
    const changedPromptArtifact = buildPromptScenarioProbeArtifact({
      ...observerCaptureScenario,
      prompt: {
        source: 'composed',
        id: 'observer.system',
        rendered: `${observerSystemPrompt}\nAdditional prompt instruction.`,
      },
    });
    const changedContextArtifact = buildPromptScenarioProbeArtifact({
      ...observerCaptureScenario,
      context: {
        ...observerCaptureScenario.context,
        rendered: `${observerCaptureScenario.context.rendered}\n  Answer: Changed`,
      },
    });

    expect(changedPromptArtifact.prompt.fingerprint).not.toBe(baseArtifact.prompt.fingerprint);
    expect(changedPromptArtifact.context.fingerprint).toBe(baseArtifact.context.fingerprint);
    expect(changedContextArtifact.prompt.fingerprint).toBe(baseArtifact.prompt.fingerprint);
    expect(changedContextArtifact.context.fingerprint).not.toBe(baseArtifact.context.fingerprint);
  });

  it('rejects unknown capability ids before they become reviewable snapshots', () => {
    expect(() =>
      buildPromptScenarioProbeArtifact({
        ...observerCaptureScenario,
        capabilities: ['workspace.readFile', 'turn.insert'],
      }),
    ).toThrow('Unknown Brunch capability ids: turn.insert');
  });

  it('rejects mismatched scenario definitions at the type boundary', () => {
    const model = observerCaptureScenario.model;

    const observerCaptureContext = observerCaptureScenario.context;

    // @ts-expect-error web-research definitions cannot carry observer-capture contexts.
    const mismatchedContextScenario: PromptScenarioDefinition = {
      scenario: 'web-research',
      prompt: { source: 'asset', id: 'web-research.system' },
      context: observerCaptureContext,
      model,
    };
    // @ts-expect-error observer-capture definitions cannot use web-research prompt assets.
    const mismatchedPromptSource: PromptScenarioDefinition = {
      scenario: 'observer-capture',
      prompt: { source: 'asset', id: 'web-research.system' },
      context: observerCaptureContext,
      model,
    };
    const missingContextDataScenario: PromptScenarioDefinition = {
      ...observerCaptureScenario,
      // @ts-expect-error prompt scenario contexts require typed context-pack data.
      context: { scenario: 'observer-capture', rendered: 'observer context' },
    };

    expect(mismatchedContextScenario.scenario).toBe('web-research');
    expect(mismatchedPromptSource.scenario).toBe('observer-capture');
    expect(missingContextDataScenario.scenario).toBe('observer-capture');
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
          schemaVersion: 2,
          scenario: 'observer-capture',
          prompt: {
            id: 'observer.system',
            asset: 'observer-system.md',
            rendered: artifact.prompt.rendered,
            fingerprint: artifact.prompt.fingerprint,
          },
          context: {
            ...observerCaptureScenario.context,
            fingerprint: artifact.context.fingerprint,
          },
          model: observerCaptureScenario.model,
          capabilities: artifact.capabilities,
          execution: {
            status: 'not-run',
            rawOutput: null,
            error: null,
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
