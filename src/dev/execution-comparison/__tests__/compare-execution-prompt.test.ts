import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const promptPath = fileURLToPath(new URL('../../../../.pi/prompts/compare-execution.md', import.meta.url));

describe('/compare-execution operator prompt', () => {
  it('continues without a turn boundary when exactly one case is eligible', async () => {
    const prompt = await readFile(promptPath, 'utf8');

    expect(prompt).toContain('If exactly one case is eligible, select it and continue in this turn');
    expect(prompt).toContain('Only ask the operator to choose when more than one case is eligible');
    expect(prompt).toContain('If no case is eligible, report that and stop');
  });

  it('requires complete setup disclosure and approval before any launch', async () => {
    const prompt = await readFile(promptPath, 'utf8');
    const disclosure = prompt.indexOf('## Display the complete setup');
    const approval = prompt.indexOf('explicit **approve**');
    const launch = prompt.indexOf('## Run approved lanes');

    expect(disclosure).toBeGreaterThan(-1);
    expect(approval).toBeGreaterThan(disclosure);
    expect(launch).toBeGreaterThan(approval);
    expect(prompt).toContain('complete frozen `spec.md`');
    expect(prompt).toContain('complete frozen `public-contract.json`');
    expect(prompt).toContain('exact shared target-visible framing');
    expect(prompt).toContain('run identity');
    expect(prompt).toContain('output paths');
  });

  it('pins sequential isolated lifecycle, cleanup, and the no-landing boundary', async () => {
    const prompt = await readFile(promptPath, 'utf8');

    expect(prompt).toContain('exactly one executor lane live at a time');
    expect(prompt).toContain('fresh isolated target cwd');
    expect(prompt).toContain(
      'Do not launch the next lane until the prior executor shell and oracle resources are both fully clean',
    );
    expect(prompt).toContain('`promotion_prepared`');
    expect(prompt).toContain('Never invoke `/brunch:land`');
    expect(prompt).toContain('spawn: { agent: "claude" }');
  });

  it('retains every terminal outcome and evaluates it with the unchanged oracle', async () => {
    const prompt = await readFile(promptPath, 'utf8');

    expect(prompt).toContain('successful, failed, exhausted, and invalid');
    expect(prompt).toContain('immutably');
    expect(prompt).toContain('process status');
    expect(prompt).toContain('final tree and complete base-to-tip diff');
    expect(prompt).toContain('visible interaction evidence');
    expect(prompt).toContain('`petri-editor-browser-v2`');
    expect(prompt).toContain('after every lane terminates');
    expect(prompt).toContain('Present validity before outcomes');
    expect(prompt).toContain('Do not score');
    expect(prompt).toContain('diagnostic-only');
  });
});
