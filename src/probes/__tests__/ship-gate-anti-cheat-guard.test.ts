import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DRIVER_PATH = resolve('src/probes/ship-gate-composition-proof.ts');
const RPC_CLIENT_PATH = resolve('src/probes/ship-gate-rpc-client.ts');
const DENIED_WIRING_IMPORTS = [
  'createRpcHandlers',
  'createWorkspaceSessionCoordinator',
  'createBrunchAgentSessionRuntimeFactory',
] as const;

describe('ship gate anti-cheat import guard', () => {
  it('keeps the public-entry composition gate off private wiring modules', async () => {
    const sources = await Promise.all([readFile(DRIVER_PATH, 'utf8'), readFile(RPC_CLIENT_PATH, 'utf8')]);
    const combined = sources.join('\n');

    for (const denied of DENIED_WIRING_IMPORTS) {
      expect(combined, `${denied} must not be imported by the ship gate driver`).not.toContain(denied);
    }
  });
});
