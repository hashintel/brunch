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

export function capabilityVocabulary(providers: readonly CapabilityProvider[]): readonly string[] {
  return providers.flatMap((provider) => Object.keys(provider.capabilities)).sort();
}
