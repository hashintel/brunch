import { describe, expect, it } from 'vitest';

import { zPresentCandidatesDetails } from '../../schemas/index.js';
import { projectPresentCandidates } from '../present-candidates.js';

const candidateParams = {
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
};

describe('projectPresentCandidates', () => {
  it('projects params into valid present_candidates details', () => {
    const projection = projectPresentCandidates(candidateParams);

    expect(zPresentCandidatesDetails.parse(projection.details)).toEqual(projection.details);
    expect(projection.details).toMatchObject({
      schema: 'brunch.structured_exchange.present',
      v: 1,
      exchange_id: 'candidate-direction',
      tool_meta: { curr: 'present_candidates', next: 'ask' },
      display: { heading: 'Which direction should we take?', body: 'Pick one candidate.' },
      continuation: {
        tool: 'ask',
        params: {
          body: 'Which direction should we take?\n\nPick one candidate.',
          options: [
            {
              id: 'local-workbench',
              label: 'Local workbench',
              description: 'Choose this for the POC.',
            },
          ],
        },
      },
      candidates: [
        {
          id: 'local-workbench',
          title: 'Local workbench',
          user_rubric: {
            core_bet: 'Make local graph work the thesis.',
            recommendation: 'Choose this for the POC.',
          },
          meta_rubric: { commitment: 'Defers cloud concerns.' },
          graph_refs: [{ node_id: 'node-1' }],
        },
      ],
    });
  });

  it('normalizes display text without dropping candidate rubric facets', () => {
    const projection = projectPresentCandidates({
      ...candidateParams,
      heading: '  Candidate direction  ',
      body: '   ',
    });

    expect(projection.heading).toBe('Candidate direction');
    expect(projection.body).toBeUndefined();
    expect(projection.details.display).toEqual({ heading: 'Candidate direction' });
    expect(projection.details.candidates[0]?.user_rubric).toHaveProperty('lock_in_constraints');
  });
});
