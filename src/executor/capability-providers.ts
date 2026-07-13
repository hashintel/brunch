export interface CapabilityActionTemplate {
  readonly command: string;
  readonly args: readonly string[];
}

export interface CapabilityActionSet {
  readonly setup: readonly CapabilityActionTemplate[];
  readonly build: readonly CapabilityActionTemplate[];
  readonly verify: readonly CapabilityActionTemplate[];
}

export interface CapabilityDefinition {
  readonly domain: string;
  readonly actions: CapabilityActionSet;
}

export interface CapabilityProvider {
  readonly id: string;
  readonly capabilities: Readonly<Record<string, CapabilityDefinition>>;
}

export interface CapabilityRecognition {
  readonly providerId: string;
  readonly domain: string;
}

export function recognizeCapability(
  providers: readonly CapabilityProvider[],
  capabilityId: string,
): CapabilityRecognition | undefined {
  for (const provider of providers) {
    const definition = provider.capabilities[capabilityId];
    if (definition) return { providerId: provider.id, domain: definition.domain };
  }
  return undefined;
}

export function resolveCapabilityActions(
  providers: readonly CapabilityProvider[],
  capabilityId: string,
): CapabilityActionSet | undefined {
  for (const provider of providers) {
    const definition = provider.capabilities[capabilityId];
    if (definition) return definition.actions;
  }
  return undefined;
}

const NODE_NPM_PROVIDER: CapabilityProvider = {
  id: 'node-npm',
  capabilities: {
    'node.npm': {
      domain: 'js-package-manager',
      actions: { setup: [{ command: 'npm', args: ['install'] }], build: [], verify: [] },
    },
    'node.npm-test': {
      domain: 'verify-runner',
      actions: { setup: [], build: [], verify: [{ command: 'npm', args: ['test'] }] },
    },
    'node.npm-verify': {
      domain: 'verify-runner',
      actions: { setup: [], build: [], verify: [{ command: 'npm', args: ['run', 'verify'] }] },
    },
  },
};

// ceiling: one built-in provider (node/npm); the provider list becomes composition-injected
// when a second ecosystem or project-specific harness lands (FE-1197 slice B).
export function defaultCapabilityProviders(): readonly CapabilityProvider[] {
  return [NODE_NPM_PROVIDER];
}
