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

    expect(messageSource).toContain("from '@/capabilities/markdown-rendering'");
    expect(messageSource).not.toContain("from 'streamdown'");
    expect(messageSource).not.toContain("from '@streamdown/code'");

    expect(reasoningSource).toContain("from '@/capabilities/reasoning-rendering'");
    expect(reasoningSource).not.toContain("from 'streamdown'");
    expect(reasoningSource).not.toContain("from '@streamdown/code'");
  });

  it('routes code highlighting and the debug route through named capability boundaries', () => {
    const codeBlockSource = readClientFile('components/ai-elements/code-block.tsx');
    const routerSource = readClientFile('router.tsx');
    const codeHighlightingSource = readClientFile('capabilities/code-highlighting.ts');
    const richCodeHighlightingSource = readClientFile('capabilities/rich-code-highlighting.ts');
    const debugSurfaceSource = readClientFile('routes/debug-surface.tsx');

    expect(codeHighlightingSource).toContain("import('./rich-code-highlighting.js')");
    expect(codeHighlightingSource).toContain('export const preloadRichCodeHighlighter');
    expect(codeHighlightingSource).not.toContain("import { createHighlighter } from 'shiki'");
    expect(richCodeHighlightingSource).toContain("from 'shiki'");
    expect(codeBlockSource).toContain("from '@/capabilities/code-highlighting'");
    expect(codeBlockSource).toContain('preloadRichCodeHighlighter');
    expect(codeBlockSource).not.toContain("from 'shiki'");

    expect(debugSurfaceSource).toContain("import('./ComponentDebug.js')");
    expect(routerSource).toContain("from './routes/debug-surface.js'");
    expect(routerSource).not.toContain("from './routes/ComponentDebug.js'");
  });
});
