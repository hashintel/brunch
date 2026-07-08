import { describe, expect, it } from 'vitest';

import { composeLiveElicitorPrompt } from '../../elicitor/compose-live-prompt.js';
import { composeExecutorPrompt } from '../compose-prompt.js';

function composePrompt(): string {
  return composeExecutorPrompt({
    sessionState: { schemaVersion: 1, operationalMode: 'execute', agentRole: 'executor' },
    spec: { id: 1, name: 'Spec' },
    workspace: { cwd: '/tmp/brunch' },
    activeTools: [
      'read_graph',
      'present_question',
      'request_response',
      'execute_status',
      'execute_orchestrate',
    ],
  }).prompt;
}

describe('composeExecutorPrompt', () => {
  it('pins executor readiness conduct without restating the posture definitions', () => {
    const prompt = composePrompt();

    expect(prompt).toContain('state a capability-readiness posture before acting');
    expect(prompt).toContain('readiness-bands.md` §Agent Use');
    expect(prompt).toContain('accept the requested Execute-mode move');
    expect(prompt).toMatch(/do not bounce the user back to Specify mode/i);
    expect(prompt).toContain('`project_plan` stays at frontier-level depth per D103-L');
    expect(prompt).toMatch(/live execution boundary is the `execute_\*` tool family/);
    expect(prompt).toContain('explicit-acceptance `execute_host_promotion_preflight`');
    expect(prompt).toContain(
      '- readiness posture: assess seed reads before acting; bands guide conduct but never gate tool authority',
    );
    expect(prompt).not.toMatch(/narrow executor|narrow authority/i);
    expect(prompt).not.toMatch(/\*\*Proceed\*\* when/);
    expect(prompt).not.toMatch(/\*\*Proceed-advisory\*\* when/);
    expect(prompt).not.toMatch(/\*\*Negotiate\*\* when/);
    expect(prompt).not.toMatch(/\*\*Ask\*\* when/);
  });

  it('shares the elicitor static reference-resource surface', () => {
    const executorPrompt = composePrompt();
    const elicitorPrompt = composeLiveElicitorPrompt({
      sessionState: { operationalMode: 'specify', agentRole: 'elicitor' },
      spec: { id: 1, name: 'Spec' },
      workspace: { cwd: '/tmp/brunch' },
      activeTools: ['read_graph', 'present_question', 'request_response'],
    }).prompt;

    const sharedReferenceNames = referenceNamesFrom(elicitorPrompt);

    expect(sharedReferenceNames).toEqual([
      'data-model',
      'node-neighbourhoods',
      'product-concept',
      'readiness-bands',
    ]);
    expect(referenceNamesFrom(executorPrompt)).toEqual(sharedReferenceNames);
    expect(executorPrompt).not.toContain('Twenty-four kinds across four planes');
    expect(executorPrompt).not.toContain('An edge-local neighborhood is a stronger context object');
  });
});

function referenceNamesFrom(prompt: string): string[] {
  return [...prompt.matchAll(/<reference>\s*<name>([^<]+)<\/name>/g)].map((match) => match[1] ?? '');
}
