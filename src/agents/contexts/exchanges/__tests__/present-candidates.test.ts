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
  it('renders candidate titles and user-rubric facets', () => {
    const markdown = formatPresentCandidates(projection());

    expect(markdown).toContain('# Which direction should we take?');
    expect(markdown).toContain('Pick one candidate.');
    expect(markdown).toContain('## 1. Local workbench');
    expect(markdown).toContain('**Core bet:** Make local graph work the thesis.');
    expect(markdown).toContain('**Best fit:** Keeps the POC focused.');
    expect(markdown).toContain('**Cost / complexity:** Requires owning local state clearly.');
    expect(markdown).toContain('**Covers well:** Covers chrome, transcript, and graph coherence.');
    expect(markdown).toContain('**Main risks:** Does not solve cloud collaboration.');
    expect(markdown).toContain('**Lock-in / constraints:** Commits to local-first semantics.');
    expect(markdown).toContain('**Recommendation:** Choose this for the POC.');
  });

  it('does not dump meta-rubric reasoning by default', () => {
    const markdown = formatPresentCandidates(projection());

    expect(markdown).not.toContain('legibility_cost_of_knowing');
    expect(markdown).not.toContain('Easy to inspect locally.');
    expect(markdown).not.toContain('failure_modes');
  });
});
