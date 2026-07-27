import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSystemPrompt } from './interview.js';
import { loadPromptAsset, renderPromptAsset } from './prompt-loader.js';

const unknownPromptId = 'interviewer.missing' as Parameters<typeof loadPromptAsset>[0];

afterEach(() => {
  vi.doUnmock('node:fs');
});

describe('prompt registry', () => {
  it('loads named markdown prompt assets through the typed registry', () => {
    expect(loadPromptAsset('interviewer.grounding')).toContain('GROUNDING phase');
    expect(loadPromptAsset('observer.system')).toContain('{{kindSemantics}}');
    expect(loadPromptAsset('side-chat.role')).toContain('side-chat assistant in Brunch');
    expect(loadPromptAsset('candidate-spec.system')).toContain('candidate-spec direction set');
  });

  it('normalizes terminal newlines from packaged prompt assets', () => {
    expect(loadPromptAsset('interviewer.grounding')).not.toMatch(/\n$/);
    expect(loadPromptAsset('observer.system')).not.toMatch(/\n$/);
    expect(loadPromptAsset('side-chat.role')).not.toMatch(/\n$/);
  });

  it('fails missing prompts with a clear registry error', () => {
    expect(() => loadPromptAsset(unknownPromptId)).toThrow('Unknown prompt asset: interviewer.missing');
  });

  it('returns cached empty prompt assets without rereading from disk', async () => {
    vi.resetModules();
    const readFileSync = vi.fn(() => '');
    vi.doMock('node:fs', () => ({ readFileSync }));

    const { loadPromptAsset: loadMockedPromptAsset } = await import('./prompt-loader.js');

    expect(loadMockedPromptAsset('candidate-spec.system')).toBe('');
    expect(loadMockedPromptAsset('candidate-spec.system')).toBe('');
    expect(readFileSync).toHaveBeenCalledTimes(1);
  });

  it('requires explicit interpolation variables', () => {
    expect(() => renderPromptAsset('observer.system', { kindSemantics: 'Kinds' })).toThrow(
      'Missing prompt variables for observer.system: phaseBias, schemaShape',
    );
  });

  it('renders interpolated prompts without leaving placeholders behind', () => {
    expect(
      renderPromptAsset('observer.system', {
        kindSemantics: '1. **goal** — target.',
        phaseBias: 'Prefer goals.',
        schemaShape: '{"goals":["..."]}',
      }),
    ).toContain('Return ONLY valid JSON matching this exact schema shape: {"goals":["..."]}');
  });

  it('renders the candidate-spec prompt without unresolved placeholders', () => {
    expect(renderPromptAsset('candidate-spec.system')).not.toContain('{{');
  });

  it('keeps interviewer prompts sourced from packaged assets', () => {
    expect(getSystemPrompt('grounding')).toBe(loadPromptAsset('interviewer.grounding'));
  });
});
