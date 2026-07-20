export const BRUNCH_MENU_SHORTCUT = 'alt+s';
export const BRUNCH_MODE_PICKER_SHORTCUT = 'alt+m';

export function formatChromeShortcutHint(shortcut: string): string {
  return shortcut.replace(/\+/g, '-');
}
