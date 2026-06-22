import { Text } from '@earendil-works/pi-tui';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { Type } from 'typebox';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 20 * 1024 * 1024;
const MIN_USEFUL_CONTENT = 500;
const DEFAULT_MAX_CHARS = 40_000;
const JINA_READER_BASE = 'https://r.jina.ai/';
const JINA_TIMEOUT_MS = 30_000;

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

export type WebFetchParams = {
  url: string;
  maxChars?: number;
  useJinaFallback?: boolean;
};

type FetchResult = {
  url: string;
  title: string;
  content: string;
  error: string | null;
};

type Cleanup = () => void;

const withTimeoutSignal = (
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: Cleanup } => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  parentSignal?.addEventListener('abort', abort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abort);
    },
  };
};

const truncateContent = (content: string, maxChars: number): string => {
  if (content.length <= maxChars) return content;

  const cutPoint = content.lastIndexOf('\n\n', maxChars);
  const end = cutPoint > Math.floor(maxChars * 0.5) ? cutPoint : maxChars;
  return `${content.slice(0, end).trim()}\n\n[... truncated to ${maxChars} characters ...]`;
};

const isPdf = (url: string, contentType?: string): boolean => {
  if (contentType?.includes('application/pdf')) return true;
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
};

const isUnsupportedContentType = (contentType: string): boolean =>
  contentType.includes('application/octet-stream') ||
  contentType.includes('image/') ||
  contentType.includes('audio/') ||
  contentType.includes('video/') ||
  contentType.includes('application/zip');

const extractHeadingTitle = (text: string): string | null => {
  const match = text.match(/^#{1,2}\s+(.+)/m);
  if (!match) return null;

  const cleaned = match[1]?.replace(/\*+/g, '').trim();
  return cleaned || null;
};

const getTitleFromUrl = (url: string): string => {
  try {
    const pathPart = new URL(url).pathname.split('/').filter(Boolean).pop();
    return pathPart?.replace(/[_-]+/g, ' ').trim() || url;
  } catch {
    return url;
  }
};

const extractPdf = async (buffer: ArrayBuffer, url: string): Promise<FetchResult> => {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));

  const metadata = await pdf.getMetadata();
  const metadataInfo =
    metadata.info && typeof metadata.info === 'object' ? (metadata.info as Record<string, unknown>) : null;
  const metaTitle = typeof metadataInfo?.Title === 'string' ? metadataInfo.Title.trim() : '';
  const metaAuthor = typeof metadataInfo?.Author === 'string' ? metadataInfo.Author.trim() : '';
  const title = metaTitle || getTitleFromUrl(url).replace(/\.pdf$/i, '') || 'document';

  const maxPages = Math.min(pdf.numPages, 100);
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => (item as { str?: string }).str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) pages.push(pageText);
  }

  const lines = [
    `# ${title}`,
    '',
    `> Source: ${url}`,
    `> Pages: ${pdf.numPages}${pdf.numPages > maxPages ? ` (extracted first ${maxPages})` : ''}`,
  ];
  if (metaAuthor) lines.push(`> Author: ${metaAuthor}`);
  lines.push('', '---', '', pages.join('\n\n'));

  if (pdf.numPages > maxPages) {
    lines.push('', '---', '', `*[Truncated: only first ${maxPages} of ${pdf.numPages} pages extracted]*`);
  }

  return { url, title, content: lines.join('\n'), error: null };
};

const isLikelyJsRendered = (html: string): boolean => {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return false;

  const textContent = bodyMatch[1]!
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const scriptCount = (html.match(/<script/gi) ?? []).length;
  return textContent.length < 500 && scriptCount > 3;
};

const extractWithJinaReader = async (url: string, signal?: AbortSignal): Promise<FetchResult | null> => {
  const timeout = withTimeoutSignal(signal, JINA_TIMEOUT_MS);
  try {
    const response = await fetch(`${JINA_READER_BASE}${url}`, {
      headers: { Accept: 'text/markdown', 'X-No-Cache': 'true' },
      signal: timeout.signal,
    });
    if (!response.ok) return null;

    const content = await response.text();
    const contentStart = content.indexOf('Markdown Content:');
    if (contentStart < 0) return null;

    const markdown = content.slice(contentStart + 'Markdown Content:'.length).trim();
    if (
      markdown.length < 100 ||
      markdown.startsWith('Loading...') ||
      markdown.startsWith('Please enable JavaScript')
    ) {
      return null;
    }

    return {
      url,
      title: extractHeadingTitle(markdown) ?? getTitleFromUrl(url),
      content: markdown,
      error: null,
    };
  } catch {
    return null;
  } finally {
    timeout.cleanup();
  }
};

const extractViaHttp = async (url: string, signal?: AbortSignal): Promise<FetchResult> => {
  const timeout = withTimeoutSignal(signal, DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: timeout.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      return { url, title: '', content: '', error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    const contentLengthHeader = response.headers.get('content-length');
    const isPdfContent = isPdf(url, contentType);
    const maxSize = isPdfContent ? MAX_PDF_SIZE : MAX_RESPONSE_SIZE;
    if (contentLengthHeader && parseInt(contentLengthHeader, 10) > maxSize) {
      return {
        url,
        title: '',
        content: '',
        error: `Response too large (${Math.round(parseInt(contentLengthHeader, 10) / 1024 / 1024)}MB)`,
      };
    }

    if (isPdfContent) return await extractPdf(await response.arrayBuffer(), url);

    if (isUnsupportedContentType(contentType)) {
      return { url, title: '', content: '', error: `Unsupported content type: ${contentType.split(';')[0]}` };
    }

    const text = await response.text();
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    if (!isHtml) {
      return { url, title: extractHeadingTitle(text) ?? getTitleFromUrl(url), content: text, error: null };
    }

    const { document } = parseHTML(text);
    const article = new Readability(document as unknown as Document).parse();
    if (!article) {
      return {
        url,
        title: '',
        content: '',
        error: isLikelyJsRendered(text)
          ? 'Page appears to be JavaScript-rendered; content loads dynamically.'
          : 'Could not extract readable content from HTML structure.',
      };
    }

    const markdown = turndown.turndown(article.content ?? '');
    return {
      url,
      title: article.title || '',
      content: markdown,
      error:
        markdown.length < MIN_USEFUL_CONTENT
          ? isLikelyJsRendered(text)
            ? 'Page appears to be JavaScript-rendered; extracted content may be incomplete.'
            : 'Extracted content appears incomplete.'
          : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { url, title: '', content: '', error: message };
  } finally {
    timeout.cleanup();
  }
};

export const fetchAndExtract = async (
  { url, maxChars = DEFAULT_MAX_CHARS, useJinaFallback = false }: WebFetchParams,
  signal?: AbortSignal,
): Promise<FetchResult> => {
  if (signal?.aborted) return { url, title: '', content: '', error: 'Aborted' };

  try {
    new URL(url);
  } catch {
    return { url, title: '', content: '', error: 'Invalid URL' };
  }

  const httpResult = await extractViaHttp(url, signal);
  if (signal?.aborted) return { url, title: '', content: '', error: 'Aborted' };

  if (!httpResult.error || !useJinaFallback) {
    return { ...httpResult, content: truncateContent(httpResult.content, maxChars) };
  }

  if (
    httpResult.error.startsWith('Unsupported content type') ||
    httpResult.error.startsWith('Response too large')
  ) {
    return httpResult;
  }

  const jinaResult = await extractWithJinaReader(url, signal);
  if (jinaResult) return { ...jinaResult, content: truncateContent(jinaResult.content, maxChars) };

  return {
    ...httpResult,
    error: `${httpResult.error}\n\nJina Reader fallback did not return usable content. Try web_search to find cached or alternate sources.`,
  };
};

export function createWebFetchTool() {
  return {
    name: 'web_fetch',
    label: 'Web Fetch',
    description:
      'Fetch a URL and extract readable content as markdown. Supports HTML pages, PDFs, plain text, and optional Jina Reader fallback.',
    promptSnippet:
      'Fetch a URL and extract readable markdown. Supports HTML, PDFs, plain text, and optional Jina fallback.',
    promptGuidelines: [
      'Use web_fetch when the user provides a specific URL or when web_search results include a page that needs closer reading.',
      'Use web_fetch useJinaFallback only when normal fetching fails or appears JavaScript-rendered; it sends the URL to r.jina.ai.',
    ],
    parameters: Type.Object({
      url: Type.String({ description: 'URL to fetch.' }),
      maxChars: Type.Optional(
        Type.Number({
          description: 'Maximum characters to return. Default 40000, max 200000.',
          minimum: 1000,
          maximum: 200000,
        }),
      ),
      useJinaFallback: Type.Optional(
        Type.Boolean({ description: 'Whether to try r.jina.ai if normal extraction fails. Default false.' }),
      ),
    }),
    async execute(_toolCallId: string, params: WebFetchParams, signal?: AbortSignal) {
      const result = await fetchAndExtract(params, signal);
      if (result.error) throw new Error(`${params.url}: ${result.error}`);

      const header = result.title
        ? `# ${result.title}\n\nSource: ${result.url}\n\n---\n\n`
        : `Source: ${result.url}\n\n---\n\n`;
      return {
        content: [{ type: 'text' as const, text: header + result.content }],
        details: {
          url: result.url,
          title: result.title,
          chars: result.content.length,
        },
      };
    },
    renderCall(args: Partial<WebFetchParams>, theme: never, context: { lastComponent?: Text }) {
      const text = context.lastComponent ?? new Text('', 0, 0);
      const display =
        args.url && args.url.length > 70 ? `${args.url.slice(0, 67)}...` : (args.url ?? '(no URL)');
      text.setText(
        (theme as { fg: (kind: string, value: string) => string; bold: (value: string) => string }).fg(
          'toolTitle',
          (theme as { bold: (value: string) => string }).bold('fetch '),
        ) +
          (theme as { fg: (kind: string, value: string) => string }).fg(
            args.url ? 'accent' : 'error',
            display,
          ),
      );
      return text;
    },
    renderResult(
      result: { content: { type: string; text?: string }[]; details?: unknown },
      options: { expanded: boolean; isPartial: boolean },
      theme: { fg: (kind: string, value: string) => string },
      context: { lastComponent?: Text; isError?: boolean },
    ) {
      const text = context.lastComponent ?? new Text('', 0, 0);
      if (options.isPartial) {
        text.setText(theme.fg('warning', 'Fetching…'));
        return text;
      }
      if (context.isError) {
        const message = result.content.find((part) => part.type === 'text')?.text ?? 'Fetch failed';
        text.setText(theme.fg('error', message));
        return text;
      }

      const details = result.details as { title?: string; chars?: number } | undefined;
      const status =
        theme.fg('success', details?.title || 'Untitled') +
        theme.fg('muted', ` (${details?.chars ?? 0} chars)`);
      if (!options.expanded) {
        text.setText(status);
        return text;
      }

      const content = result.content.find((part) => part.type === 'text')?.text ?? '';
      text.setText(
        `${status}\n${theme.fg('dim', content.length > 800 ? `${content.slice(0, 800)}...` : content)}`,
      );
      return text;
    },
  };
}
