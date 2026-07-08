import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  getKeybindings,
  type KeybindingDefinitions,
  type KeybindingsConfig,
  KeybindingsManager,
  setKeybindings,
} from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { cleanupBrunchKeybindingFilePolicy, registerBrunchKeybindingPolicy } from '../pi-keybindings.js';

const keybindingDefinitions = {
  'app.thinking.cycle': { defaultKeys: 'shift+tab' },
  'app.model.select': { defaultKeys: 'ctrl+l' },
  'tui.input.submit': { defaultKeys: 'enter' },
} satisfies KeybindingDefinitions;

function installTestKeybindings(userBindings: KeybindingsConfig) {
  const manager = new KeybindingsManager(keybindingDefinitions, userBindings);
  setKeybindings(manager);
  return manager;
}

describe('Brunch Pi keybinding policy', () => {
  it('suppresses thinking-cycle only in the live keybinding manager after session_start', async () => {
    const manager = installTestKeybindings({
      'app.thinking.cycle': 'shift+tab',
      'app.model.select': 'ctrl+x',
    });
    const handlers: Array<(event: unknown, ctx: unknown) => Promise<void> | void> = [];

    registerBrunchKeybindingPolicy({
      on(eventName: string, handler: (event: unknown, ctx: unknown) => Promise<void> | void) {
        if (eventName === 'session_start') handlers.push(handler);
      },
    } as never);

    await handlers[0]?.({ type: 'session_start', reason: 'new' }, {});

    expect(getKeybindings()).toBe(manager);
    expect(manager.getKeys('app.thinking.cycle' as never)).toEqual([]);
    expect(manager.getKeys('app.model.select' as never)).toEqual(['ctrl+x']);
  });

  it('no-ops when the live registry has no Pi app keybindings', async () => {
    setKeybindings(new KeybindingsManager({ 'tui.input.submit': { defaultKeys: 'enter' } }, {}));
    const before = getKeybindings().getUserBindings();

    registerBrunchKeybindingPolicy({
      async on(_eventName: string, handler: (event: unknown, ctx: unknown) => Promise<void> | void) {
        await handler({ type: 'session_start', reason: 'startup' }, {});
      },
    } as never);

    expect(getKeybindings().getUserBindings()).toEqual(before);
  });

  it('removes only the exact old file suppression and never creates a new file', async () => {
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agentdir-'));
    const configPath = join(agentDir, 'keybindings.json');

    cleanupBrunchKeybindingFilePolicy(agentDir);

    expect(existsSync(configPath)).toBe(false);

    await writeFile(
      configPath,
      `${JSON.stringify({ 'app.thinking.cycle': [], 'app.model.select': 'ctrl+x' })}\n`,
    );
    cleanupBrunchKeybindingFilePolicy(agentDir);

    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({ 'app.model.select': 'ctrl+x' });
  });
});
