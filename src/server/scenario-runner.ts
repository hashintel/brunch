import { createHash } from 'node:crypto';

import {
  requireCapabilityContracts,
  type CapabilityContract,
  type CapabilityId,
} from './capability-registry.js';
import type {
  CandidateSpecContextPack,
  CandidateSpecContextPackData,
  ObserverCaptureContextPack,
  ObserverCaptureContextPackData,
  ReconciliationContextPack,
  ReconciliationContextPackData,
  WebResearchContextPack,
  WebResearchContextPackData,
} from './context-pack.js';
import {
  renderCandidateSpecContextPack,
  renderObserverCaptureContextPack,
  renderReconciliationContextPack,
  renderWebResearchContextPack,
} from './context-pack.js';
import { buildObserverSystemPrompt } from './observer-prompt.js';
import { getPromptAssetFileName, renderPromptAsset, type PromptId } from './prompt-loader.js';

export type PromptScenarioId = 'observer-capture' | 'web-research' | 'candidate-spec' | 'reconciliation';

export interface PromptScenarioModelSettings {
  provider: string;
  model: string;
  temperature?: number;
}

type PromptScenarioPromptSource<TPromptId extends PromptId> =
  | {
      source: 'asset';
      id: TPromptId;
    }
  | {
      source: 'composed';
      id: TPromptId;
      rendered: string;
    };

type PromptScenarioContext<TScenario extends PromptScenarioId, TData> = {
  scenario: TScenario;
  rendered: string;
  data: TData;
};

interface PromptScenarioDefinitionBase<
  TScenario extends PromptScenarioId,
  TPromptId extends PromptId,
  TData,
> {
  scenario: TScenario;
  prompt: PromptScenarioPromptSource<TPromptId>;
  context: PromptScenarioContext<TScenario, TData>;
  model: PromptScenarioModelSettings;
  capabilities?: string[];
}

export type ObserverCapturePromptScenarioDefinition = PromptScenarioDefinitionBase<
  'observer-capture',
  'observer.system',
  ObserverCaptureContextPackData
>;

export type WebResearchPromptScenarioDefinition = PromptScenarioDefinitionBase<
  'web-research',
  'web-research.system',
  WebResearchContextPackData
>;

export type CandidateSpecPromptScenarioDefinition = PromptScenarioDefinitionBase<
  'candidate-spec',
  'candidate-spec.system',
  CandidateSpecContextPackData
>;

export type ReconciliationPromptScenarioDefinition = PromptScenarioDefinitionBase<
  'reconciliation',
  'reconciliation.system',
  ReconciliationContextPackData
>;

export type PromptScenarioDefinition =
  | ObserverCapturePromptScenarioDefinition
  | WebResearchPromptScenarioDefinition
  | CandidateSpecPromptScenarioDefinition
  | ReconciliationPromptScenarioDefinition;

type PromptScenarioExecutionResult =
  | {
      status: 'not-run';
      rawOutput: null;
      error: null;
    }
  | {
      status: 'succeeded';
      rawOutput: string;
      error: null;
    }
  | {
      status: 'failed';
      rawOutput: null;
      error: string;
    };

type PromptScenarioStructuredParseResult =
  | {
      status: 'not-run';
      value: null;
      error: null;
    }
  | {
      status: 'not-applicable';
      value: null;
      error: null;
    };

type PromptScenarioContextArtifact = PromptScenarioDefinition['context'] & {
  fingerprint: string;
};

export interface PromptScenarioProbeArtifact {
  schemaVersion: 2;
  scenario: PromptScenarioId;
  prompt: {
    id: PromptId;
    asset: string;
    rendered: string;
    fingerprint: string;
  };
  context: PromptScenarioContextArtifact;
  model: PromptScenarioModelSettings;
  capabilities: CapabilityContract[];
  execution: PromptScenarioExecutionResult;
  structuredParse: PromptScenarioStructuredParseResult;
  review: {
    notes: string[];
  };
}

export interface PromptScenarioModelAdapterInput {
  scenario: PromptScenarioId;
  prompt: PromptScenarioProbeArtifact['prompt'];
  context: PromptScenarioProbeArtifact['context'];
  model: PromptScenarioModelSettings;
  capabilities: CapabilityContract[];
}

export type PromptScenarioModelAdapter = (
  input: PromptScenarioModelAdapterInput,
) => Promise<{ text: string }>;

function renderPromptScenarioPrompt(prompt: PromptScenarioDefinition['prompt']): string {
  if (prompt.source === 'composed') {
    return prompt.rendered;
  }

  try {
    return renderPromptAsset(prompt.id);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`Missing prompt variables for ${prompt.id}:`)) {
      throw new Error(`Prompt scenario asset source ${prompt.id} contains unresolved template variables`, {
        cause: error,
      });
    }
    throw error;
  }
}

function fingerprintRenderedContent(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export function buildPromptScenarioProbeArtifact(
  definition: PromptScenarioDefinition,
): PromptScenarioProbeArtifact {
  const renderedPrompt = renderPromptScenarioPrompt(definition.prompt);

  return {
    schemaVersion: 2,
    scenario: definition.scenario,
    prompt: {
      id: definition.prompt.id,
      asset: getPromptAssetFileName(definition.prompt.id),
      rendered: renderedPrompt,
      fingerprint: fingerprintRenderedContent(renderedPrompt),
    },
    context: {
      ...definition.context,
      fingerprint: fingerprintRenderedContent(definition.context.rendered),
    },
    model: definition.model,
    capabilities: requireCapabilityContracts(definition.capabilities ?? []),
    execution: {
      status: 'not-run',
      rawOutput: null,
      error: null,
    },
    structuredParse: {
      status: 'not-run',
      value: null,
      error: null,
    },
    review: {
      notes: [],
    },
  };
}

const observerCaptureDefaultCapabilities: CapabilityId[] = [
  'workspace.readFile',
  'workspace.search',
  'intentGraph.validateEdge',
  'scenario.render',
];

const webResearchDefaultCapabilities: CapabilityId[] = ['web.search', 'web.fetchPage', 'scenario.render'];

const candidateSpecDefaultCapabilities: CapabilityId[] = ['scenario.render'];

const reconciliationDefaultCapabilities: CapabilityId[] = ['scenario.render', 'intentGraph.validateEdge'];

export function buildObserverCapturePromptScenario({
  contextPack,
  model,
}: {
  contextPack: ObserverCaptureContextPack;
  model: PromptScenarioModelSettings;
}): ObserverCapturePromptScenarioDefinition {
  return {
    scenario: 'observer-capture',
    prompt: {
      source: 'composed',
      id: 'observer.system',
      rendered: buildObserverSystemPrompt(contextPack.data.currentTurn.phase),
    },
    context: {
      scenario: 'observer-capture',
      rendered: renderObserverCaptureContextPack(contextPack),
      data: contextPack.data,
    },
    model,
    capabilities: observerCaptureDefaultCapabilities,
  };
}

export function buildCandidateSpecPromptScenario({
  contextPack,
  model,
}: {
  contextPack: CandidateSpecContextPack;
  model: PromptScenarioModelSettings;
}): CandidateSpecPromptScenarioDefinition {
  return {
    scenario: 'candidate-spec',
    prompt: {
      source: 'asset',
      id: 'candidate-spec.system',
    },
    context: {
      scenario: 'candidate-spec',
      rendered: renderCandidateSpecContextPack(contextPack),
      data: contextPack.data,
    },
    model,
    capabilities: candidateSpecDefaultCapabilities,
  };
}

export function buildReconciliationPromptScenario({
  contextPack,
  model,
}: {
  contextPack: ReconciliationContextPack;
  model: PromptScenarioModelSettings;
}): ReconciliationPromptScenarioDefinition {
  return {
    scenario: 'reconciliation',
    prompt: {
      source: 'asset',
      id: 'reconciliation.system',
    },
    context: {
      scenario: 'reconciliation',
      rendered: renderReconciliationContextPack(contextPack),
      data: contextPack.data,
    },
    model,
    capabilities: reconciliationDefaultCapabilities,
  };
}

export function buildWebResearchPromptScenario({
  contextPack,
  model,
}: {
  contextPack: WebResearchContextPack;
  model: PromptScenarioModelSettings;
}): WebResearchPromptScenarioDefinition {
  return {
    scenario: 'web-research',
    prompt: {
      source: 'asset',
      id: 'web-research.system',
    },
    context: {
      scenario: 'web-research',
      rendered: renderWebResearchContextPack(contextPack),
      data: contextPack.data,
    },
    model,
    capabilities: webResearchDefaultCapabilities,
  };
}

const sensitiveErrorPattern = /(?:sk-(?:ant|proj|live|test)[\w-]*|api[_-]?key\s*[=:]\s*\S+|bearer\s+\S+)/i;

function executionErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Provider execution failed with a non-Error rejection.';
  }

  if (sensitiveErrorPattern.test(error.message)) {
    return 'Provider execution failed with sensitive details redacted.';
  }

  return error.message;
}

export async function executeWebResearchPromptScenario(
  definition: WebResearchPromptScenarioDefinition,
  adapter: PromptScenarioModelAdapter,
): Promise<PromptScenarioProbeArtifact> {
  const artifact = buildPromptScenarioProbeArtifact(definition);

  try {
    const result = await adapter({
      scenario: artifact.scenario,
      prompt: artifact.prompt,
      context: artifact.context,
      model: artifact.model,
      capabilities: artifact.capabilities,
    });

    return {
      ...artifact,
      execution: {
        status: 'succeeded',
        rawOutput: result.text,
        error: null,
      },
      structuredParse: {
        status: 'not-applicable',
        value: null,
        error: null,
      },
    };
  } catch (error) {
    return {
      ...artifact,
      execution: {
        status: 'failed',
        rawOutput: null,
        error: executionErrorMessage(error),
      },
      structuredParse: {
        status: 'not-applicable',
        value: null,
        error: null,
      },
    };
  }
}

export function serializePromptScenarioProbeArtifact(artifact: PromptScenarioProbeArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
