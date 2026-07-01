import { fileURLToPath } from 'node:url';

export const BUNDLED_AGENT_BODY_IDS = ['elicitor', 'executor'] as const;

export type BundledAgentBodyId = (typeof BUNDLED_AGENT_BODY_IDS)[number];

/** Filesystem home for bundled Brunch agent markdown bodies. */
export function bundledAgentBodyHome(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

export function bundledAgentBodyLocation(id: BundledAgentBodyId): string {
  return fileURLToPath(new URL(`./${id}.md`, import.meta.url));
}
