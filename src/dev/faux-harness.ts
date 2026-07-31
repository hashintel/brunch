import type {
  AssistantMessage,
  Context,
  FauxProviderRegistration,
  FauxResponseFactory,
  FauxResponseStep,
  StreamOptions,
} from '@earendil-works/pi-ai';
import { registerFauxProvider } from '@earendil-works/pi-ai/compat';
import {
  createAgentSession,
  type ResourceLoader,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';

import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  createBrunchFauxModelRuntime,
  defaultBrunchFauxModel,
  type BrunchFauxModelOptions,
} from '../probes/faux-provider.js';

export {
  BRUNCH_FAUX_HARNESS_API_KEY,
  BRUNCH_FAUX_HARNESS_ENV_API_KEY,
  brunchFauxProviderConfig,
  createBrunchFauxModelRuntime,
  defaultBrunchFauxModel,
  type BrunchFauxModelOptions,
} from '../probes/faux-provider.js';

export interface BrunchFauxHarnessOptions {
  readonly cwd?: string;
  readonly responses?: readonly FauxResponseStep[];
  readonly model?: Partial<BrunchFauxModelOptions>;
  readonly customTools?: readonly ToolDefinition<any, any>[];
  readonly resourceLoader?: ResourceLoader;
  readonly settingsManager?: SettingsManager;
  readonly sessionManager?: SessionManager;
}

export interface ProviderContextSnapshot {
  readonly systemPrompt?: string;
  readonly messages: Context['messages'];
  readonly tools: NonNullable<Context['tools']>;
  readonly activeToolNames: readonly string[];
}

export interface BrunchFauxHarness {
  readonly session: AgentSession;
  readonly provider: FauxProviderRegistration;
  readonly model: BrunchFauxModelOptions;
  readonly providerContexts: readonly ProviderContextSnapshot[];
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
  const providerContexts: ProviderContextSnapshot[] = [];
  provider.setResponses(
    (options.responses ?? []).map((response) => captureFauxResponse(response, providerContexts)),
  );

  const { modelRuntime, registeredModel } = await createBrunchFauxModelRuntime(
    model,
    provider,
    BRUNCH_FAUX_HARNESS_API_KEY,
  );

  const { session } = await createAgentSession({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    modelRuntime,
    model: registeredModel,
    ...(options.resourceLoader ? { resourceLoader: options.resourceLoader } : {}),
    sessionManager: options.sessionManager ?? SessionManager.inMemory(options.cwd),
    settingsManager: options.settingsManager ?? SettingsManager.inMemory({ quietStartup: true }),
    ...(options.customTools?.length
      ? { tools: options.customTools.map((tool) => tool.name), customTools: [...options.customTools] }
      : options.resourceLoader
        ? {}
        : { noTools: 'all' as const }),
  });

  return {
    session,
    provider,
    model,
    providerContexts,
    dispose() {
      session.dispose();
      provider.unregister();
    },
  };
}

function captureFauxResponse(
  response: FauxResponseStep,
  providerContexts: ProviderContextSnapshot[],
): FauxResponseFactory {
  return async (context: Context, options: StreamOptions | undefined, state, model) => {
    providerContexts.push(snapshotProviderContext(context));
    return typeof response === 'function'
      ? response(context, options, state, model)
      : (response as AssistantMessage);
  };
}

export function snapshotProviderContext(context: Context): ProviderContextSnapshot {
  const tools = [...(context.tools ?? [])];
  return {
    ...(context.systemPrompt === undefined ? {} : { systemPrompt: context.systemPrompt }),
    messages: [...context.messages],
    tools,
    activeToolNames: tools.map((tool) => tool.name),
  };
}
