import type { CapabilityProvider } from './capability-providers.js';
import type { CapabilityRequirement } from './execution-contract.js';
import type { PlanningCommitments } from './planning-projection.js';

const RECIPE_LINE = /^execute\.(setup|build|verify):\s*(.+)$/u;
const SHELL_OPERATORS = /[;&|<>$`"'\\*?~#()!]/u;

export type SpecRecipeKind = 'setup' | 'build' | 'verify';

export interface SpecRecipeIssue {
  readonly itemId: string;
  readonly line: string;
  readonly reason: string;
}

export interface SpecRecipeExtraction {
  readonly provider: CapabilityProvider | undefined;
  readonly required: readonly CapabilityRequirement[];
  readonly issues: readonly SpecRecipeIssue[];
}

export function extractSpecRecipe(commitments: PlanningCommitments): SpecRecipeExtraction {
  const actions: Record<SpecRecipeKind, { command: string; args: readonly string[] }[]> = {
    setup: [],
    build: [],
    verify: [],
  };
  const declaredBy: Record<SpecRecipeKind, string | undefined> = {
    setup: undefined,
    build: undefined,
    verify: undefined,
  };
  const issues: SpecRecipeIssue[] = [];

  if (commitments.executionHarnesses.length > 1) {
    return {
      provider: undefined,
      required: [],
      issues: commitments.executionHarnesses.map((node) => ({
        itemId: node.itemId,
        line: node.title,
        reason: 'multiple settled Project execution harness V&V methods declare command authority',
      })),
    };
  }

  for (const node of commitments.executionHarnesses) {
    for (const rawLine of node.content.split('\n')) {
      const line = rawLine.trim();
      const match = RECIPE_LINE.exec(line);
      if (!match) continue;
      const kind = match[1] as SpecRecipeKind;
      const commandText = match[2]!.trim();
      if (SHELL_OPERATORS.test(commandText)) {
        issues.push({
          itemId: node.itemId,
          line,
          reason: 'shell operators are not supported; declare one plain command per line',
        });
        continue;
      }
      const [command, ...args] = commandText.split(/\s+/u);
      if (!command) {
        issues.push({ itemId: node.itemId, line, reason: 'recipe line declares no command' });
        continue;
      }
      actions[kind].push({ command, args });
      declaredBy[kind] ??= node.itemId;
    }
  }

  const kinds = (['setup', 'build', 'verify'] as const).filter((kind) => actions[kind].length > 0);
  if (kinds.length === 0) return { provider: undefined, required: [], issues };

  return {
    provider: {
      id: 'spec-recipe',
      capabilities: Object.fromEntries(
        kinds.map((kind) => [
          `spec.${kind}`,
          {
            domain: kind === 'verify' ? 'verify-runner' : `spec-${kind}`,
            actions: {
              setup: kind === 'setup' ? actions.setup : [],
              build: kind === 'build' ? actions.build : [],
              verify: kind === 'verify' ? actions.verify : [],
            },
          },
        ]),
      ),
    },
    required: kinds.map((kind) => ({
      id: `spec.${kind}`,
      source: { kind: 'elicited', itemId: declaredBy[kind]! },
    })),
    issues,
  };
}
