import { describe, expect, it } from 'vitest';

import { formatRequestResponseDiagnostic } from '../request-response.js';

describe('structured-exchange renderer inventory', () => {
  it('locks request_response diagnostics that have no present tuple', async () => {
    await expect(
      formatRequestResponseDiagnostic({ message: 'Waiting for a structured response.' }),
    ).toMatchFileSnapshot('../__snapshots__/request-response.md');
  });
});
