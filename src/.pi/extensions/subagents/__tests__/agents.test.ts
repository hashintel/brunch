import { describe, expect, it } from 'vitest';

import { BACKGROUND_SUBAGENT_IDS, loadSubagentDefinitions, subagentAgentsDir } from '../agents.js';

describe('subagent agent definitions', () => {
  it('loads background subagents through their explicit registry', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    expect([...definitions.keys()].sort()).toEqual([...BACKGROUND_SUBAGENT_IDS].sort());
  });

  it('keeps planner repair instructions on the structured output contract', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    const planner = definitions.get('planner');

    expect(planner?.systemPrompt).toMatch(
      /fix every finding and submit the full corrected candidate through\s+`submit_candidate_plan`/i,
    );
    expect(planner?.systemPrompt).not.toMatch(/return the full corrected JSON object/i);
  });
});
