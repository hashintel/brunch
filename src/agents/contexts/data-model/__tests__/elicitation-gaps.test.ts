import { describe, expect, it } from 'vitest';

import { presenceGap } from '../../../../graph/schema/elicitation-gap-fixtures.js';
import { formatElicitationAgenda, formatElicitationUpdateResult } from '../elicitation-gaps.js';

describe('elicitation context text', () => {
  it('renders agenda and non-agenda gaps with stable semantic markers', () => {
    const rendered = formatElicitationAgenda(
      [presenceGap({ refersTo: 'constraint', coverage: 0.25, band: 'grounding', importance: 3 })],
      [presenceGap({ refersTo: 'goal', coverage: 1, band: 'elicitation', answered: true })],
    );

    expect(rendered).toContain('[Elicitation agenda] 1 open question(s), ranked:');
    expect(rendered).toContain('refers to: constraint · band: grounding · importance: 3 · coverage: 0.25');
    expect(rendered).toContain('[Not on the agenda] 1 gap(s):');
    expect(rendered).toContain('(answered)');
  });

  it('renders structural-illegal diagnostics for update failures', () => {
    const rendered = formatElicitationUpdateResult(
      {
        status: 'structural_illegal',
        diagnostics: [{ field: 'predicate', message: 'Unsupported predicate arm.' }],
      },
      'spawn',
    );

    expect(rendered).toBe('STRUCTURAL_ILLEGAL\n- predicate: Unsupported predicate arm.');
  });
});
