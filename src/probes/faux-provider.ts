import { streamSimple, type FauxProviderRegistration } from '@earendil-works/pi-ai';
import { type ProviderConfig } from '@earendil-works/pi-coding-agent';

export const BRUNCH_FAUX_HARNESS_API_KEY = 'brunch-faux-harness-key';
export const BRUNCH_FAUX_HARNESS_ENV_API_KEY = '$BRUNCH_FAUX_HARNESS_API_KEY';

export interface BrunchFauxModelOptions {
  readonly provider: string;
  readonly api: string;
  readonly modelId: string;
  readonly modelName: string;
}

export interface BrunchFauxModelContainer {
  readonly model?: Partial<BrunchFauxModelOptions>;
}

export function brunchFauxProviderConfig(
  model: BrunchFauxModelOptions,
  provider?: FauxProviderRegistration,
  apiKey: string = BRUNCH_FAUX_HARNESS_API_KEY,
): ProviderConfig {
  return {
    api: model.api as never,
    baseUrl: 'https://example.invalid',
    apiKey,
    ...(provider === undefined
      ? {}
      : {
          streamSimple: (requestModel, context, streamOptions) =>
            streamSimple(
              provider.getModel(requestModel.id) ?? provider.getModel(),
              context as never,
              streamOptions as never,
            ),
        }),
    models: [
      {
        id: model.modelId,
        name: model.modelName,
        api: model.api as never,
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 16384,
      },
    ],
  };
}

export function defaultBrunchFauxModel(options: BrunchFauxModelContainer = {}): BrunchFauxModelOptions {
  return {
    provider: options.model?.provider ?? 'brunch-faux',
    api: options.model?.api ?? 'brunch-faux-api',
    modelId: options.model?.modelId ?? 'brunch-faux-model',
    modelName: options.model?.modelName ?? 'Brunch faux model',
  };
}
