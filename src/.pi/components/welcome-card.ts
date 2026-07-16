import type { Theme } from '@earendil-works/pi-coding-agent';
import { type Component, truncateToWidth } from '@earendil-works/pi-tui';

import {
  BRUNCH_MENU_SHORTCUT,
  BRUNCH_MODE_PICKER_SHORTCUT,
  formatChromeShortcutHint,
} from './chrome-shortcuts.js';

/** Borderless, non-transcript introduction installed only for a new spec/session. */
export class BrunchWelcomeCard implements Component {
  constructor(private readonly theme: Pick<Theme, 'bold'>) {}

  render(width: number): string[] {
    const lines = [
      this.theme.bold('Welcome to Brunch.'),
      'Co-author the specification as a local graph; the assistant will open with a grounded question.',
      `/brunch:spec-menu or ${formatChromeShortcutHint(BRUNCH_MENU_SHORTCUT)} opens specifications and sessions.`,
      `/brunch:mode or ${formatChromeShortcutHint(BRUNCH_MODE_PICKER_SHORTCUT)} changes Specify / Execute.`,
      '/brunch:consult chooses how to work; /brunch:continue resumes interrupted work.',
      'Use /model and the thinking control; low/medium thinking often works best.',
    ];
    return lines.map((line) => truncateToWidth(line, Math.max(20, width), '...'));
  }

  invalidate(): void {}
}
