import { describe, expect, it } from 'vitest';

import { latestElicitationStyle } from '../../../../session/elicitation-style.js';
import { composeContextSeedContent } from '../../../contexts/seeds/origination.js';
import { composeLiveElicitorPrompt, type ComposeLiveElicitorPromptInput } from '../compose-live-prompt.js';

describe('elicitor control ownership', () => {
  const seedInput = {
    specId: 7,
    slice: { nodes: [], edges: [], lsn: 4 },
    scratchpad: [{ id: 'ask-1', obligation: 'confirm the audience', disposition: 'open' as const }],
    workspaceContext: '',
  };

  it('renders established persisted posture at origination without inventing it when absent', () => {
    const withoutPosture = composeContextSeedContent(seedInput);
    const withPosture = composeContextSeedContent({
      ...seedInput,
      posture: { kind: 'feature', origin: 'brownfield', relatesToSpecId: 2 },
    });

    expect(withPosture).toContain(
      'SPEC POSTURE\n- kind: feature\n- origin: brownfield\n- relates-to-spec: spec 2',
    );
    expect(withoutPosture).not.toContain('SPEC POSTURE');
    expect(withPosture).not.toContain('elicitation style');
  });

  it('projects the last active-branch style while changing no other prompt conduct', () => {
    const activeBranch = [styleEntry('interrogate'), styleEntry('propose')];
    const abandonedBranch = [styleEntry('interrogate'), styleEntry('disambiguate')];
    const style = latestElicitationStyle(activeBranch);
    const promptInput = promptInputFor(style ?? 'interrogate');
    const proposePrompt = composeLiveElicitorPrompt(promptInput).prompt;
    const interrogatePrompt = composeLiveElicitorPrompt(promptInputFor('interrogate')).prompt;

    expect(style).toBe('propose');
    expect(latestElicitationStyle(abandonedBranch)).toBe('disambiguate');
    expect(proposePrompt).toContain('- elicitation style: propose');
    expect(proposePrompt.replace('- elicitation style: propose', '- elicitation style: interrogate')).toBe(
      interrogatePrompt,
    );
  });

  it('directs asking conduct from neutral origination inputs without collapsed agenda state', () => {
    const seed = composeContextSeedContent(seedInput);
    const prompt = composeLiveElicitorPrompt(promptInputFor('interrogate')).prompt;

    expect(seed).toContain('confirm the audience');
    expect(seed).not.toContain('ASKING AGENDA');
    expect(prompt).toContain('never a scored or ranked agenda');
    expect(prompt).toContain('establish orientation first');
    expect(prompt).toContain('focus a vein');
  });
});

function promptInputFor(elicitationStyle: 'interrogate' | 'disambiguate' | 'propose') {
  return {
    sessionState: { operationalMode: 'specify', agentRole: 'elicitor', elicitationStyle },
    spec: { id: 7, name: 'Control map' },
    workspace: { cwd: '/work/control-map' },
  } satisfies ComposeLiveElicitorPromptInput;
}

function styleEntry(style: 'interrogate' | 'disambiguate' | 'propose') {
  return {
    type: 'custom',
    customType: 'brunch.elicitation_style',
    data: { schemaVersion: 1, style },
  };
}
