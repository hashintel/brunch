import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { latestElicitationStyle } from '../../../../session/elicitation-style.js';
import { composeContextSeedContent } from '../../../contexts/seeds/origination.js';
import { composeLiveElicitorPrompt, type ComposeLiveElicitorPromptInput } from '../compose-live-prompt.js';

describe('elicitor control ownership', () => {
  it('keeps spec posture, elicitation style, and asking agenda on distinct owners and lifetimes', () => {
    const sessionTopology = readFileSync(new URL('../../../../session/TOPOLOGY.md', import.meta.url), 'utf8');
    const runtimeTopology = readFileSync(new URL('../TOPOLOGY.md', import.meta.url), 'utf8');
    const seedInput = {
      specId: 7,
      slice: { nodes: [], edges: [], lsn: 4 },
      scratchpad: [{ id: 'ask-1', obligation: 'confirm the audience', disposition: 'open' as const }],
      workspaceContext: '',
    };
    const withoutPosture = composeContextSeedContent(seedInput);
    const withPosture = composeContextSeedContent({
      ...seedInput,
      posture: { kind: 'feature' as const, origin: 'brownfield' as const, relatesToSpecId: 2 },
    });
    const style = latestElicitationStyle([styleEntry('interrogate'), styleEntry('propose')]);
    const promptInput = {
      sessionState: {
        operationalMode: 'specify',
        agentRole: 'elicitor',
        elicitationStyle: style ?? 'interrogate',
      },
      spec: { id: 7, name: 'Control map' },
      workspace: { cwd: '/work/control-map' },
    } satisfies ComposeLiveElicitorPromptInput;
    const proposePrompt = composeLiveElicitorPrompt(promptInput).prompt;
    const interrogatePrompt = composeLiveElicitorPrompt({
      ...promptInput,
      sessionState: { ...promptInput.sessionState, elicitationStyle: 'interrogate' as const },
    }).prompt;

    expect(withPosture).toContain('SPEC POSTURE');
    expect(withoutPosture).not.toContain('SPEC POSTURE');
    expect(style).toBe('propose');
    expect(proposePrompt).toContain('- elicitation style: propose');
    expect(proposePrompt).toContain('establish orientation first');
    expect(proposePrompt).toContain('focus a vein');
    expect(proposePrompt.replace('- elicitation style: propose', '- elicitation style: interrogate')).toBe(
      interrogatePrompt,
    );
    expect(withPosture).not.toContain('elicitation style');
    expect(withPosture).not.toContain('ASKING AGENDA');

    expect.soft(sessionTopology).toContain('## Agent control ownership');
    expect.soft(runtimeTopology).toContain('## Control ownership');
    expect.soft(sessionTopology).toMatch(/Spec posture.*spec-row.*spec lifetime/isu);
    expect.soft(sessionTopology).toMatch(/Elicitation style.*active branch.*session lifetime/isu);
    expect.soft(runtimeTopology).toMatch(/Asking agenda.*origination.*prompt conduct.*turn lifetime/isu);
  });
});

function styleEntry(style: 'interrogate' | 'disambiguate' | 'propose') {
  return {
    type: 'custom',
    customType: 'brunch.elicitation_style',
    data: { schemaVersion: 1, style },
  };
}
