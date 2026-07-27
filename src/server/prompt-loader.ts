import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const promptIds = [
  'interviewer.grounding',
  'interviewer.design',
  'interviewer.requirements',
  'interviewer.criteria',
  'observer.system',
  'side-chat.role',
  'web-research.system',
  'candidate-spec.system',
  'reconciliation.system',
  'reconciliation.classifier',
] as const;

export type PromptId = (typeof promptIds)[number];

type PromptVariables = Record<string, string | number | boolean | null | undefined>;

const promptAssetFiles = {
  'interviewer.grounding': 'interviewer-grounding.md',
  'interviewer.design': 'interviewer-design.md',
  'interviewer.requirements': 'interviewer-requirements.md',
  'interviewer.criteria': 'interviewer-criteria.md',
  'observer.system': 'observer-system.md',
  'side-chat.role': 'side-chat-role.md',
  'web-research.system': 'web-research-system.md',
  'candidate-spec.system': 'candidate-spec-system.md',
  'reconciliation.system': 'reconciliation-system.md',
  'reconciliation.classifier': 'reconciliation-classifier.md',
} satisfies Record<PromptId, string>;

const promptDirectory = join(dirname(fileURLToPath(import.meta.url)), 'prompts');
const promptCache = new Map<PromptId, string>();

export function getPromptAssetFileName(id: PromptId): string {
  const assetFile = promptAssetFiles[id];
  if (!assetFile) {
    throw new Error(`Unknown prompt asset: ${id}`);
  }
  return assetFile;
}

export function loadPromptAsset(id: PromptId): string {
  const assetFile = getPromptAssetFileName(id);

  const cached = promptCache.get(id);
  if (cached !== undefined) {
    return cached;
  }

  const prompt = readFileSync(join(promptDirectory, assetFile), 'utf8').replace(/\n+$/, '');
  promptCache.set(id, prompt);
  return prompt;
}

export function renderPromptAsset(id: PromptId, variables: PromptVariables = {}): string {
  const missingVariables = new Set<string>();
  const rendered = loadPromptAsset(id).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      missingVariables.add(key);
      return match;
    }
    return String(value);
  });

  if (missingVariables.size > 0) {
    throw new Error(`Missing prompt variables for ${id}: ${Array.from(missingVariables).sort().join(', ')}`);
  }

  return rendered;
}
