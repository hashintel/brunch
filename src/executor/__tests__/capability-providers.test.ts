import { describe, expect, it } from 'vitest';

import {
  defaultCapabilityProviders,
  recognizeCapability,
  resolveCapabilityActions,
  type CapabilityProvider,
} from '../capability-providers.js';

describe('defaultCapabilityProviders', () => {
  it('resolves node npm verify capabilities to typed command actions', () => {
    const providers = defaultCapabilityProviders();

    expect(recognizeCapability(providers, 'node.npm-verify')).toEqual({
      providerId: 'node-npm',
      domain: 'verify-runner',
    });
    expect(resolveCapabilityActions(providers, 'node.npm-verify')).toEqual({
      setup: [],
      build: [],
      verify: [{ command: 'npm', args: ['run', 'verify'] }],
    });
    expect(resolveCapabilityActions(providers, 'node.npm-test')).toEqual({
      setup: [],
      build: [],
      verify: [{ command: 'npm', args: ['test'] }],
    });
  });

  it('does not recognize capabilities outside provider vocabulary', () => {
    const providers = defaultCapabilityProviders();

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
    const providers = [...defaultCapabilityProviders(), pytest];

    expect(recognizeCapability(providers, 'python.pytest')).toEqual({
      providerId: 'python-pytest',
      domain: 'verify-runner',
    });
    expect(resolveCapabilityActions(providers, 'python.pytest')?.verify).toEqual([
      { command: 'pytest', args: [] },
    ]);
  });
});
