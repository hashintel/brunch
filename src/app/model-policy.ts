import { ModelRegistry, type CreateAgentSessionFromServicesOptions } from '@earendil-works/pi-coding-agent';

export type BrunchThinkingLevel = NonNullable<CreateAgentSessionFromServicesOptions['thinkingLevel']>;
export type BrunchModel = NonNullable<CreateAgentSessionFromServicesOptions['model']>;
export type BrunchScopedModel = NonNullable<CreateAgentSessionFromServicesOptions['scopedModels']>[number];

export interface BrunchModelAllowlistEntry {
  readonly provider: string;
  readonly model: string;
  readonly displayName: string;
  readonly thinkingLevel: BrunchThinkingLevel;
}

export const BRUNCH_MODEL_ALLOWLIST = [
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6 (Anthropic)',
    thinkingLevel: 'low',
  },
  {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.6',
    displayName: 'Claude Sonnet 4.6 (OpenRouter)',
    thinkingLevel: 'low',
  },
] as const satisfies readonly BrunchModelAllowlistEntry[];

export type BrunchModelPolicyResolution =
  | {
      readonly status: 'resolved';
      readonly entry: BrunchModelAllowlistEntry;
      readonly model: BrunchModel;
      readonly thinkingLevel: BrunchThinkingLevel;
    }
  | { readonly status: 'unresolved'; readonly reason: string };

function entryKey(entry: Pick<BrunchModelAllowlistEntry, 'provider' | 'model'>): string {
  return `${entry.provider}/${entry.model}`;
}

const ALLOWLIST_KEYS = new Set(BRUNCH_MODEL_ALLOWLIST.map(entryKey));

function isAllowlisted(provider: string, model: string): boolean {
  return ALLOWLIST_KEYS.has(`${provider}/${model}`);
}

function allowlistedModelsFrom(registry: ModelRegistry): BrunchModel[] {
  const models: BrunchModel[] = [];
  for (const entry of BRUNCH_MODEL_ALLOWLIST) {
    const model = registry.find(entry.provider, entry.model);
    if (model) models.push(model);
  }
  return models;
}

/**
 * Wrap Pi's registry so Brunch exposes only the code-owned model policy.
 * Custom `models.json` entries are deliberately not a Brunch product surface;
 * the app creates the base registry from built-ins plus auth and this wrapper
 * is the containment boundary for `/model` cycling and explicit lookups.
 */
export function createBrunchModelRegistry(registry: ModelRegistry): ModelRegistry {
  const brunchRegistry = Object.create(registry) as ModelRegistry;

  brunchRegistry.refresh = () => registry.refresh();
  brunchRegistry.getError = () => registry.getError();
  brunchRegistry.getAll = () => allowlistedModelsFrom(registry);
  brunchRegistry.getAvailable = () =>
    allowlistedModelsFrom(registry).filter((model) => registry.hasConfiguredAuth(model));
  brunchRegistry.find = (provider: string, modelId: string) =>
    isAllowlisted(provider, modelId) ? registry.find(provider, modelId) : undefined;
  brunchRegistry.hasConfiguredAuth = (model: BrunchModel) =>
    isAllowlisted(model.provider, model.id) && registry.hasConfiguredAuth(model);
  brunchRegistry.getApiKeyAndHeaders = (model: BrunchModel) => registry.getApiKeyAndHeaders(model);
  brunchRegistry.getProviderAuthStatus = (provider: string) => registry.getProviderAuthStatus(provider);
  brunchRegistry.getProviderDisplayName = (provider: string) => registry.getProviderDisplayName(provider);
  brunchRegistry.getApiKeyForProvider = (provider: string) => registry.getApiKeyForProvider(provider);
  brunchRegistry.isUsingOAuth = (model: BrunchModel) => registry.isUsingOAuth(model);
  brunchRegistry.registerProvider = (providerName, config) => registry.registerProvider(providerName, config);
  brunchRegistry.unregisterProvider = (providerName) => registry.unregisterProvider(providerName);

  return brunchRegistry;
}

export function getBrunchScopedModels(registry: ModelRegistry): BrunchScopedModel[] {
  return BRUNCH_MODEL_ALLOWLIST.flatMap((entry) => {
    const model = registry.find(entry.provider, entry.model);
    if (!model || !registry.hasConfiguredAuth(model)) return [];
    return [{ model, thinkingLevel: entry.thinkingLevel }];
  });
}

export function resolveBrunchModelPolicy(registry: ModelRegistry): BrunchModelPolicyResolution {
  for (const entry of BRUNCH_MODEL_ALLOWLIST) {
    const model = registry.find(entry.provider, entry.model);
    if (model && registry.hasConfiguredAuth(model)) {
      return { status: 'resolved', entry, model, thinkingLevel: entry.thinkingLevel };
    }
  }
  return { status: 'unresolved', reason: 'No configured auth for Brunch allowlisted models' };
}
