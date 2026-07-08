import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getKeybindings } from '@earendil-works/pi-tui';

const BRUNCH_KEYBINDINGS_FILE = 'keybindings.json';
const PI_THINKING_CYCLE_KEYBINDING = 'app.thinking.cycle';

export function registerBrunchKeybindingPolicy(pi: ExtensionAPI): void {
  pi.on('session_start', async () => {
    applyBrunchLiveKeybindingPolicy();
  });
}

export function applyBrunchLiveKeybindingPolicy(): void {
  const keybindings = getKeybindings();
  if (!keybindings.getDefinition(PI_THINKING_CYCLE_KEYBINDING)) return;

  keybindings.setUserBindings({
    ...keybindings.getUserBindings(),
    [PI_THINKING_CYCLE_KEYBINDING]: [],
  });
}

export function cleanupBrunchKeybindingFilePolicy(agentDir: string): void {
  const configPath = join(agentDir, BRUNCH_KEYBINDINGS_FILE);
  if (!existsSync(configPath)) return;

  const existing = readKeybindingsConfig(configPath);
  if (!existing || !isEmptyArray(existing[PI_THINKING_CYCLE_KEYBINDING])) return;

  const { [PI_THINKING_CYCLE_KEYBINDING]: _removed, ...next } = existing;
  writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`);
}

function readKeybindingsConfig(configPath: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    return isPlainRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyArray(value: unknown): value is [] {
  return Array.isArray(value) && value.length === 0;
}
