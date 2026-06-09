import {
  registerFauxProvider,
  streamSimple,
  type FauxProviderRegistration,
  type FauxResponseStep,
} from '@earendil-works/pi-ai';
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ProviderConfig,
} from '@earendil-works/pi-coding-agent';

const FAUX_API_KEY = 'brunch-faux-harness-key';

export interface BrunchFauxModelOptions {
  readonly provider: string;
  readonly api: string;
  readonly modelId: string;
  readonly modelName: string;
}

export interface BrunchFauxHarnessOptions {
  readonly cwd?: string;
  readonly responses?: readonly FauxResponseStep[];
  readonly model?: Partial<BrunchFauxModelOptions>;
}

export interface BrunchFauxHarness {
  readonly session: AgentSession;
  readonly provider: FauxProviderRegistration;
  readonly model: BrunchFauxModelOptions;
  dispose(): void;
}

export function brunchFauxProviderConfig(
  model: BrunchFauxModelOptions,
  provider?: FauxProviderRegistration,
): ProviderConfig {
  return {
    api: model.api as never,
    baseUrl: 'https://example.invalid',
    apiKey: '$BRUNCH_FAUX_HARNESS_API_KEY',
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

export function defaultBrunchFauxModel(options: BrunchFauxHarnessOptions = {}): BrunchFauxModelOptions {
  return {
    provider: options.model?.provider ?? 'brunch-faux',
    api: options.model?.api ?? 'brunch-faux-api',
    modelId: options.model?.modelId ?? 'brunch-faux-model',
    modelName: options.model?.modelName ?? 'Brunch faux model',
  };
}

export async function createBrunchFauxHarness(
  options: BrunchFauxHarnessOptions = {},
): Promise<BrunchFauxHarness> {
  process.env.BRUNCH_FAUX_HARNESS_API_KEY ??= FAUX_API_KEY;

  const model = defaultBrunchFauxModel(options);
  const provider = registerFauxProvider({
    provider: model.provider,
    api: `${model.api}-faux-source`,
    models: [{ id: model.modelId, name: model.modelName, input: ['text'] }],
  });
  provider.setResponses([...(options.responses ?? [])]);

  const authStorage = AuthStorage.inMemory({
    [model.provider]: { type: 'api_key', key: FAUX_API_KEY },
  });
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  modelRegistry.registerProvider(model.provider, brunchFauxProviderConfig(model, provider));

  const registeredModel = modelRegistry.find(model.provider, model.modelId);
  if (!registeredModel) throw new Error(`Faux model was not registered: ${model.provider}/${model.modelId}`);

  const { session } = await createAgentSession({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    authStorage,
    modelRegistry,
    model: registeredModel,
    sessionManager: SessionManager.inMemory(options.cwd),
    settingsManager: SettingsManager.inMemory({ quietStartup: true }),
    noTools: 'all',
  });

  return {
    session,
    provider,
    model,
    dispose() {
      session.dispose();
      provider.unregister();
    },
  };
}
