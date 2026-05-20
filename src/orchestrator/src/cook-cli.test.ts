import { describe, expect, it } from 'vitest';

import { parseCookArgs } from './cook-cli.js';

describe('parseCookArgs', () => {
  it('parses dir only', () => {
    const opts = parseCookArgs(['./fixtures/txt']);
    expect(opts.dir).toContain('fixtures/txt');
    expect(opts.engine).toBe('proc');
    expect(opts.maxRetries).toBe(3);
    expect(opts.verbose).toBe(false);
  });

  it('parses --engine=petri', () => {
    const opts = parseCookArgs(['./f', '--engine=petri']);
    expect(opts.engine).toBe('petri');
  });

  it('parses --max-retries=5', () => {
    const opts = parseCookArgs(['./f', '--max-retries=5']);
    expect(opts.maxRetries).toBe(5);
  });

  it('throws on missing dir', () => {
    expect(() => parseCookArgs(['--engine=proc'])).toThrow('Usage');
  });

  it('throws on unknown engine', () => {
    expect(() => parseCookArgs(['./f', '--engine=unknown'])).toThrow('Unknown engine');
  });

  it('parses --verbose', () => {
    expect(parseCookArgs(['./f', '--verbose']).verbose).toBe(true);
    expect(parseCookArgs(['./f', '-v']).verbose).toBe(true);
  });
});
