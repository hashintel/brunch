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
      expect.objectContaining({
        id: 'spec.create',
        authority: 'commit_truth',
        inputSchema: 'spec.create.input.v1',
        outputSchema: 'spec.create.output.v1',
      }),
      expect.objectContaining({
        id: 'spec.getStatus',
        authority: 'read_only',
        inputSchema: 'spec.getStatus.input.v1',
        outputSchema: 'spec.getStatus.output.v1',
      }),
      expect.objectContaining({
        id: 'chat.getPrimary',
        authority: 'read_only',
        inputSchema: 'chat.getPrimary.input.v1',
        outputSchema: 'chat.getPrimary.output.v1',
      }),
      expect.objectContaining({
        id: 'chat.read',
        authority: 'read_only',
        inputSchema: 'chat.read.input.v1',
        outputSchema: 'chat.read.output.v1',
      }),
      expect.objectContaining({
        id: 'chat.ensureReady',
        authority: 'runtime_replay',
        inputSchema: 'chat.ensureReady.input.v1',
        outputSchema: 'chat.ensureReady.output.v1',
      }),
      expect.objectContaining({
        id: 'turn.submitResponse',
        authority: 'commit_truth',
        inputSchema: 'turn.submitResponse.input.v1',
        outputSchema: 'turn.submitResponse.output.v1',
      }),
    ]);
  });

  it('looks up contracts without exposing executable handlers', () => {
    expect(getCapabilityContract('workspace.readFile')).toEqual({
      id: 'workspace.readFile',
      authority: 'read_only',
      summary: 'Read a file from the workspace context.',
      inputSchema: 'workspace.readFile.input.v1',
      outputSchema: 'workspace.readFile.output.v1',
      handler: null,
    });
  });

  it('rejects unknown operation ids before scenario artifacts can reference them', () => {
    expect(() => requireCapabilityContracts(['workspace.readFile', 'turn.insert'])).toThrow(
      'Unknown Brunch capability ids: turn.insert',
    );
  });
});
