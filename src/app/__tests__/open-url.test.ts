import { describe, expect, it } from 'vitest';

import { launchDetachedBestEffort, openCommandFor } from '../open-url.js';

describe('openUrlBestEffort', () => {
  it('survives a missing opener binary instead of crashing on the unhandled error event', async () => {
    // Without the 'error' handler this emits an unhandled ChildProcess error
    // (the PR-299 review finding: no xdg-open on minimal Linux crashed login).
    expect(() =>
      launchDetachedBestEffort('brunch-definitely-missing-opener', ['https://example.com']),
    ).not.toThrow();
    // The 'error' event fires asynchronously; give it a tick so an unhandled
    // emit would surface as an unhandled error and fail this test.
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('passes OAuth URLs with & separators as a single argv entry, never through cmd parsing', () => {
    const oauthUrl = 'https://auth.example.com/authorize?client_id=abc&scope=read&state=xyz';

    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      const { command, args } = openCommandFor(platform, oauthUrl);
      // cmd.exe would split the unquoted command line at `&` (PR-299 review
      // finding) — the win32 opener must not route through a shell parser.
      expect(command).not.toBe('cmd');
      expect(args).toContain(oauthUrl);
    }
  });
});
