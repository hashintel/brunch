import { describe, expect, it, vi } from 'vitest';

import { registerBrunchWebTools } from '../web-tools/web/index.js';

interface RegisteredTool {
  name: string;
  parameters: {
    properties: Record<string, { type?: string; maxLength?: number }>;
  };
  execute: (
    toolCallId: string,
    params: never,
    signal?: AbortSignal,
  ) => Promise<{ content: { type: string; text: string }[]; details?: unknown }>;
}

function registeredWebTools(): Record<string, RegisteredTool> {
  const tools: RegisteredTool[] = [];
  registerBrunchWebTools({ registerTool: (tool: RegisteredTool) => tools.push(tool) } as never);
  return Object.fromEntries(tools.map((tool) => [tool.name, tool]));
}

describe('Brunch web tools', () => {
  it('extracts readable markdown from HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            '<!doctype html><html><head><title>Ignored</title></head><body><article><h1>Spec capture</h1><p>Brunch reads referenced documents.</p><p>This fixture includes enough body text to pass the useful-content heuristic while still being a small local document. It describes how external context can be gathered, digested, and then captured through the graph path without treating the raw page as graph truth. The extra words are only here to exercise the readability path.</p><p>The tool should return markdown, source metadata, and extracted content through the registered Pi tool surface. This paragraph deliberately repeats the acquisition story so the article is not mistaken for a failed extraction: referenced documents are read as orientation, digests become swept transcript material, and graph truth still requires the Brunch capture path.</p><p>More fixture text keeps this local test deterministic without network access. The rendered markdown should preserve the heading and paragraphs, while the tool details report the source URL and character count for the extracted content.</p></article></body></html>',
            { headers: { 'content-type': 'text/html' } },
          ),
      ),
    );

    const result = await registeredWebTools().web_fetch.execute('call-1', {
      url: 'https://example.test/spec',
    } as never);

    expect(result.content[0]?.text).toContain('# Spec capture');
    expect(result.content[0]?.text).toContain('Brunch reads referenced documents.');
  });

  it('uses Jina fallback when normal extraction fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            '<html><body><script></script><script></script><script></script><script></script></body></html>',
            { headers: { 'content-type': 'text/html' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            'Title: fallback\n\nMarkdown Content:\n# Fallback Doc\n\nRecovered from reader with enough content to pass the reader usefulness threshold. This text stands in for a JavaScript-rendered page that normal extraction could not read, but the reader endpoint could convert into markdown for context gathering.',
            {
              headers: { 'content-type': 'text/markdown' },
            },
          ),
        ),
    );

    const result = await registeredWebTools().web_fetch.execute('call-1', {
      url: 'https://example.test/js-app',
      useJinaFallback: true,
    } as never);

    expect(fetch).toHaveBeenLastCalledWith(
      'https://r.jina.ai/https://example.test/js-app',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'text/markdown' }) }),
    );
    expect(result.content[0]?.text).toContain('# Fallback Doc');
  });

  it('rejects unsupported URL schemes before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      registeredWebTools().web_fetch.execute('call-1', { url: 'file:///etc/passwd' } as never),
    ).rejects.toThrow('file:///etc/passwd: Unsupported URL protocol: file:');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports invalid URLs as tool errors', async () => {
    await expect(
      registeredWebTools().web_fetch.execute('call-1', { url: 'not a url' } as never),
    ).rejects.toThrow('not a url: Invalid URL');
  });

  it('rejects oversized responses while reading bodies without content-length', async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(65);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                for (let index = 0; index < 6; index += 1) controller.enqueue(chunk);
                controller.close();
              },
            }),
            { headers: { 'content-type': 'text/plain' } },
          ),
      ),
    );

    await expect(
      registeredWebTools().web_fetch.execute('call-1', { url: 'https://example.test/large' } as never),
    ).rejects.toThrow(/Response too large/);
  });

  it('uses bounded reads for Jina fallback responses', async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(65);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            '<html><body><script></script><script></script><script></script><script></script></body></html>',
            {
              headers: { 'content-type': 'text/html' },
            },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                for (let index = 0; index < 6; index += 1) controller.enqueue(chunk);
                controller.close();
              },
            }),
            { headers: { 'content-type': 'text/markdown' } },
          ),
        ),
    );

    await expect(
      registeredWebTools().web_fetch.execute('call-1', {
        url: 'https://example.test/js-app',
        useJinaFallback: true,
      } as never),
    ).rejects.toThrow(/Response too large/);
  });

  it('formats Brave LLM Context responses', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          grounding: {
            generic: [
              {
                url: 'https://example.test/result',
                title: 'Result <b>One</b>',
                snippets: ['A &amp; B', '{"caption":"Rows","table":[{"Name":"Alpha","Value":1}]}'],
              },
            ],
          },
          sources: {
            'https://example.test/result': { hostname: 'example.test', age: ['yesterday'] },
          },
        }),
      ),
    );

    const result = await registeredWebTools().web_search.execute('call-1', {
      query: 'brunch capture',
      count: 1,
      maxTokens: 2048,
      maxUrls: 1,
      threshold: 'strict',
    } as never);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.search.brave.com/res/v1/llm/context',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Subscription-Token': 'test-key' }),
      }),
    );
    expect(result.content[0]?.text).toContain('## Result One');
    expect(result.content[0]?.text).toContain('| Name | Value |');
    expect(result.content[0]?.text).toContain('- example.test');
  });

  it('fails loudly when BRAVE_API_KEY is missing', async () => {
    vi.stubEnv('BRAVE_API_KEY', '');

    await expect(
      registeredWebTools().web_search.execute('call-1', { query: 'brunch capture' } as never),
    ).rejects.toThrow('Missing Brave API key. Set BRAVE_API_KEY in the environment.');
  });

  it('declares integer and query length constraints in tool schemas', () => {
    const tools = registeredWebTools();
    expect(tools.web_fetch.parameters.properties.maxChars.type).toBe('integer');
    expect(tools.web_search.parameters.properties.query.maxLength).toBe(400);
    expect(tools.web_search.parameters.properties.count.type).toBe('integer');
    expect(tools.web_search.parameters.properties.maxTokens.type).toBe('integer');
    expect(tools.web_search.parameters.properties.maxUrls.type).toBe('integer');
  });
});
