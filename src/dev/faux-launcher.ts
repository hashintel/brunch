import { fauxAssistantMessage } from '@earendil-works/pi-ai';

import { createBrunchFauxHarness, type BrunchFauxHarnessOptions } from './faux-harness.js';

export interface BrunchFauxLauncherOptions extends BrunchFauxHarnessOptions {
  readonly prompt?: string;
  readonly responseText?: string;
}

export interface BrunchFauxLauncherResult {
  readonly prompt: string;
  readonly assistantText: string;
  readonly providerCallCount: number;
}

export async function runBrunchFauxTurn(
  options: BrunchFauxLauncherOptions = {},
): Promise<BrunchFauxLauncherResult> {
  const prompt = options.prompt ?? 'Run the Brunch faux harness smoke turn.';
  const responseText = options.responseText ?? 'Brunch faux harness turn complete.';
  const harness = await createBrunchFauxHarness({
    ...options,
    responses: options.responses ?? [fauxAssistantMessage(responseText)],
  });

  try {
    await harness.session.prompt(prompt, { expandPromptTemplates: false, source: 'rpc' });
    return {
      prompt,
      assistantText: latestAssistantText(harness.session.messages),
      providerCallCount: harness.provider.state.callCount,
    };
  } finally {
    harness.dispose();
  }
}

function latestAssistantText(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (!isRecord(message) || message.role !== 'assistant') continue;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    return content
      .flatMap((block) =>
        isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? [block.text] : [],
      )
      .join('\n');
  }
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
