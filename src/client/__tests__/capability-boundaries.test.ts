// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readClientFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), 'src/client', relativePath), 'utf8');

describe('client capability boundaries', () => {
  it('routes streamed markdown and reasoning through a progressive enhancement boundary', () => {
    const messageSource = readClientFile('components/ai-elements/message.tsx');
    const reasoningSource = readClientFile('components/ai-elements/reasoning.tsx');
    const markdownCapabilitySource = readClientFile('capabilities/markdown-rendering.tsx');
    const richMarkdownCapabilitySource = readClientFile('capabilities/rich-markdown-rendering.tsx');
    const reasoningCapabilitySource = readClientFile('capabilities/reasoning-rendering.tsx');

    expect(markdownCapabilitySource).toContain("import('./rich-markdown-rendering.js')");
    expect(markdownCapabilitySource).toContain('export const preloadRichMarkdownRenderer');
    expect(markdownCapabilitySource).not.toContain("from 'streamdown'");
    expect(richMarkdownCapabilitySource).toContain("from 'streamdown'");
    expect(richMarkdownCapabilitySource).not.toContain("from '@streamdown/code'");
    expect(richMarkdownCapabilitySource).not.toContain("from '@streamdown/mermaid'");
    expect(reasoningCapabilitySource).toContain("from './markdown-rendering'");

    expect(messageSource).toContain("from '@/client/capabilities/markdown-rendering'");
    expect(messageSource).not.toContain("from 'streamdown'");
    expect(messageSource).not.toContain("from '@streamdown/code'");

    expect(reasoningSource).toContain("from '@/client/capabilities/reasoning-rendering'");
    expect(reasoningSource).not.toContain("from 'streamdown'");
    expect(reasoningSource).not.toContain("from '@streamdown/code'");
  });

  it('keeps code-block and shiki out of the production import graph', () => {
    const routerSource = readClientFile('router.tsx');
    const toolSource = readClientFile('components/ai-elements/tool.tsx');
    const markdownRenderingSource = readClientFile('capabilities/markdown-rendering.tsx');

    // tool.tsx must not import code-block (shiki dependency chain)
    expect(toolSource).not.toContain("from './code-block'");
    expect(toolSource).not.toContain("from '@/client/capabilities/code-highlighting'");

    // markdown-rendering must not preload code highlighting (shiki dependency chain)
    expect(markdownRenderingSource).not.toContain("from '@/client/capabilities/code-highlighting'");
    expect(markdownRenderingSource).not.toContain('preloadRichCodeHighlighter');

    // router must not import the removed debug surface
    expect(routerSource).not.toContain("from './routes/debug-surface.js'");
    expect(routerSource).not.toContain("from './routes/ComponentDebug.js'");
    expect(routerSource).not.toContain('/debug');
  });
});
