import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { AutocompleteItem, AutocompleteSuggestions } from '@earendil-works/pi-tui';

export interface GraphMentionCandidate {
  code: string;
  title: string;
  description?: string;
  plane?: 'intent' | 'oracle' | 'design' | 'plan';
}

export interface GraphMentionSource {
  listMentionCandidates(ctx: ExtensionContext): Promise<GraphMentionCandidate[]> | GraphMentionCandidate[];
}

const EMPTY_GRAPH_MENTION_SOURCE: GraphMentionSource = {
  listMentionCandidates: () => [],
};

export function registerBrunchMentionAutocomplete(
  pi: ExtensionAPI,
  source: GraphMentionSource = EMPTY_GRAPH_MENTION_SOURCE,
): void {
  pi.on('before_agent_start', async (event) => ({
    systemPrompt:
      event.systemPrompt +
      `\n\n[Brunch graph references]\n` +
      `- Tokens like #D12 are Brunch graph mention handles inserted as visible transcript text.\n` +
      `- Treat the inserted handle as the only durable reference; autocomplete labels/descriptions are UI-only and are not hidden metadata.\n` +
      `- Resolve deeper graph detail only through Brunch graph lookup/read tools when those are available.`,
  }));

  pi.on('session_start', async (_event, ctx) => {
    if (typeof ctx.ui.addAutocompleteProvider !== 'function') {
      return;
    }

    ctx.ui.addAutocompleteProvider((current) => ({
      async getSuggestions(lines, cursorLine, cursorCol, options) {
        const line = lines[cursorLine] ?? '';
        const prefix = extractHashPrefix(line, cursorCol);

        if (prefix === null) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const query = prefix.slice(1).toLowerCase();
        const candidates = await source.listMentionCandidates(ctx);
        const items: AutocompleteItem[] = candidates
          .filter((candidate) => candidateMatches(candidate, query))
          .map(candidateToAutocompleteItem);

        const result: AutocompleteSuggestions = { items, prefix };
        return result;
      },

      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        if (!prefix.startsWith('#')) {
          return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
        }

        const line = lines[cursorLine] ?? '';
        const before = line.slice(0, cursorCol);
        const after = line.slice(cursorCol);
        const newBefore = before.slice(0, -prefix.length) + item.value;
        return {
          lines: lines.map((candidateLine, index) =>
            index === cursorLine ? newBefore + after : candidateLine,
          ),
          cursorLine,
          cursorCol: newBefore.length,
        };
      },

      shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
        return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? false;
      },
    }));
  });
}

export function extractHashPrefix(line: string, cursorCol: number): string | null {
  const before = line.slice(0, cursorCol);
  const match = before.match(/(?:^|\s)(#[\w-]*)$/);
  return match?.[1] ?? null;
}

function candidateMatches(candidate: GraphMentionCandidate, query: string): boolean {
  if (query.length === 0) {
    return true;
  }
  return [candidate.code, candidate.title, candidate.description]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(query));
}

function candidateToAutocompleteItem(candidate: GraphMentionCandidate): AutocompleteItem {
  return {
    value: `#${candidate.code}`,
    label: `#${candidate.code} ${candidate.title}`,
    ...(candidate.description !== undefined ? { description: candidate.description } : {}),
  };
}

export default registerBrunchMentionAutocomplete;
