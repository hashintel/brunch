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

export interface BrunchNoAuthGuidanceCopy {
  readonly title: string;
  readonly lines: readonly string[];
  readonly body: string;
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

function allowlistedModelsFrom(
  findModel: (provider: string, modelId: string) => BrunchModel | undefined,
): BrunchModel[] {
  const models: BrunchModel[] = [];
  for (const entry of BRUNCH_MODEL_ALLOWLIST) {
    const model = findModel(entry.provider, entry.model);
    if (model) models.push(model);
  }
  return models;
}

/**
 * Contain Pi's registry so Brunch exposes only the code-owned model policy.
 * Custom `models.json` entries are deliberately not a Brunch product surface;
 * the app creates the base registry from built-ins plus auth and these
 * in-place overrides are the containment boundary for `/model` cycling and
 * explicit lookups. The registry instance stays stable so Pi-added methods keep
 * their original receiver identity across upgrades.
 */
export function createBrunchModelRegistry(registry: ModelRegistry): ModelRegistry {
  const base = {
    refresh: registry.refresh.bind(registry),
    getError: registry.getError.bind(registry),
    find: registry.find.bind(registry),
    hasConfiguredAuth: registry.hasConfiguredAuth.bind(registry),
    getApiKeyAndHeaders: registry.getApiKeyAndHeaders.bind(registry),
    getProviderAuthStatus: registry.getProviderAuthStatus.bind(registry),
    getProviderDisplayName: registry.getProviderDisplayName.bind(registry),
    getApiKeyForProvider: registry.getApiKeyForProvider.bind(registry),
    isUsingOAuth: registry.isUsingOAuth.bind(registry),
    registerProvider: registry.registerProvider.bind(registry),
    unregisterProvider: registry.unregisterProvider.bind(registry),
  };

  registry.refresh = () => base.refresh();
  registry.getError = () => base.getError();
  registry.getAll = () => allowlistedModelsFrom(base.find);
  registry.getAvailable = () =>
    allowlistedModelsFrom(base.find).filter((model) => base.hasConfiguredAuth(model));
  registry.find = (provider: string, modelId: string) =>
    isAllowlisted(provider, modelId) ? base.find(provider, modelId) : undefined;
  registry.hasConfiguredAuth = (model: BrunchModel) =>
    isAllowlisted(model.provider, model.id) && base.hasConfiguredAuth(model);
  registry.getApiKeyAndHeaders = (model: BrunchModel) => base.getApiKeyAndHeaders(model);
  registry.getProviderAuthStatus = (provider: string) => base.getProviderAuthStatus(provider);
  registry.getProviderDisplayName = (provider: string) => base.getProviderDisplayName(provider);
  registry.getApiKeyForProvider = (provider: string) => base.getApiKeyForProvider(provider);
  registry.isUsingOAuth = (model: BrunchModel) => base.isUsingOAuth(model);
  registry.registerProvider = (providerName, config) => base.registerProvider(providerName, config);
  registry.unregisterProvider = (providerName) => base.unregisterProvider(providerName);

  return registry;
}

export function getBrunchNoAuthGuidanceCopy(): BrunchNoAuthGuidanceCopy {
  const lines = [
    'Provider turns are disabled until auth is configured.',
    'Run brunch login, or use /login in this session.',
    'Brunch allowlist:',
    ...BRUNCH_MODEL_ALLOWLIST.map((entry) => `- ${entry.displayName}`),
  ];
  return {
    title: 'No Brunch model auth',
    lines,
    body: lines.join(' '),
  };
}

export function formatBrunchNoAuthGuidanceNotice(): string {
  const copy = getBrunchNoAuthGuidanceCopy();
  return `${copy.title}: ${copy.body}`;
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
