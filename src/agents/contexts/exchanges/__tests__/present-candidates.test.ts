import { describe, expect, it } from 'vitest';

import { projectPresentCandidates } from '../../../../exchanges/projections/present-candidates.js';
import { projectRequestChoice } from '../../../../exchanges/projections/request-response.js';
import { formatPresentCandidates, PRESENT_CANDIDATES_CONTENT_ELISIONS } from '../present-candidates.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';
import { formatRequestChoice } from '../request-response.js';

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
  it('locks transcript-shaped candidate tuples', async () => {
    const present = projection();
    const selectedChoice = projectRequestChoice({
      exchangeId: 'candidate-direction',
      respondsToPresentTool: 'present_candidates',
      status: 'answered',
      choice: { id: 'local-workbench', label: 'Local workbench', kind: 'listed' },
      options: [{ id: 'local-workbench', content: 'Local workbench' }],
    });
    expect(selectedChoice.tool_meta).toEqual({
      prev: 'present_candidates',
      curr: 'request_choice',
      next: 'capture_candidate',
    });
    const markdown = [
      section('candidate selected', formatPresentCandidates(present), formatRequestChoice(selectedChoice)),
      section(
        'candidate unavailable',
        formatPresentCandidates(present),
        formatRequestChoice(
          projectRequestChoice({
            exchangeId: 'candidate-direction',
            respondsToPresentTool: 'present_candidates',
            status: 'unavailable',
            message: 'ask choice requires interactive UI',
          }),
        ),
      ),
    ].join('\n\n');

    await expect(markdown).toMatchFileSnapshot('../__snapshots__/candidates-tuples.md');
  });

  it('does not dump meta-rubric reasoning by default', () => {
    const markdown = formatPresentCandidates(projection());

    expect(markdown).not.toContain('legibility_cost_of_knowing');
    expect(markdown).not.toContain('failure_modes');
  });

  it('declares every details leaf as rendered or intentionally elided', () => {
    const present = projection();
    const content = formatPresentCandidates(present);

    expect(
      missingRenderedDetailsLeaves(present.details, content, {
        elisions: PRESENT_CANDIDATES_CONTENT_ELISIONS,
      }),
    ).toEqual([]);
  });
});

function section(label: string, ...entries: readonly string[]): string {
  return [`# ${label}`, ...entries].join('\n\n');
}
