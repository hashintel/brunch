import { describe, expect, it } from 'vitest';

import { parseCookArgs } from './cook-cli.js';

describe('parseCookArgs', () => {
  it('parses dir only', () => {
    const opts = parseCookArgs(['./fixtures/txt']);
    expect(opts.dir).toContain('fixtures/txt');
    expect(opts.policy).toBe('serial');
    expect(opts.maxRetries).toBe(3);
    expect(opts.verbose).toBe(false);
  });

  it('parses --policy=serial', () => {
    const opts = parseCookArgs(['./f', '--policy=serial']);
    expect(opts.policy).toBe('serial');
  });

  it('parses --max-retries=5', () => {
    const opts = parseCookArgs(['./f', '--max-retries=5']);
    expect(opts.maxRetries).toBe(5);
  });

  it('throws on missing dir', () => {
    expect(() => parseCookArgs(['--policy=serial'])).toThrow('Usage');
  });

  it('throws on unknown policy', () => {
    expect(() => parseCookArgs(['./f', '--policy=unknown'])).toThrow('Unknown policy');
  });

  it('parses --verbose', () => {
    expect(parseCookArgs(['./f', '--verbose']).verbose).toBe(true);
    expect(parseCookArgs(['./f', '-v']).verbose).toBe(true);
  });
});
