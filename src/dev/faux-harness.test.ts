import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';

import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  BRUNCH_FAUX_HARNESS_ENV_API_KEY,
  brunchFauxProviderConfig,
  createBrunchFauxHarness,
  defaultBrunchFauxModel,
} from './index.js';

describe('createBrunchFauxHarness', () => {
  it('boots an in-memory AgentSession over a registered faux provider without mutating process env', async () => {
    const previousApiKey = process.env.BRUNCH_FAUX_HARNESS_API_KEY;
    delete process.env.BRUNCH_FAUX_HARNESS_API_KEY;
    const harness = await createBrunchFauxHarness({
      responses: [fauxAssistantMessage('factory boot complete')],
    });

    try {
      expect(harness.session.model?.provider).toBe(harness.model.provider);
      expect(harness.session.model?.id).toBe(harness.model.modelId);
      expect(harness.session.sessionFile).toBeUndefined();
      expect(harness.session.getActiveToolNames()).toEqual([]);
      expect(harness.provider.getPendingResponseCount()).toBe(1);
      expect(process.env.BRUNCH_FAUX_HARNESS_API_KEY).toBeUndefined();
    } finally {
      harness.dispose();
      if (previousApiKey === undefined) {
        delete process.env.BRUNCH_FAUX_HARNESS_API_KEY;
      } else {
        process.env.BRUNCH_FAUX_HARNESS_API_KEY = previousApiKey;
      }
    }
  });

  it('uses the literal dev key for the in-process provider config by default', () => {
    expect(brunchFauxProviderConfig(defaultBrunchFauxModel()).apiKey).toBe(BRUNCH_FAUX_HARNESS_API_KEY);
  });

  it('uses the pi 0.79 $ENV api-key form only when a subprocess call site asks for it', () => {
    expect(
      brunchFauxProviderConfig(defaultBrunchFauxModel(), undefined, BRUNCH_FAUX_HARNESS_ENV_API_KEY).apiKey,
    ).toBe('$BRUNCH_FAUX_HARNESS_API_KEY');
  });
});
