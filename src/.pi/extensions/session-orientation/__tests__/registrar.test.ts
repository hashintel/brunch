import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { registerBrunchSessionOrientation } from '../registrar.js';

function setup(style?: string, execute = false, availability?: unknown) {
  const handlers = new Map<string, Function>();
  const pi = {
    on: (name: string, handler: Function) => handlers.set(name, handler),
  } as unknown as ExtensionAPI;
  const entries: unknown[] = [
    ...(style
      ? [{ type: 'custom', customType: 'brunch.elicitation_style', data: { schemaVersion: 1, style } }]
      : []),
    ...(execute
      ? [
          {
            type: 'custom',
            customType: 'brunch.agent_runtime_state',
            data: {
              schemaVersion: 1,
              reason: 'switch',
              source: 'user',
              state: { schemaVersion: 1, operationalMode: 'execute' },
            },
          },
        ]
      : []),
  ];
  let selects = 0;
  let selectedOptions: readonly string[] = [];
  const ctx = {
    hasUI: true,
    mode: 'interactive',
    modelRegistry: { getAvailable: () => [{}] },
    ui: {
      select: async (_title: string, options: readonly string[]) => {
        selects++;
        selectedOptions = options;
        return undefined;
      },
      notify() {},
    },
    sessionManager: { getBranch: () => entries, appendCustomEntry() {}, appendCustomMessageEntry() {} },
  } as unknown as ExtensionContext;
  registerBrunchSessionOrientation(pi, {
    resolveKickContext: () => undefined,
    resolveProcessMoveAvailability: () => {
      if (availability instanceof Error) throw availability;
      return availability;
    },
  });
  return { handlers, ctx, selects: () => selects, selectedOptions: () => selectedOptions };
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

  it('uses resolved Execute availability on applicable style-less startup', async () => {
    const h = setup(undefined, true, { compile_plan: true, execute_plan: true });
    await h.handlers.get('session_start')!({ reason: 'startup' } as SessionStartEvent, h.ctx);
    expect(h.selectedOptions()).toEqual(
      expect.arrayContaining(['Prepare execution', 'Compile a plan', 'Execute the plan']),
    );
  });

  it('fails closed to Prepare-only when Execute availability resolution throws', async () => {
    const h = setup(undefined, true, new Error('unreadable'));
    await h.handlers.get('session_start')!({ reason: 'startup' } as SessionStartEvent, h.ctx);
    expect(h.selectedOptions()).toEqual(['Prepare execution']);
  });

  it.each(['new', 'resume', 'reload', 'fork'])('does not auto-open for %s session starts', async (reason) => {
    const h = setup();
    await h.handlers.get('session_start')!({ reason } as SessionStartEvent, h.ctx);
    expect(h.selects()).toBe(0);
  });
});
