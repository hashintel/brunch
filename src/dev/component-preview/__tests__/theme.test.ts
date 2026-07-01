import { describe, expect, it } from 'vitest';

import { createRuntimeModePickerComponent } from '../../../.pi/components/runtime-posture/axis-picker.js';
import { createComponentPreviewTheme } from '../theme.js';

describe('createComponentPreviewTheme', () => {
  it('renders the specific 256-color codes Brunch components already depend on', () => {
    const theme = createComponentPreviewTheme();

    expect(theme.fg('accent', 'x')).toBe('\x1b[38;5;33mx\x1b[39m');
    expect(theme.fg('success', 'x')).toBe('\x1b[38;5;34mx\x1b[39m');
    expect(theme.fg('warning', 'x')).toBe('\x1b[38;5;220mx\x1b[39m');
    expect(theme.fg('error', 'x')).toBe('\x1b[38;5;196mx\x1b[39m');
    expect(theme.getFgAnsi('accent')).toBe('\x1b[38;5;33m');
  });

  it('is structurally usable as a LabTheme by a real component', () => {
    const theme = createComponentPreviewTheme();

    const component = createRuntimeModePickerComponent({ current: 'elicit', theme, onDone: () => {} });
    const text = component.render(120).join('\n');

    expect(text).toContain('Choose Brunch mode');
  });
});
