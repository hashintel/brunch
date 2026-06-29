import { fileURLToPath } from 'node:url';

export const BUNDLED_AGENT_BODY_IDS = ['elicitor', 'executor'] as const;

export type BundledAgentBodyId = (typeof BUNDLED_AGENT_BODY_IDS)[number];

/** Filesystem home for bundled Brunch agent markdown bodies. */
export function bundledAgentBodyHome(): string {
  return fileURLToPath(new URL('./prompts', import.meta.url));
}

/** Repo-relative path used by manifest bodies that are read later by the Pi runtime. */
export function bundledAgentBodyRepoPath(id: BundledAgentBodyId): string {
  return `src/agents/prompts/${id}.md`;
}

export function bundledAgentBodyLocation(id: BundledAgentBodyId): string {
  return fileURLToPath(new URL(`./prompts/${id}.md`, import.meta.url));
}
