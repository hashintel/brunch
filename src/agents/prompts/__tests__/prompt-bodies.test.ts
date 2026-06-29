import { describe, expect, it } from 'vitest';

import {
  BACKGROUND_SUBAGENT_IDS,
  loadSubagentDefinitions,
  subagentAgentsDir,
} from '../../../.pi/extensions/subagents/agents.js';

describe('agent prompt bodies', () => {
  it('loads background subagents through their explicit registry', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    expect([...definitions.keys()].sort()).toEqual([...BACKGROUND_SUBAGENT_IDS].sort());
  });
});
