import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';

import { brunchFauxProviderConfig, createBrunchFauxHarness, defaultBrunchFauxModel } from './index.js';

describe('createBrunchFauxHarness', () => {
  it('boots an in-memory AgentSession over a registered faux provider', async () => {
    const harness = await createBrunchFauxHarness({
      responses: [fauxAssistantMessage('factory boot complete')],
    });

    try {
      expect(harness.session.model?.provider).toBe(harness.model.provider);
      expect(harness.session.model?.id).toBe(harness.model.modelId);
      expect(harness.session.sessionFile).toBeUndefined();
      expect(harness.session.getActiveToolNames()).toEqual([]);
      expect(harness.provider.getPendingResponseCount()).toBe(1);
    } finally {
      harness.dispose();
    }
  });

  it('uses the pi 0.79 $ENV api-key form for model-registry provider config', () => {
    expect(brunchFauxProviderConfig(defaultBrunchFauxModel()).apiKey).toBe('$BRUNCH_FAUX_HARNESS_API_KEY');
  });
});
