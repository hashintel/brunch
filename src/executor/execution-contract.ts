import {
  recognizeCapability,
  resolveCapabilityActions,
  type CapabilityProvider,
} from './capability-providers.js';

export type CapabilitySource =
  | { readonly kind: 'elicited'; readonly itemId: string }
  | { readonly kind: 'detected'; readonly path: string };

export interface CapabilityRequirement {
  readonly id: string;
  readonly source: CapabilitySource;
}

export interface ResolvedContractAction {
  readonly capabilityId: string;
  readonly providerId: string;
  readonly command: string;
  readonly args: readonly string[];
}

export interface BlockedCapability {
  readonly id: string;
  readonly source: CapabilitySource;
  readonly reason: 'unsupported_capability' | 'malformed_recipe';
  readonly message?: string;
}

export interface ExecutionContractConflict {
  readonly domain: string;
  readonly requiredId: string;
  readonly detectedId: string;
  readonly message: string;
}

export interface ExecutionContract {
  readonly schemaVersion: 1;
  readonly requiredCapabilities: readonly CapabilityRequirement[];
  readonly detectedCapabilities: readonly CapabilityRequirement[];
  readonly resolvedActions: {
    readonly setup: readonly ResolvedContractAction[];
    readonly build: readonly ResolvedContractAction[];
    readonly verify: readonly ResolvedContractAction[];
  };
  readonly blocked: readonly BlockedCapability[];
  readonly conflicts: readonly ExecutionContractConflict[];
}

export type ResolvedExecutionActions = ExecutionContract['resolvedActions'];

export function isExecutionContract(value: unknown): value is ExecutionContract {
  if (!isRecord(value) || value['schemaVersion'] !== 1) return false;
  if (
    !isArrayOf(value['requiredCapabilities'], isCapabilityRequirement) ||
    !isArrayOf(value['detectedCapabilities'], isCapabilityRequirement) ||
    !isArrayOf(value['blocked'], isBlockedCapability) ||
    !isArrayOf(value['conflicts'], isExecutionContractConflict)
  ) {
    return false;
  }
  const actions = value['resolvedActions'];
  return isResolvedExecutionActions(actions);
}

export function isResolvedExecutionActions(value: unknown): value is ResolvedExecutionActions {
  return (
    isRecord(value) &&
    isArrayOf(value['setup'], isResolvedContractAction) &&
    isArrayOf(value['build'], isResolvedContractAction) &&
    isArrayOf(value['verify'], isResolvedContractAction)
  );
}

export function deriveExecutionContract(args: {
  readonly required: readonly CapabilityRequirement[];
  readonly detected: readonly CapabilityRequirement[];
  readonly providers: readonly CapabilityProvider[];
}): ExecutionContract {
  const blocked: BlockedCapability[] = [];
  const conflicts: ExecutionContractConflict[] = [];
  const requiredByDomain = new Map<string, string>();
  const detectedByDomain = new Map<string, string>();

  for (const requirement of args.required) {
    const recognition = recognizeCapability(args.providers, requirement.id);
    if (!recognition) {
      blocked.push({ id: requirement.id, source: requirement.source, reason: 'unsupported_capability' });
      continue;
    }
    if (!requiredByDomain.has(recognition.domain)) requiredByDomain.set(recognition.domain, requirement.id);
  }
  for (const fact of args.detected) {
    const recognition = recognizeCapability(args.providers, fact.id);
    // Detection reports facts; an unrecognized fact informs nothing and blocks nothing.
    if (!recognition) continue;
    if (!detectedByDomain.has(recognition.domain)) detectedByDomain.set(recognition.domain, fact.id);
  }

  for (const [domain, requiredId] of requiredByDomain) {
    const detectedId = detectedByDomain.get(domain);
    if (detectedId === undefined || detectedId === requiredId) continue;
    conflicts.push({
      domain,
      requiredId,
      detectedId,
      message: `Required capability ${requiredId} and detected capability ${detectedId} disagree in domain ${domain}.`,
    });
  }

  const conflictedDomains = new Set(conflicts.map((conflict) => conflict.domain));
  const contributingIds: string[] = [];
  const seen = new Set<string>();
  // Detection is evidence for admission, never authority to execute a command.
  for (const requirement of args.required) {
    const recognition = recognizeCapability(args.providers, requirement.id);
    if (!recognition || conflictedDomains.has(recognition.domain) || seen.has(requirement.id)) continue;
    seen.add(requirement.id);
    contributingIds.push(requirement.id);
  }

  const setup: ResolvedContractAction[] = [];
  const build: ResolvedContractAction[] = [];
  const verify: ResolvedContractAction[] = [];
  for (const capabilityId of contributingIds) {
    const recognition = recognizeCapability(args.providers, capabilityId);
    const actions = resolveCapabilityActions(args.providers, capabilityId);
    if (!recognition || !actions) continue;
    const materialize = (templates: readonly { command: string; args: readonly string[] }[]) =>
      templates.map((template) => ({
        capabilityId,
        providerId: recognition.providerId,
        command: template.command,
        args: [...template.args],
      }));
    setup.push(...materialize(actions.setup));
    build.push(...materialize(actions.build));
    verify.push(...materialize(actions.verify));
  }

  return {
    schemaVersion: 1,
    requiredCapabilities: args.required,
    detectedCapabilities: args.detected,
    resolvedActions: { setup, build, verify },
    blocked,
    conflicts,
  };
}

function isCapabilityRequirement(value: unknown): value is CapabilityRequirement {
  return isRecord(value) && isNonBlankString(value['id']) && isCapabilitySource(value['source']);
}

function isCapabilitySource(value: unknown): value is CapabilitySource {
  if (!isRecord(value)) return false;
  if (value['kind'] === 'elicited') return isNonBlankString(value['itemId']);
  return value['kind'] === 'detected' && isNonBlankString(value['path']);
}

function isResolvedContractAction(value: unknown): value is ResolvedContractAction {
  return (
    isRecord(value) &&
    isNonBlankString(value['capabilityId']) &&
    isNonBlankString(value['providerId']) &&
    isNonBlankString(value['command']) &&
    Array.isArray(value['args']) &&
    value['args'].every((argument) => typeof argument === 'string')
  );
}

function isBlockedCapability(value: unknown): value is BlockedCapability {
  return (
    isRecord(value) &&
    isNonBlankString(value['id']) &&
    isCapabilitySource(value['source']) &&
    (value['reason'] === 'unsupported_capability' || value['reason'] === 'malformed_recipe') &&
    (value['message'] === undefined || typeof value['message'] === 'string')
  );
}

function isExecutionContractConflict(value: unknown): value is ExecutionContractConflict {
  return (
    isRecord(value) &&
    isNonBlankString(value['domain']) &&
    isNonBlankString(value['requiredId']) &&
    isNonBlankString(value['detectedId']) &&
    isNonBlankString(value['message'])
  );
}

function isArrayOf<T>(value: unknown, predicate: (entry: unknown) => entry is T): value is readonly T[] {
  return Array.isArray(value) && value.every(predicate);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
