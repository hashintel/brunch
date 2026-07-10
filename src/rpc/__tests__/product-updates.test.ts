import { describe, expect, it } from 'vitest';

import { executeRunProductUpdateHintsFromDetail } from '../product-updates.js';

describe('executeRunProductUpdateHintsFromDetail', () => {
  it('clears every cached Petri hint when run detail cannot reconstruct the runtime', () => {
    expect(executeRunProductUpdateHintsFromDetail({})).toEqual({
      petriProjection: null,
      petriProjectionSource: null,
      petriProjectionReplayReason: null,
      petriReadySteps: null,
      petriBlockedSteps: null,
      petrinautLiveExport: null,
      petrinautLauncherTemplateUrl: null,
      petrinautLaunchPath: null,
    });
  });
});
