/** alt+b is unavailable: Pi reserves it as a built-in editor binding (cursorWordLeft). */
export const BRUNCH_MENU_SHORTCUT = 'ctrl+shift+b';
export const BRUNCH_MODE_PICKER_SHORTCUT = 'alt+m';

export function formatChromeShortcutHint(shortcut: string): string {
  return shortcut.replace(/\+/g, '-');
}
