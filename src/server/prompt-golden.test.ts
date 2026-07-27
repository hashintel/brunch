// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { buildObserverSystemPrompt } from './observer-prompt.js';
import { renderPromptAsset } from './prompt-loader.js';
import { buildSideChatPrompt } from './side-chat-prompt.js';

const phasePromptCases = [
  ['grounding', 'interviewer.grounding'],
  ['design', 'interviewer.design'],
  ['requirements', 'interviewer.requirements'],
  ['criteria', 'interviewer.criteria'],
] as const;

describe('production prompt golden coverage', () => {
  it.each(phasePromptCases)('preserves the full rendered %s interviewer prompt', async (phase, promptId) => {
    await expect(renderPromptAsset(promptId)).toMatchFileSnapshot(
      `__snapshots__/prompts/interviewer-${phase}.md`,
    );
  });

  it('preserves the full rendered observer prompt with interpolation', async () => {
    await expect(buildObserverSystemPrompt('design')).toMatchFileSnapshot(
      '__snapshots__/prompts/observer-design.md',
    );
  });

  it('preserves the full rendered side-chat prompt with interpolation', async () => {
    const prompt = buildSideChatPrompt(
      {
        kind: 'decision',
        referenceCode: 'D7',
        content: 'Candidate sets are turn-owned proposal artifacts.',
        rationale: 'Keeps generated directions inside the normal turn lineage.',
      },
      'What does this rule out?',
      {
        specName: 'Prompt substrate',
        groundingSummary: 'Brunch needs prompt probes before UI commitment.',
      },
      [
        { role: 'user', text: 'Help me understand this decision.' },
        { role: 'assistant', text: 'It keeps proposal review separate from accepted truth.' },
      ],
      {
        activeAnnotations: [
          {
            referenceCode: 'D7',
            snapshot: 'turn-owned proposal artifacts',
            body: 'User is focused on provenance.',
          },
        ],
        spanHint: 'proposal artifacts',
      },
    );

    await expect(`${JSON.stringify(prompt, null, 2)}\n`).toMatchFileSnapshot(
      '__snapshots__/prompts/side-chat.json',
    );
  });
});
