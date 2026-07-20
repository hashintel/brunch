import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent';

import { projectRoundedBox, type RoundedBoxOptions } from './rounded-box.js';

export const MENU_SHELL_BORDER_ROLE = 'borderAccent' as ThemeColor;

/** Shared presentation-only shell for startup and in-session navigation menus. */
export function projectMenuShell(
  lines: readonly string[],
  width: number,
  theme?: Pick<Theme, 'fg'>,
  options: RoundedBoxOptions = {},
): string[] {
  return projectRoundedBox(lines, options, width, (text) =>
    theme ? theme.fg(MENU_SHELL_BORDER_ROLE, text) : text,
  );
}
