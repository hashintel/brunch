import { describe, expect, expectTypeOf, it } from 'vitest';

import { brunchDataPartSchemas, brunchValidationTools, type BrunchUITools } from './chat.js';

describe('C24a — secondary-chat tools in BrunchUITools', () => {
  it('registers propose_edit / propose_edge / propose_drill_down alongside interview tools', () => {
    expectTypeOf<BrunchUITools>().toHaveProperty('ask_question');
    expectTypeOf<BrunchUITools>().toHaveProperty('present_preface');
    expectTypeOf<BrunchUITools>().toHaveProperty('propose_phase_closure');
    expectTypeOf<BrunchUITools>().toHaveProperty('propose_edit');
    expectTypeOf<BrunchUITools>().toHaveProperty('propose_edge');
    expectTypeOf<BrunchUITools>().toHaveProperty('propose_drill_down');
  });

  it('exposes propose_* validation tools so validateUIMessages can accept them', () => {
    expect(brunchValidationTools).toHaveProperty('propose_edit');
    expect(brunchValidationTools).toHaveProperty('propose_edge');
    expect(brunchValidationTools).toHaveProperty('propose_drill_down');
  });
});

describe('C24a — edit-impact data part schema', () => {
  it('parses a well-formed { toolCallId, tier } payload', () => {
    const schema = brunchDataPartSchemas['edit-impact'];
    expect(schema).toBeDefined();
    const result = schema.safeParse({ toolCallId: 'tool-abc', tier: 'soft' });
    expect(result.success).toBe(true);
  });

  it('admits all three EditImpactTier values', () => {
    const schema = brunchDataPartSchemas['edit-impact'];
    for (const tier of ['none', 'soft', 'hard'] as const) {
      expect(schema.safeParse({ toolCallId: 't', tier }).success).toBe(true);
    }
  });

  it('rejects unknown tier values', () => {
    const schema = brunchDataPartSchemas['edit-impact'];
    expect(schema.safeParse({ toolCallId: 't', tier: 'catastrophic' }).success).toBe(false);
  });

  it('rejects missing toolCallId', () => {
    const schema = brunchDataPartSchemas['edit-impact'];
    expect(schema.safeParse({ tier: 'none' }).success).toBe(false);
  });
});
