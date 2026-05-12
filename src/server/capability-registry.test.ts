import { describe, expect, it } from 'vitest';

import {
  getCapabilityContract,
  listCapabilityContracts,
  requireCapabilityContracts,
} from './capability-registry.js';

describe('capability registry', () => {
  it('exposes canonical Brunch operation contracts with stable authority metadata', () => {
    expect(listCapabilityContracts()).toEqual([
      expect.objectContaining({
        id: 'workspace.readFile',
        authority: 'read_only',
      }),
      expect.objectContaining({
        id: 'workspace.search',
        authority: 'read_only',
      }),
      expect.objectContaining({
        id: 'web.search',
        authority: 'read_only',
      }),
      expect.objectContaining({
        id: 'web.fetchPage',
        authority: 'read_only',
      }),
      expect.objectContaining({
        id: 'intentGraph.validateEdge',
        authority: 'read_only',
      }),
      expect.objectContaining({
        id: 'scenario.render',
        authority: 'read_only',
      }),
      expect.objectContaining({
        id: 'observer.captureTurnIntent',
        authority: 'commit_truth',
      }),
      expect.objectContaining({
        id: 'changeset.submit',
        authority: 'proposal_only',
      }),
    ]);
  });

  it('looks up contracts without exposing executable handlers', () => {
    expect(getCapabilityContract('workspace.readFile')).toEqual({
      id: 'workspace.readFile',
      authority: 'read_only',
      summary: 'Read a file from the workspace context.',
      handler: null,
    });
  });

  it('rejects unknown operation ids before scenario artifacts can reference them', () => {
    expect(() => requireCapabilityContracts(['workspace.readFile', 'turn.insert'])).toThrow(
      'Unknown Brunch capability ids: turn.insert',
    );
  });
});
