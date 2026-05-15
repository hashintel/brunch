export type CapabilityAuthority =
  | 'read_only'
  | 'provisional_artifact'
  | 'proposal_only'
  | 'commit_truth'
  | 'commit_process_debt'
  | 'runtime_replay';

export type CapabilityId =
  | 'workspace.readFile'
  | 'workspace.search'
  | 'web.search'
  | 'web.fetchPage'
  | 'intentGraph.validateEdge'
  | 'scenario.render'
  | 'observer.captureTurnIntent'
  | 'changeset.submit'
  | 'spec.create'
  | 'spec.getStatus'
  | 'chat.getPrimary'
  | 'chat.read'
  | 'chat.ensureReady'
  | 'turn.submitResponse';

export interface CapabilityContract {
  id: CapabilityId;
  authority: CapabilityAuthority;
  summary: string;
  inputSchema: string;
  outputSchema: string;
  /**
   * Capability contracts carry transport-safe metadata here. Executable handlers
   * live behind the capability dispatcher so adapters do not own product semantics.
   */
  handler: null;
}

const capabilityContracts = [
  {
    id: 'workspace.readFile',
    authority: 'read_only',
    summary: 'Read a file from the workspace context.',
    inputSchema: 'workspace.readFile.input.v1',
    outputSchema: 'workspace.readFile.output.v1',
    handler: null,
  },
  {
    id: 'workspace.search',
    authority: 'read_only',
    summary: 'Search workspace files without mutating project or Brunch state.',
    inputSchema: 'workspace.search.input.v1',
    outputSchema: 'workspace.search.output.v1',
    handler: null,
  },
  {
    id: 'web.search',
    authority: 'read_only',
    summary: 'Search the web for current external context without mutating Brunch state.',
    inputSchema: 'web.search.input.v1',
    outputSchema: 'web.search.output.v1',
    handler: null,
  },
  {
    id: 'web.fetchPage',
    authority: 'read_only',
    summary: 'Fetch a web page for research context without mutating Brunch state.',
    inputSchema: 'web.fetchPage.input.v1',
    outputSchema: 'web.fetchPage.output.v1',
    handler: null,
  },
  {
    id: 'intentGraph.validateEdge',
    authority: 'read_only',
    summary: 'Validate an intent graph edge against relation policy without mutating graph truth.',
    inputSchema: 'intentGraph.validateEdge.input.v1',
    outputSchema: 'intentGraph.validateEdge.output.v1',
    handler: null,
  },
  {
    id: 'scenario.render',
    authority: 'read_only',
    summary: 'Render prompt scenario inputs into a reviewable probe artifact.',
    inputSchema: 'scenario.render.input.v1',
    outputSchema: 'scenario.render.output.v1',
    handler: null,
  },
  {
    id: 'observer.captureTurnIntent',
    authority: 'commit_truth',
    summary: 'Capture supported intent items and edges from a validated turn.',
    inputSchema: 'observer.captureTurnIntent.input.v1',
    outputSchema: 'observer.captureTurnIntent.output.v1',
    handler: null,
  },
  {
    id: 'changeset.submit',
    authority: 'proposal_only',
    summary: 'Submit proposed semantic graph changes for later validation and application.',
    inputSchema: 'changeset.submit.input.v1',
    outputSchema: 'changeset.submit.output.v1',
    handler: null,
  },
  {
    id: 'spec.create',
    authority: 'commit_truth',
    summary: 'Create a new Brunch specification in the local project store.',
    inputSchema: 'spec.create.input.v1',
    outputSchema: 'spec.create.output.v1',
    handler: null,
  },
  {
    id: 'spec.getStatus',
    authority: 'read_only',
    summary: 'Read the current workflow and active-path projection for an explicit specification id.',
    inputSchema: 'spec.getStatus.input.v1',
    outputSchema: 'spec.getStatus.output.v1',
    handler: null,
  },
  {
    id: 'chat.getPrimary',
    authority: 'read_only',
    summary: 'Read the primary interview chat identity for an explicit specification id.',
    inputSchema: 'chat.getPrimary.input.v1',
    outputSchema: 'chat.getPrimary.output.v1',
    handler: null,
  },
  {
    id: 'chat.read',
    authority: 'read_only',
    summary: 'Read a compact agent-facing projection for an explicit chat id.',
    inputSchema: 'chat.read.input.v1',
    outputSchema: 'chat.read.output.v1',
    handler: null,
  },
  {
    id: 'chat.ensureReady',
    authority: 'commit_truth',
    summary: 'Ensure an explicit chat has an answerable generated frontier.',
    inputSchema: 'chat.ensureReady.input.v1',
    outputSchema: 'chat.ensureReady.output.v1',
    handler: null,
  },
  {
    id: 'turn.submitResponse',
    authority: 'commit_truth',
    summary: 'Submit a structured response to an explicit chat turn.',
    inputSchema: 'turn.submitResponse.input.v1',
    outputSchema: 'turn.submitResponse.output.v1',
    handler: null,
  },
] as const satisfies readonly CapabilityContract[];

const capabilityContractsById = new Map<CapabilityId, CapabilityContract>(
  capabilityContracts.map((contract) => [contract.id, contract]),
);

export function listCapabilityContracts(): CapabilityContract[] {
  return [...capabilityContracts];
}

export function getCapabilityContract(id: CapabilityId): CapabilityContract {
  const contract = capabilityContractsById.get(id);
  if (!contract) {
    throw new Error(`Unknown Brunch capability id: ${id}`);
  }
  return contract;
}

function isCapabilityId(id: string): id is CapabilityId {
  return capabilityContractsById.has(id as CapabilityId);
}

export function requireCapabilityContracts(ids: readonly string[]): CapabilityContract[] {
  const capabilityIds: CapabilityId[] = [];
  const unknownIds: string[] = [];

  for (const id of ids) {
    if (isCapabilityId(id)) {
      capabilityIds.push(id);
    } else {
      unknownIds.push(id);
    }
  }

  if (unknownIds.length > 0) {
    throw new Error(`Unknown Brunch capability ids: ${unknownIds.join(', ')}`);
  }
  return capabilityIds.map((id) => getCapabilityContract(id));
}
