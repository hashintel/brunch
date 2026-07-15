import { describe, expect, it } from 'vitest';

import {
  capabilityVocabulary,
  recognizeCapability,
  resolveCapabilityActions,
  type CapabilityProvider,
} from '../capability-providers.js';

describe('capability providers', () => {
  it('does not recognize capabilities outside provider vocabulary', () => {
    const providers: readonly CapabilityProvider[] = [];

    expect(recognizeCapability(providers, 'python.pytest')).toBeUndefined();
    expect(resolveCapabilityActions(providers, 'python.pytest')).toBeUndefined();
  });

  it('treats provider vocabulary as data: a new provider extends recognition without contract changes', () => {
    const pytest: CapabilityProvider = {
      id: 'python-pytest',
      capabilities: {
        'python.pytest': {
          domain: 'verify-runner',
          actions: { setup: [], build: [], verify: [{ command: 'pytest', args: [] }] },
        },
      },
    };
    const providers = [pytest];

    expect(recognizeCapability(providers, 'python.pytest')).toEqual({
      providerId: 'python-pytest',
      domain: 'verify-runner',
    });
    expect(resolveCapabilityActions(providers, 'python.pytest')?.verify).toEqual([
      { command: 'pytest', args: [] },
    ]);
    expect(capabilityVocabulary(providers)).toEqual(['python.pytest']);
  });
});
