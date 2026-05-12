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
  | 'changeset.submit';

export interface CapabilityContract {
  id: CapabilityId;
  authority: CapabilityAuthority;
  summary: string;
  /**
   * Capability contracts are metadata only for now. Runtime handlers and adapter
   * tool projections must be introduced explicitly in later slices.
   */
  handler: null;
}

const capabilityContracts = [
  {
    id: 'workspace.readFile',
    authority: 'read_only',
    summary: 'Read a file from the workspace context.',
    handler: null,
  },
  {
    id: 'workspace.search',
    authority: 'read_only',
    summary: 'Search workspace files without mutating project or Brunch state.',
    handler: null,
  },
  {
    id: 'web.search',
    authority: 'read_only',
    summary: 'Search the web for current external context without mutating Brunch state.',
    handler: null,
  },
  {
    id: 'web.fetchPage',
    authority: 'read_only',
    summary: 'Fetch a web page for research context without mutating Brunch state.',
    handler: null,
  },
  {
    id: 'intentGraph.validateEdge',
    authority: 'read_only',
    summary: 'Validate an intent graph edge against relation policy without mutating graph truth.',
    handler: null,
  },
  {
    id: 'scenario.render',
    authority: 'read_only',
    summary: 'Render prompt scenario inputs into a reviewable probe artifact.',
    handler: null,
  },
  {
    id: 'observer.captureTurnIntent',
    authority: 'commit_truth',
    summary: 'Capture supported intent items and edges from a validated turn.',
    handler: null,
  },
  {
    id: 'changeset.submit',
    authority: 'proposal_only',
    summary: 'Submit proposed semantic graph changes for later validation and application.',
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
