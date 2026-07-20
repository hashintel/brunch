import { describe, expect, it } from 'vitest';

import { parseExecutionComparisonArgs } from '../../execution-comparison-brunch.js';

describe('execution comparison Brunch CLI arguments', () => {
  it('parses a complete workspace and positive specification id', () => {
    expect(parseExecutionComparisonArgs(['--workspace', '/tmp/petri-editor', '--spec-id', '17'])).toEqual({
      workspaceDir: '/tmp/petri-editor',
      specId: 17,
    });
  });

  it('rejects another option where the workspace value is required', () => {
    expect(() => parseExecutionComparisonArgs(['--workspace', '--spec-id', '17'])).toThrow();
  });

  it('rejects missing, non-integer, and unknown options', () => {
    expect(() => parseExecutionComparisonArgs(['--workspace', '/tmp/petri-editor'])).toThrow('Usage:');
    expect(() =>
      parseExecutionComparisonArgs(['--workspace', '/tmp/petri-editor', '--spec-id', '1.5']),
    ).toThrow('Usage:');
    expect(() => parseExecutionComparisonArgs(['--unknown', 'value'])).toThrow();
  });
});
