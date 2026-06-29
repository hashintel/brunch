import { describe, expect, it } from 'vitest';

import { projectPresentCandidates } from '../../../../projections/exchanges/present-candidates.js';
import { formatPresentCandidates } from '../present-candidates.js';

function projection() {
  return projectPresentCandidates({
    exchangeId: 'candidate-direction',
    heading: 'Which direction should we take?',
    body: 'Pick one candidate.',
    candidates: [
      {
        id: 'local-workbench',
        title: 'Local workbench',
        user_rubric: {
          core_bet: 'Make local graph work the thesis.',
          best_fit: 'Keeps the POC focused.',
          cost_complexity: 'Requires owning local state clearly.',
          covers_well: 'Covers chrome, transcript, and graph coherence.',
          main_risks: 'Does not solve cloud collaboration.',
          lock_in_constraints: 'Commits to local-first semantics.',
          recommendation: 'Choose this for the POC.',
        },
        meta_rubric: {
          legibility_cost_of_knowing: 'Easy to inspect locally.',
          failure_modes: 'May under-test multi-user cases.',
          coverage_range: 'Strong for current assumptions.',
          commitment: 'Defers cloud concerns.',
        },
        graph_refs: [{ node_id: 'node-1' }],
      },
    ],
  });
}

describe('formatPresentCandidates', () => {
  it('renders candidate titles and user-rubric facets', async () => {
    const markdown = formatPresentCandidates(projection());

    await expect(markdown).toMatchFileSnapshot('../__snapshots__/present-candidates.md');
  });

  it('does not dump meta-rubric reasoning by default', () => {
    const markdown = formatPresentCandidates(projection());

    expect(markdown).not.toContain('legibility_cost_of_knowing');
    expect(markdown).not.toContain('failure_modes');
  });
});
