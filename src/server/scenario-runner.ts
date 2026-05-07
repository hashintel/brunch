import { getPromptAssetFileName, loadPromptAsset, type PromptId } from './prompt-loader.js';

export type PromptScenarioId = 'observer-capture';

export interface PromptScenarioModelSettings {
  provider: string;
  model: string;
  temperature?: number;
}

export interface PromptScenarioDefinition {
  scenario: PromptScenarioId;
  prompt: {
    id: PromptId;
  };
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

export function buildPromptScenarioProbeArtifact(
  definition: PromptScenarioDefinition,
): PromptScenarioProbeArtifact {
  return {
    schemaVersion: 1,
    scenario: definition.scenario,
    prompt: {
      id: definition.prompt.id,
      asset: getPromptAssetFileName(definition.prompt.id),
      rendered: loadPromptAsset(definition.prompt.id),
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

export function serializePromptScenarioProbeArtifact(artifact: PromptScenarioProbeArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
