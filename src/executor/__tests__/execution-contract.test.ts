import { describe, expect, it } from 'vitest';

import type { CapabilityProvider } from '../capability-providers.js';
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

const NODE_TEST_PROVIDER: CapabilityProvider = {
  id: 'node-test',
  capabilities: {
    'node.script.test': {
      domain: 'verify-runner',
      actions: { setup: [], build: [], verify: [] },
    },
  },
};

describe('deriveExecutionContract', () => {
  it('resolves required capabilities through providers with provenance intact', () => {
    const contract = deriveExecutionContract({
      required: [{ id: 'python.pytest', source: { kind: 'elicited', itemId: 'CON1' } }],
      detected: [{ id: 'node.package-json', source: { kind: 'detected', path: 'package.json' } }],
      providers: [PYTEST_PROVIDER],
    });

    expect(contract).toEqual({
      schemaVersion: 1,
      requiredCapabilities: [{ id: 'python.pytest', source: { kind: 'elicited', itemId: 'CON1' } }],
      detectedCapabilities: [{ id: 'node.package-json', source: { kind: 'detected', path: 'package.json' } }],
      resolvedActions: {
        setup: [],
        build: [],
        verify: [
          {
            capabilityId: 'python.pytest',
            providerId: 'python-pytest',
            command: 'pytest',
            args: [],
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
      providers: [],
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
      detected: [{ id: 'node.script.test', source: { kind: 'detected', path: 'package.json' } }],
      providers: [PYTEST_PROVIDER, NODE_TEST_PROVIDER],
    });

    expect(contract.conflicts).toEqual([
      {
        domain: 'verify-runner',
        requiredId: 'python.pytest',
        detectedId: 'node.script.test',
        message:
          'Required capability python.pytest and detected capability node.script.test disagree in domain verify-runner.',
      },
    ]);
    expect(contract.resolvedActions.verify).toEqual([]);
  });

  it('does not turn detected conventions into command authority', () => {
    const contract = deriveExecutionContract({
      required: [],
      detected: [{ id: 'node.script.test', source: { kind: 'detected', path: 'package.json' } }],
      providers: [NODE_TEST_PROVIDER],
    });

    expect(contract.conflicts).toEqual([]);
    expect(contract.resolvedActions.verify).toEqual([]);
  });

  it('ignores unrecognized detected capabilities as facts, not blockers', () => {
    const contract = deriveExecutionContract({
      required: [{ id: 'python.pytest', source: { kind: 'elicited', itemId: 'CON4' } }],
      detected: [{ id: 'rust.cargo', source: { kind: 'detected', path: 'Cargo.toml' } }],
      providers: [PYTEST_PROVIDER],
    });

    expect(contract.blocked).toEqual([]);
    expect(contract.conflicts).toEqual([]);
    expect(contract.resolvedActions.verify.map((action) => action.capabilityId)).toEqual(['python.pytest']);
  });
});
