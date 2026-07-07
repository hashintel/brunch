import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createRuntimeModePickerComponent } from '../../../.pi/components/runtime-posture/axis-picker.js';
import { createComponentPreviewTheme } from '../theme.js';

const THEME_DIR = new URL('../../../.pi/themes/', import.meta.url);

function hexToTruecolorFg(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function shippedAccentHex(variant: 'dark' | 'light'): string {
  const parsed = JSON.parse(
    readFileSync(fileURLToPath(new URL(`brunch-${variant}.json`, THEME_DIR)), 'utf8'),
  ) as { vars: Record<string, string>; colors: Record<string, string> };
  return parsed.vars[parsed.colors['accent']!] ?? parsed.colors['accent']!;
}

describe('createComponentPreviewTheme', () => {
  it('renders the exact colors shipped in the Brunch theme JSONs', () => {
    const dark = createComponentPreviewTheme('dark');
    const light = createComponentPreviewTheme('light');

    expect(dark.getFgAnsi('accent')).toBe(hexToTruecolorFg(shippedAccentHex('dark')));
    expect(light.getFgAnsi('accent')).toBe(hexToTruecolorFg(shippedAccentHex('light')));
    expect(dark.fg('accent', 'x')).toBe(`${dark.getFgAnsi('accent')}x\x1b[39m`);
  });

  it('is structurally usable as a LabTheme by a real component', () => {
    const theme = createComponentPreviewTheme();

    const component = createRuntimeModePickerComponent({ current: 'specify', theme, onDone: () => {} });
    const text = component.render(120).join('\n');

    expect(text).toContain('Choose Brunch mode');
  });
});
