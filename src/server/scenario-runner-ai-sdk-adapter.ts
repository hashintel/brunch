import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

import type { PromptScenarioModelAdapter } from './scenario-runner.js';

export const anthropicPromptScenarioModelAdapter: PromptScenarioModelAdapter = async (input) => {
  if (input.model.provider !== 'anthropic') {
    throw new Error(`Unsupported prompt scenario provider: ${input.model.provider}`);
  }

  const result = await generateText({
    model: anthropic(input.model.model),
    system: input.prompt.rendered,
    prompt: input.context.rendered,
    temperature: input.model.temperature,
  });

  return { text: result.text };
};
