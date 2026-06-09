import {
  registerFauxProvider,
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
} from '@earendil-works/pi-coding-agent';

import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  brunchFauxProviderConfig,
  defaultBrunchFauxModel,
  type BrunchFauxModelOptions,
} from '../probes/faux-provider.js';

export {
  BRUNCH_FAUX_HARNESS_API_KEY,
  BRUNCH_FAUX_HARNESS_ENV_API_KEY,
  brunchFauxProviderConfig,
  defaultBrunchFauxModel,
  type BrunchFauxModelOptions,
} from '../probes/faux-provider.js';

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

export async function createBrunchFauxHarness(
  options: BrunchFauxHarnessOptions = {},
): Promise<BrunchFauxHarness> {
  const model = defaultBrunchFauxModel(options);
  const provider = registerFauxProvider({
    provider: model.provider,
    api: `${model.api}-faux-source`,
    models: [{ id: model.modelId, name: model.modelName, input: ['text'] }],
  });
  provider.setResponses([...(options.responses ?? [])]);

  const authStorage = AuthStorage.inMemory({
    [model.provider]: { type: 'api_key', key: BRUNCH_FAUX_HARNESS_API_KEY },
  });
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  modelRegistry.registerProvider(
    model.provider,
    brunchFauxProviderConfig(model, provider, BRUNCH_FAUX_HARNESS_API_KEY),
  );

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
