import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { registerBrunchSessionOrientation } from '../registrar.js';

function setup(style?: string) {
  const handlers = new Map<string, Function>();
  const pi = {
    on: (name: string, handler: Function) => handlers.set(name, handler),
  } as unknown as ExtensionAPI;
  const entries: unknown[] = style
    ? [{ type: 'custom', customType: 'brunch.elicitation_style', data: { schemaVersion: 1, style } }]
    : [];
  let selects = 0;
  const ctx = {
    hasUI: true,
    mode: 'interactive',
    modelRegistry: { getAvailable: () => [{}] },
    ui: {
      select: async () => {
        selects++;
        return undefined;
      },
      notify() {},
    },
    sessionManager: { getBranch: () => entries, appendCustomEntry() {}, appendCustomMessageEntry() {} },
  } as unknown as ExtensionContext;
  registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });
  return { handlers, ctx, selects: () => selects };
}

describe('orientation registrar', () => {
  it('registers only session-start lifecycle orientation; tree and abort do not open menus', () => {
    const h = setup();
    expect([...h.handlers.keys()]).toEqual(['session_start']);
  });

  it('auto-opens only style-less startup', async () => {
    const empty = setup();
    await empty.handlers.get('session_start')!({ reason: 'startup' } as SessionStartEvent, empty.ctx);
    expect(empty.selects()).toBe(1);
    const established = setup('propose');
    await established.handlers.get('session_start')!(
      { reason: 'startup' } as SessionStartEvent,
      established.ctx,
    );
    expect(established.selects()).toBe(0);
  });

  it.each(['new', 'resume', 'reload', 'fork'])('does not auto-open for %s session starts', async (reason) => {
    const h = setup();
    await h.handlers.get('session_start')!({ reason } as SessionStartEvent, h.ctx);
    expect(h.selects()).toBe(0);
  });
});
