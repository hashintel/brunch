import { describe, expect, it } from 'vitest';

import { launchDetachedBestEffort } from '../open-url.js';

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
});
