import { InMemoryCredentialStore, type FauxProviderRegistration } from '@earendil-works/pi-ai';
import { streamSimple } from '@earendil-works/pi-ai/compat';
import { ModelRegistry, ModelRuntime, type ProviderConfig } from '@earendil-works/pi-coding-agent';

export const BRUNCH_FAUX_HARNESS_API_KEY = 'brunch-faux-harness-key';
export const BRUNCH_FAUX_HARNESS_ENV_API_KEY = '$BRUNCH_FAUX_HARNESS_API_KEY';

export interface BrunchFauxModelOptions {
  readonly provider: string;
  readonly api: string;
  readonly modelId: string;
  readonly modelName: string;
  readonly contextWindow: number;
  readonly maxTokens: number;
}

export interface BrunchFauxModelContainer {
  readonly model?: Partial<BrunchFauxModelOptions>;
}

export async function createBrunchFauxModelRuntime(
  model: BrunchFauxModelOptions,
  provider?: FauxProviderRegistration,
  apiKey: string = BRUNCH_FAUX_HARNESS_API_KEY,
): Promise<{
  readonly modelRuntime: ModelRuntime;
  readonly modelRegistry: ModelRegistry;
  readonly registeredModel: NonNullable<ReturnType<ModelRuntime['getModel']>>;
}> {
  const modelRuntime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsPath: null,
  });
  modelRuntime.registerProvider(model.provider, brunchFauxProviderConfig(model, provider, apiKey));
  await modelRuntime.refresh({ allowNetwork: false });
  const registeredModel = modelRuntime.getModel(model.provider, model.modelId);
  if (!registeredModel) {
    throw new Error(`Faux model was not registered: ${model.provider}/${model.modelId}`);
  }
  return {
    modelRuntime,
    modelRegistry: new ModelRegistry(modelRuntime),
    registeredModel,
  };
}

export function brunchFauxProviderConfig(
  model: BrunchFauxModelOptions,
  provider?: FauxProviderRegistration,
  apiKey: string = BRUNCH_FAUX_HARNESS_API_KEY,
): ProviderConfig {
  const baseConfig: ProviderConfig = {
    api: model.api as never,
    baseUrl: 'https://example.invalid',
    apiKey,
    models: [
      {
        id: model.modelId,
        name: model.modelName,
        api: model.api as never,
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
      },
    ],
  };
  if (provider === undefined) return baseConfig;
  const configWithStream: ProviderConfig = {
    ...baseConfig,
    streamSimple(requestModel, context, streamOptions?) {
      return streamSimple(
        provider.getModel(requestModel.id) ?? provider.getModel(),
        context as never,
        streamOptions as never,
      );
    },
  };
  return configWithStream;
}

export function defaultBrunchFauxModel(options: BrunchFauxModelContainer = {}): BrunchFauxModelOptions {
  return {
    provider: options.model?.provider ?? 'brunch-faux',
    api: options.model?.api ?? 'brunch-faux-api',
    modelId: options.model?.modelId ?? 'brunch-faux-model',
    modelName: options.model?.modelName ?? 'Brunch faux model',
    contextWindow: options.model?.contextWindow ?? 128000,
    maxTokens: options.model?.maxTokens ?? 16384,
  };
}
