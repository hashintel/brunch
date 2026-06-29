import { describe, expect, it } from 'vitest';

import { BACKGROUND_SUBAGENT_IDS, loadSubagentDefinitions, subagentAgentsDir } from '../agents.js';

describe('subagent agent definitions', () => {
  it('loads background subagents through their explicit registry', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    expect([...definitions.keys()].sort()).toEqual([...BACKGROUND_SUBAGENT_IDS].sort());
  });
});
