import {
  recognizeCapability,
  resolveCapabilityActions,
  type CapabilityProvider,
} from './capability-providers.js';

export type CapabilitySource =
  | { readonly kind: 'elicited'; readonly itemId: string }
  | { readonly kind: 'detected'; readonly path: string }
  | { readonly kind: 'default' };

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
  readonly reason: 'unsupported_capability';
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
  for (const requirement of [...args.required, ...args.detected]) {
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
