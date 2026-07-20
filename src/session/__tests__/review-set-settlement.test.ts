import { describe, expect, it, vi } from 'vitest';

import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import type { CommandExecutor } from '../../graph/command-executor.js';
import { settleReviewSetResponse } from '../review-set-settlement.js';

const payload = {
  schemaVersion: 1 as const,
  lens: 'intent' as const,
  epistemicStatus: 'asserted' as const,
  grounding: { summary: 'Exact persisted proposal', support: ['transcript'] },
  pitch: { title: 'Atomic proposal', narrative: 'Accept exactly this node.' },
  entityDrafts: [
    {
      draftId: 'req-1',
      proposedCode: 'REQ1',
      settlement: 'settled' as const,
      plane: 'intent' as const,
      kind: 'requirement' as const,
      title: 'Atomic acceptance',
    },
  ],
  edgeDrafts: [],
};

function present() {
  return projectPresentReviewSet({ exchangeId: 'review-1', payload }).details;
}

describe('review-set settlement core contract', () => {
  it('commits the exact persisted batch before minting its receipt-bearing terminal', () => {
    const acceptReviewSet = vi.fn(
      (
        _input: Parameters<CommandExecutor['acceptReviewSet']>[0],
      ): ReturnType<CommandExecutor['acceptReviewSet']> => ({
        status: 'success' as const,
        lsn: 2,
        createdNodes: { 'req-1': { id: 1, code: 'REQ1' } },
        createdEdges: [],
        updatedNodes: [],
        updatedEdges: [],
        deletedNodes: [],
        deletedEdges: [],
      }),
    );
    const result = settleReviewSetResponse({
      persistedPresent: present(),
      decision: 'approve',
      specId: 1,
      commandExecutor: { acceptReviewSet },
    });
    expect(result.status).toBe('settled');
    expect(acceptReviewSet).toHaveBeenCalledOnce();
    expect(acceptReviewSet.mock.calls[0]![0].payload).toEqual(
      expect.objectContaining({ entityDrafts: payload.entityDrafts }),
    );
    if (result.status === 'settled') {
      expect(result.content).toContain('LSN 2');
      expect(result.details).toMatchObject({ answered: { decision: 'approve', receipt: result.accepted } });
      if ('answered' in result.details && 'receipt' in result.details.answered) {
        expect(result.details.answered.receipt).toBe(result.accepted);
      }
    }
  });

  it('fails closed for malformed persisted state and never commits non-approval terminals', () => {
    const acceptReviewSet = vi.fn();
    expect(
      settleReviewSetResponse({
        persistedPresent: {},
        decision: 'approve',
        specId: 1,
        commandExecutor: { acceptReviewSet },
      }).status,
    ).toBe('structural_illegal');
    const changes = settleReviewSetResponse({
      persistedPresent: present(),
      decision: 'request_changes',
      comment: 'Revise it',
      specId: 1,
      commandExecutor: { acceptReviewSet },
    });
    const rejected = settleReviewSetResponse({
      persistedPresent: present(),
      decision: 'reject',
      specId: 1,
      commandExecutor: { acceptReviewSet },
    });
    expect(changes.status).toBe('terminal');
    expect(rejected.status).toBe('terminal');
    if (changes.status === 'terminal') expect(changes.details).not.toHaveProperty('answered.receipt');
    if (rejected.status === 'terminal') expect(rejected.details).not.toHaveProperty('answered.receipt');
    expect(acceptReviewSet).not.toHaveBeenCalled();
  });
});
