import { fauxAssistantMessage } from '@earendil-works/pi-ai';

import { latestAssistantText } from './agent-messages.js';
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
