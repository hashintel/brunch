import { describe, expect, it } from 'vitest';

import { piSourceAlias } from './pi-source-alias.js';

function loadViteAlias(env: { PI_SOURCE?: string; PI_SOURCE_ROOT?: string }) {
  const previous = { PI_SOURCE: process.env.PI_SOURCE, PI_SOURCE_ROOT: process.env.PI_SOURCE_ROOT };
  if (env.PI_SOURCE === undefined) delete process.env.PI_SOURCE;
  else process.env.PI_SOURCE = env.PI_SOURCE;
  if (env.PI_SOURCE_ROOT === undefined) delete process.env.PI_SOURCE_ROOT;
  else process.env.PI_SOURCE_ROOT = env.PI_SOURCE_ROOT;

  try {
    return piSourceAlias();
  } finally {
    if (previous.PI_SOURCE === undefined) delete process.env.PI_SOURCE;
    else process.env.PI_SOURCE = previous.PI_SOURCE;
    if (previous.PI_SOURCE_ROOT === undefined) delete process.env.PI_SOURCE_ROOT;
    else process.env.PI_SOURCE_ROOT = previous.PI_SOURCE_ROOT;
  }
}

describe('pi source alias', () => {
  it('types and default resolution stay on installed dist packages', () => {
    // The published 0.79.0 packages ship their own dist/index.d.ts, so types and
    // default runtime resolution come from node_modules — no tsconfig paths needed.
    expect(import.meta.resolve('@earendil-works/pi-ai')).toContain(
      'node_modules/@earendil-works/pi-ai/dist/index.js',
    );

    // Without PI_SOURCE the vite alias is inert.
    expect(loadViteAlias({})).toEqual([]);
  });

  it('points vite at the pi-mono source checkout only behind PI_SOURCE', () => {
    // Use the current process cwd as a guaranteed-existing PI_SOURCE_ROOT so the
    // existsSync guard passes on any machine; assert the alias mirrors that root.
    const root = process.cwd();
    const alias = loadViteAlias({ PI_SOURCE: '1', PI_SOURCE_ROOT: root });

    expect(alias).toEqual(
      expect.arrayContaining([
        { find: '@earendil-works/pi-ai', replacement: `${root}/packages/ai/src/index.ts` },
        { find: '@earendil-works/pi-agent-core', replacement: `${root}/packages/agent/src/index.ts` },
        {
          find: '@earendil-works/pi-coding-agent',
          replacement: `${root}/packages/coding-agent/src/index.ts`,
        },
        { find: '@earendil-works/pi-tui', replacement: `${root}/packages/tui/src/index.ts` },
      ]),
    );
  });

  it('stays inert when PI_SOURCE is set but the checkout is absent', () => {
    expect(loadViteAlias({ PI_SOURCE: '1', PI_SOURCE_ROOT: '/nonexistent/pi-mono-checkout' })).toEqual([]);
  });
});
