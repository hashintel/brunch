import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAnthropic, mockGenerateText } = vi.hoisted(() => ({
  mockAnthropic: vi.fn(() => 'mock-anthropic-model'),
  mockGenerateText: vi.fn(),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mockAnthropic,
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

const { buildWebResearchContextPack } = await import('./context-pack.js');
const { anthropicPromptScenarioModelAdapter } = await import('./scenario-runner-ai-sdk-adapter.js');
const { buildWebResearchPromptScenario, executeWebResearchPromptScenario } =
  await import('./scenario-runner.js');

function emptyEntities() {
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

const webResearchContextPack = buildWebResearchContextPack({
  researchObjective: 'Find current docs for OpenRouter tool use and structured output support.',
  triggeringQuestion: 'Can OpenRouter preserve Brunch interviewer and observer behavior?',
  constraints: ['Use vendor documentation first.'],
  entities: emptyEntities(),
});

const anthropicScenario = buildWebResearchPromptScenario({
  contextPack: webResearchContextPack,
  model: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0,
  },
});

describe('prompt scenario AI SDK adapter', () => {
  beforeEach(() => {
    mockAnthropic.mockClear();
    mockGenerateText.mockReset();
    mockAnthropic.mockReturnValue('mock-anthropic-model');
    mockGenerateText.mockResolvedValue({ text: 'Research plan output.' });
  });

  it('maps a rendered prompt scenario to an Anthropic AI SDK generateText call', async () => {
    const artifact = await executeWebResearchPromptScenario(
      anthropicScenario,
      anthropicPromptScenarioModelAdapter,
    );

    expect(mockAnthropic).toHaveBeenCalledWith('claude-sonnet-4-5-20250929');
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-anthropic-model',
        system: expect.stringContaining('You plan web research for Brunch spec elicitation.'),
        prompt: expect.stringContaining('Find current docs for OpenRouter'),
        temperature: 0,
      }),
    );
    expect(artifact.execution).toEqual({
      status: 'succeeded',
      rawOutput: 'Research plan output.',
      error: null,
    });
  });

  it('rejects unsupported providers before constructing a model', async () => {
    await expect(
      anthropicPromptScenarioModelAdapter({
        scenario: 'web-research',
        prompt: {
          id: 'web-research.system',
          asset: 'web-research-system.md',
          rendered: 'system prompt',
          fingerprint: 'sha256:prompt',
        },
        context: {
          scenario: 'web-research',
          rendered: 'context pack',
          data: {
            researchObjective: 'Find current docs for OpenRouter',
            constraints: [],
            knownIntentAnchors: [],
          },
          fingerprint: 'sha256:context',
        },
        model: {
          provider: 'openrouter',
          model: 'openai/gpt-5',
        },
        capabilities: [],
      }),
    ).rejects.toThrow('Unsupported prompt scenario provider: openrouter');

    expect(mockAnthropic).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
