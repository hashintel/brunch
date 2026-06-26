import { fileURLToPath } from 'node:url';

export const BUNDLED_AGENT_BODY_IDS = [
  'elicitor',
  'executor',
  'explorer',
  'researcher',
  'projector',
  'reviewer',
  'pi-coder',
] as const;

export type BundledAgentBodyId = (typeof BUNDLED_AGENT_BODY_IDS)[number];
export type PromptResourceFamily = 'strategies' | 'lenses' | 'methods';

/** Filesystem home for bundled Brunch agent markdown bodies. */
export function bundledAgentBodyHome(): string {
  return fileURLToPath(new URL('./prompts', import.meta.url));
}

/** Repo-relative path used by manifest bodies that are read later by the Pi runtime. */
export function bundledAgentBodyRepoPath(id: BundledAgentBodyId): string {
  return `src/agents/prompts/${id}/SYSTEM.md`;
}

export function bundledAgentBodyLocation(id: BundledAgentBodyId): string {
  return fileURLToPath(new URL(`./prompts/${id}/SYSTEM.md`, import.meta.url));
}

/** Agent directory passed to Pi's Agent Skills loader for Brunch prompt resources. */
export function promptResourceAgentDir(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

export function promptResourceLocation(family: PromptResourceFamily, id: string): string {
  return fileURLToPath(new URL(`./skills/${family}/${id}/SKILL.md`, import.meta.url));
}
