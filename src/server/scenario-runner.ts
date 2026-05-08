import type { ObserverCaptureContextPack } from './context-pack.js';
import { renderObserverCaptureContextPack } from './context-pack.js';
import { buildObserverSystemPrompt } from './observer-prompt.js';
import { getPromptAssetFileName, renderPromptAsset, type PromptId } from './prompt-loader.js';

export type PromptScenarioId = 'observer-capture';

export interface PromptScenarioModelSettings {
  provider: string;
  model: string;
  temperature?: number;
}

type PromptScenarioPromptSource =
  | {
      source: 'asset';
      id: PromptId;
    }
  | {
      source: 'composed';
      id: PromptId;
      rendered: string;
    };

export interface PromptScenarioDefinition {
  scenario: PromptScenarioId;
  prompt: PromptScenarioPromptSource;
  context: {
    scenario: PromptScenarioId;
    rendered: string;
    data?: unknown;
  };
  model: PromptScenarioModelSettings;
}

export interface PromptScenarioProbeArtifact {
  schemaVersion: 1;
  scenario: PromptScenarioId;
  prompt: {
    id: PromptId;
    asset: string;
    rendered: string;
  };
  context: PromptScenarioDefinition['context'];
  model: PromptScenarioModelSettings;
  execution: {
    status: 'not-run';
    rawOutput: null;
  };
  structuredParse: {
    status: 'not-run';
    value: null;
    error: null;
  };
  review: {
    notes: string[];
  };
}

function renderPromptScenarioPrompt(prompt: PromptScenarioPromptSource): string {
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

export function buildPromptScenarioProbeArtifact(
  definition: PromptScenarioDefinition,
): PromptScenarioProbeArtifact {
  return {
    schemaVersion: 1,
    scenario: definition.scenario,
    prompt: {
      id: definition.prompt.id,
      asset: getPromptAssetFileName(definition.prompt.id),
      rendered: renderPromptScenarioPrompt(definition.prompt),
    },
    context: definition.context,
    model: definition.model,
    execution: {
      status: 'not-run',
      rawOutput: null,
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

export function buildObserverCapturePromptScenario({
  contextPack,
  model,
}: {
  contextPack: ObserverCaptureContextPack;
  model: PromptScenarioModelSettings;
}): PromptScenarioDefinition {
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
  };
}

export function serializePromptScenarioProbeArtifact(artifact: PromptScenarioProbeArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
