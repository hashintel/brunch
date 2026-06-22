import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';

const BRAVE_LLM_CONTEXT_URL = 'https://api.search.brave.com/res/v1/llm/context';

const DEFAULT_COUNT = 20;
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_MAX_URLS = 20;

type Freshness = string;
type Threshold = 'strict' | 'balanced' | 'lenient' | 'disabled';

export type WebSearchParams = {
  query: string;
  count?: number;
  freshness?: Freshness;
  maxTokens?: number;
  maxUrls?: number;
  threshold?: Threshold;
};

type BraveContextResult = {
  url: string;
  title: string;
  snippets: string[];
};

type BraveContextResponse = {
  grounding?: {
    generic?: BraveContextResult[];
    poi?: BraveContextResult | null;
    map?: BraveContextResult[];
  };
  sources?: Record<string, { title?: string; hostname?: string; age?: string[] | null }>;
};

const getBraveApiKey = (): string | undefined => process.env.BRAVE_API_KEY;

const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');

const formatTableValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const pushStructuredSnippet = (snippet: string, lines: string[]): boolean => {
  const clean = snippet.trim();
  if (!clean.startsWith('{') && !clean.startsWith('[')) return false;

  try {
    const parsed = JSON.parse(clean) as unknown;
    if (!parsed || typeof parsed !== 'object' || !('table' in parsed)) {
      lines.push(clean, '');
      return true;
    }

    const tableContainer = parsed as { caption?: unknown; table?: unknown };
    if (!Array.isArray(tableContainer.table) || tableContainer.table.length === 0) {
      lines.push(clean, '');
      return true;
    }

    const rows = tableContainer.table.filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row),
    );
    if (rows.length === 0) {
      lines.push(clean, '');
      return true;
    }

    if (typeof tableContainer.caption === 'string') lines.push(`**${tableContainer.caption}**`);

    const headers = Object.keys(rows[0]!);
    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    for (const row of rows) {
      lines.push(`| ${headers.map((header) => formatTableValue(row[header])).join(' | ')} |`);
    }
    lines.push('');
    return true;
  } catch {
    return false;
  }
};

export const formatBraveContext = (data: BraveContextResponse): string => {
  const sections: string[] = [];
  const sources = data.sources ?? {};

  for (const result of data.grounding?.generic ?? []) {
    const sourceInfo = sources[result.url];
    const age = sourceInfo?.age?.[2] ?? sourceInfo?.age?.[0] ?? '';
    const lines = [`## ${stripHtml(result.title)}`, `Source: ${result.url}${age ? ` (${age})` : ''}`, ''];

    for (const snippet of result.snippets) {
      const clean = snippet.trim();
      if (!clean) continue;

      if (!pushStructuredSnippet(clean, lines)) lines.push(stripHtml(clean), '');
    }

    sections.push(lines.join('\n'));
  }

  const poi = data.grounding?.poi;
  if (poi) {
    const lines = [`## ${stripHtml(poi.title)}`, `Source: ${poi.url}`, ''];
    for (const snippet of poi.snippets) lines.push(stripHtml(snippet.trim()), '');
    sections.push(lines.join('\n'));
  }

  const map = data.grounding?.map ?? [];
  if (map.length > 0) {
    const lines = ['### Map Results'];
    for (const result of map) {
      lines.push(`- ${stripHtml(result.title)} — ${result.url}`);
      for (const snippet of result.snippets.slice(0, 2)) lines.push(`  ${stripHtml(snippet.trim())}`);
    }
    sections.push(lines.join('\n'));
  }

  if (Object.keys(sources).length > 0) {
    const lines = ['### Sources'];
    for (const [url, info] of Object.entries(sources)) {
      const age = info.age?.[2] ?? info.age?.[0] ?? '';
      lines.push(`- ${info.hostname ?? url}${age ? ` (${age})` : ''}: ${url}`);
    }
    sections.push(lines.join('\n'));
  }

  return sections.length > 0 ? sections.join('\n\n---\n\n') : 'No results found.';
};

const searchBraveContext = async (params: WebSearchParams, signal?: AbortSignal): Promise<string> => {
  const apiKey = getBraveApiKey();
  if (!apiKey) throw new Error('Missing Brave API key. Set BRAVE_API_KEY in the environment.');

  const body: Record<string, unknown> = {
    q: params.query,
    count: params.count ?? DEFAULT_COUNT,
    maximum_number_of_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    maximum_number_of_urls: params.maxUrls ?? DEFAULT_MAX_URLS,
  };
  if (params.freshness) body.freshness = params.freshness;
  if (params.threshold) body.context_threshold_mode = params.threshold;

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Subscription-Token': apiKey,
    },
    body: JSON.stringify(body),
  };
  if (signal) requestInit.signal = signal;

  const response = await fetch(BRAVE_LLM_CONTEXT_URL, requestInit);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Brave LLM Context API ${response.status}: ${text.slice(0, 200)}`);
  }

  return formatBraveContext((await response.json()) as BraveContextResponse);
};

export function createWebSearchTool() {
  return {
    name: 'web_search',
    label: 'Web Search',
    description:
      'Search the web with Brave LLM Context and return pre-extracted page content optimized for LLM reasoning.',
    promptSnippet: 'Search the web and return extracted page content, tables, code, and source URLs.',
    promptGuidelines: [
      'Use web_search for current information, documentation, API references, errors, fact-checking, or anything needing fresh web data.',
      'Use web_search freshness filters for time-sensitive queries: pd for day, pw for week, pm for month, py for year.',
      'Use web_search maxTokens around 2048 for simple facts, 8192 for normal research, and 16384+ for deep research.',
    ],
    parameters: Type.Object({
      query: Type.String({ description: 'Search query, maximum 400 characters.' }),
      count: Type.Optional(
        Type.Number({
          description: 'Max search results to consider. Default 20, max 50.',
          minimum: 1,
          maximum: 50,
        }),
      ),
      freshness: Type.Optional(
        Type.Union(
          [Type.Literal('pd'), Type.Literal('pw'), Type.Literal('pm'), Type.Literal('py'), Type.String()],
          {
            description: 'Freshness: pd, pw, pm, py, or YYYY-MM-DDtoYYYY-MM-DD.',
          },
        ),
      ),
      maxTokens: Type.Optional(
        Type.Number({
          description: 'Maximum tokens of context to return. Default 8192, max 32768.',
          minimum: 1024,
          maximum: 32768,
        }),
      ),
      maxUrls: Type.Optional(
        Type.Number({
          description: 'Maximum URLs in response. Default 20, max 50.',
          minimum: 1,
          maximum: 50,
        }),
      ),
      threshold: Type.Optional(
        Type.Union(
          [
            Type.Literal('strict'),
            Type.Literal('balanced'),
            Type.Literal('lenient'),
            Type.Literal('disabled'),
          ],
          {
            description: 'Relevance filtering: strict, balanced, lenient, or disabled.',
          },
        ),
      ),
    }),
    async execute(_toolCallId: string, params: WebSearchParams, signal?: AbortSignal) {
      const text = await searchBraveContext(params, signal);
      return {
        content: [{ type: 'text' as const, text }],
        details: {
          query: params.query,
          count: params.count ?? DEFAULT_COUNT,
          maxTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
          maxUrls: params.maxUrls ?? DEFAULT_MAX_URLS,
        },
      };
    },
    renderCall(args: Partial<WebSearchParams>, theme: never, context: { lastComponent?: Text }) {
      const text = context.lastComponent ?? new Text('', 0, 0);
      const themeLike = theme as {
        fg: (kind: string, value: string) => string;
        bold: (value: string) => string;
      };
      const meta = [args.freshness, args.maxTokens ? `${args.maxTokens}tok` : undefined, args.threshold]
        .filter(Boolean)
        .join(', ');
      text.setText(
        themeLike.fg('toolTitle', themeLike.bold('search ')) +
          themeLike.fg('accent', args.query ?? '') +
          (meta ? themeLike.fg('dim', ` (${meta})`) : ''),
      );
      return text;
    },
    renderResult(
      result: { content: { type: string; text?: string }[] },
      options: { expanded: boolean; isPartial: boolean },
      theme: { fg: (kind: string, value: string) => string },
      context: { lastComponent?: Text; isError?: boolean },
    ) {
      const text = context.lastComponent ?? new Text('', 0, 0);
      if (options.isPartial) {
        text.setText(theme.fg('warning', 'Searching…'));
        return text;
      }
      if (context.isError) {
        const message = result.content.find((part) => part.type === 'text')?.text ?? 'Search failed';
        text.setText(theme.fg('error', message));
        return text;
      }
      const content = result.content.find((part) => part.type === 'text')?.text ?? '';
      const lines = content.split('\n');
      const previewLines = options.expanded ? lines.slice(0, 20) : lines.slice(0, 8);
      const remaining = Math.max(0, lines.length - previewLines.length);
      text.setText(
        previewLines.map((line) => theme.fg('dim', line)).join('\n') +
          (remaining > 0 ? theme.fg('muted', `\n… ${remaining} more lines`) : ''),
      );
      return text;
    },
  };
}
