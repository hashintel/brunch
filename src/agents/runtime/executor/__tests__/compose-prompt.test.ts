import { describe, expect, it } from 'vitest';

import { composeExecutorPrompt } from '../compose-prompt.js';

function composePrompt(): string {
  return composeExecutorPrompt({
    sessionState: { schemaVersion: 1, operationalMode: 'execute', agentRole: 'executor' },
    spec: { id: 1, name: 'Spec' },
    workspace: { cwd: '/tmp/brunch' },
    activeTools: ['read_graph', 'present_question', 'request_response', 'orchestrator_stub'],
  }).prompt;
}

describe('composeExecutorPrompt', () => {
  it('pins executor readiness conduct without restating the posture definitions', () => {
    const prompt = composePrompt();

    expect(prompt).toContain('state a capability-readiness posture before acting');
    expect(prompt).toContain('readiness-bands.md` §Agent Use');
    expect(prompt).toContain('accept the requested CODE-mode move');
    expect(prompt).toMatch(/do not bounce the user back to SPEC mode/i);
    expect(prompt).toContain('`project_plan` stays at frontier-level depth per D103-L');
    expect(prompt).toMatch(/`?orchestrator_stub`? is the honest execution boundary/);
    expect(prompt).toContain(
      '- readiness posture: assess seed reads before acting; bands guide conduct but never gate tool authority',
    );
    expect(prompt).not.toMatch(/narrow executor|narrow authority/i);
    expect(prompt).not.toMatch(/\*\*Proceed\*\* when/);
    expect(prompt).not.toMatch(/\*\*Proceed-advisory\*\* when/);
    expect(prompt).not.toMatch(/\*\*Negotiate\*\* when/);
    expect(prompt).not.toMatch(/\*\*Ask\*\* when/);
  });
});
