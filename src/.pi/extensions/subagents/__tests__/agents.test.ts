import { describe, expect, it } from 'vitest';

import { BACKGROUND_SUBAGENT_IDS, loadSubagentDefinitions, subagentAgentsDir } from '../agents.js';

describe('subagent agent definitions', () => {
  it('loads background subagents through their explicit registry', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    expect([...definitions.keys()].sort()).toEqual([...BACKGROUND_SUBAGENT_IDS].sort());
    expect(definitions.get('explorer')?.skills).toEqual(['analyze']);
    for (const definition of definitions.values()) {
      if (definition.skills.length > 0) expect(definition.tools).toContain('read');
    }
  });

  it('keeps planner repair instructions on the structured output contract', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    const planner = definitions.get('planner');

    expect(planner?.thinking).toBe('medium');
    expect(planner?.systemPrompt).toMatch(
      /fix every finding and submit the full corrected candidate through\s+`submit_candidate_plan`/i,
    );
    expect(planner?.systemPrompt).toMatch(/shared design.*foundation slice/i);
    expect(planner?.systemPrompt).toMatch(
      /empty greenfield target.*repository-root files.*one foundation slice.*preserve.*parallel/is,
    );
    expect(planner?.systemPrompt).toMatch(/foundation.*manifest.*lockfile.*build.*test.*dependencies/is);
    expect(planner?.systemPrompt).toMatch(/every other slice.*transitively depend.*foundation.*parallel/is);
    expect(planner?.systemPrompt).toMatch(
      /scope-bearing candidate.*foundation slice.*existing scope.*requirement.*criterion.*verification.*do not.*unscoped.*requirementless/is,
    );
    expect(planner?.systemPrompt).toMatch(
      /frontier-level criterion.*terminal.*transitively depends on every sibling/i,
    );
    expect(planner?.systemPrompt).not.toMatch(/return the full corrected JSON object/i);
  });

  it('keeps workers on cumulative public-contract behavior', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    const worker = definitions.get('worker');

    expect(worker?.systemPrompt).toMatch(
      /read the integrated worktree.*preserve.*public-contract behavior/is,
    );
    expect(worker?.systemPrompt).toMatch(/public interfaces.*test-only backdoors/is);
    expect(worker?.systemPrompt).toMatch(/never weaken, delete,\s+skip, or narrow existing tests/is);
    expect(worker?.systemPrompt).toMatch(/canonical project harness runs\s+after you return/is);
  });
});
