import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { type AliasOptions } from 'vite';

export const DEFAULT_PI_SOURCE_ROOT = join(homedir(), '.pi', 'pi-mono');

/**
 * Dev-only source alias for the pi packages (D67-L).
 *
 * Returns vite/vitest `resolve.alias` entries that redirect all four
 * `@earendil-works/pi-*` packages to a sibling `pi-mono` source checkout so
 * edits there take effect without rebuilding. Inert unless `PI_SOURCE=1` and the
 * checkout exists, so the default (and every published build) resolves installed
 * `dist`. `PI_SOURCE_ROOT` overrides the checkout path.
 *
 * `pi-agent-core` is included even though Brunch never imports it directly:
 * `pi-coding-agent`'s source imports it, so a partial alias would yield a mixed
 * source/dist module graph.
 *
 * Types are NOT handled here — the published packages ship their own
 * `dist/index.d.ts`, so `tsconfig.json` deliberately carries no pi `paths`.
 */
export function piSourceAlias(): AliasOptions {
  const piMonoRoot = process.env.PI_SOURCE_ROOT ?? DEFAULT_PI_SOURCE_ROOT;
  if (process.env.PI_SOURCE !== '1' || !existsSync(piMonoRoot)) return [];

  return [
    { find: /^@earendil-works\/pi-ai$/, replacement: resolve(piMonoRoot, 'packages/ai/src/index.ts') },
    { find: /^@earendil-works\/pi-ai\/oauth$/, replacement: resolve(piMonoRoot, 'packages/ai/src/oauth.ts') },
    { find: /^@earendil-works\/pi-ai\/(.*)$/, replacement: resolve(piMonoRoot, 'packages/ai/src/$1.ts') },
    {
      find: /^@earendil-works\/pi-agent-core$/,
      replacement: resolve(piMonoRoot, 'packages/agent/src/index.ts'),
    },
    {
      find: /^@earendil-works\/pi-agent-core\/(.*)$/,
      replacement: resolve(piMonoRoot, 'packages/agent/src/$1.ts'),
    },
    {
      find: /^@earendil-works\/pi-coding-agent$/,
      replacement: resolve(piMonoRoot, 'packages/coding-agent/src/index.ts'),
    },
    {
      find: /^@earendil-works\/pi-coding-agent\/hooks$/,
      replacement: resolve(piMonoRoot, 'packages/coding-agent/src/core/hooks/index.ts'),
    },
    {
      find: /^@earendil-works\/pi-coding-agent\/(.*)$/,
      replacement: resolve(piMonoRoot, 'packages/coding-agent/src/$1.ts'),
    },
    { find: /^@earendil-works\/pi-tui$/, replacement: resolve(piMonoRoot, 'packages/tui/src/index.ts') },
    { find: /^@earendil-works\/pi-tui\/(.*)$/, replacement: resolve(piMonoRoot, 'packages/tui/src/$1.ts') },
  ];
}
