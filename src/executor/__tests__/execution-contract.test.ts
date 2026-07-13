import { describe, expect, it } from 'vitest';

import { defaultCapabilityProviders, type CapabilityProvider } from '../capability-providers.js';
import { deriveExecutionContract } from '../execution-contract.js';

const PYTEST_PROVIDER: CapabilityProvider = {
  id: 'python-pytest',
  capabilities: {
    'python.pytest': {
      domain: 'verify-runner',
      actions: { setup: [], build: [], verify: [{ command: 'pytest', args: [] }] },
    },
  },
};

describe('deriveExecutionContract', () => {
  it('resolves required capabilities through providers with provenance intact', () => {
    const contract = deriveExecutionContract({
      required: [{ id: 'node.npm-verify', source: { kind: 'elicited', itemId: 'CON1' } }],
      detected: [{ id: 'node.npm', source: { kind: 'detected', path: 'package.json' } }],
      providers: defaultCapabilityProviders(),
    });

    expect(contract).toEqual({
      schemaVersion: 1,
      requiredCapabilities: [{ id: 'node.npm-verify', source: { kind: 'elicited', itemId: 'CON1' } }],
      detectedCapabilities: [{ id: 'node.npm', source: { kind: 'detected', path: 'package.json' } }],
      resolvedActions: {
        setup: [
          {
            capabilityId: 'node.npm',
            providerId: 'node-npm',
            command: 'npm',
            args: ['install'],
          },
        ],
        build: [],
        verify: [
          {
            capabilityId: 'node.npm-verify',
            providerId: 'node-npm',
            command: 'npm',
            args: ['run', 'verify'],
          },
        ],
      },
      blocked: [],
      conflicts: [],
    });
  });

  it('blocks unrecognized required capabilities instead of guessing a command', () => {
    const contract = deriveExecutionContract({
      required: [{ id: 'ruby.rspec', source: { kind: 'elicited', itemId: 'DEC2' } }],
      detected: [],
      providers: defaultCapabilityProviders(),
    });

    expect(contract.blocked).toEqual([
      {
        id: 'ruby.rspec',
        source: { kind: 'elicited', itemId: 'DEC2' },
        reason: 'unsupported_capability',
      },
    ]);
    expect(contract.resolvedActions).toEqual({ setup: [], build: [], verify: [] });
  });

  it('reports a typed conflict when required and detected capabilities disagree in one domain', () => {
    const contract = deriveExecutionContract({
      required: [{ id: 'python.pytest', source: { kind: 'elicited', itemId: 'CON3' } }],
      detected: [{ id: 'node.npm-test', source: { kind: 'detected', path: 'package.json' } }],
      providers: [...defaultCapabilityProviders(), PYTEST_PROVIDER],
    });

    expect(contract.conflicts).toEqual([
      {
        domain: 'verify-runner',
        requiredId: 'python.pytest',
        detectedId: 'node.npm-test',
        message:
          'Required capability python.pytest and detected capability node.npm-test disagree in domain verify-runner.',
      },
    ]);
    expect(contract.resolvedActions.verify).toEqual([]);
  });

  it('reuses detected conventions when required capabilities agree or are absent', () => {
    const contract = deriveExecutionContract({
      required: [],
      detected: [{ id: 'node.npm-test', source: { kind: 'detected', path: 'package.json' } }],
      providers: defaultCapabilityProviders(),
    });

    expect(contract.conflicts).toEqual([]);
    expect(contract.resolvedActions.verify).toEqual([
      { capabilityId: 'node.npm-test', providerId: 'node-npm', command: 'npm', args: ['test'] },
    ]);
  });

  it('ignores unrecognized detected capabilities as facts, not blockers', () => {
    const contract = deriveExecutionContract({
      required: [{ id: 'node.npm-verify', source: { kind: 'default' } }],
      detected: [{ id: 'rust.cargo', source: { kind: 'detected', path: 'Cargo.toml' } }],
      providers: defaultCapabilityProviders(),
    });

    expect(contract.blocked).toEqual([]);
    expect(contract.conflicts).toEqual([]);
    expect(contract.resolvedActions.verify.map((action) => action.capabilityId)).toEqual(['node.npm-verify']);
  });
});
