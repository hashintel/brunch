import { describe, expect, it } from 'vitest';

import {
  buildPromptScenarioProbeArtifact,
  serializePromptScenarioProbeArtifact,
  type PromptScenarioDefinition,
} from './scenario-runner.js';

const observerCaptureScenario: PromptScenarioDefinition = {
  scenario: 'observer-capture',
  prompt: { id: 'observer.system' },
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
