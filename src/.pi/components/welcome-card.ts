import type { Theme } from '@earendil-works/pi-coding-agent';
import { Box, type Component, Text } from '@earendil-works/pi-tui';

import {
  BRUNCH_MENU_SHORTCUT,
  BRUNCH_MODE_PICKER_SHORTCUT,
  formatChromeShortcutHint,
} from './chrome-shortcuts.js';

/** Borderless, non-transcript introduction composed into only a new spec/session header. */
export class BrunchWelcomeCard implements Component {
  private readonly box: Box;

  constructor(theme: Pick<Theme, 'bold' | 'fg'>) {
    const lines = [
      theme.bold('Welcome to Brunch.'),
      'Co-author the specification as a local graph; the assistant will open with a grounded question.',
      theme.fg(
        'dim',
        `/brunch:spec-menu or ${formatChromeShortcutHint(BRUNCH_MENU_SHORTCUT)} opens specifications and sessions.`,
      ),
      theme.fg(
        'dim',
        `/brunch:mode or ${formatChromeShortcutHint(BRUNCH_MODE_PICKER_SHORTCUT)} changes Specify / Execute.`,
      ),
      theme.fg('dim', '/brunch:consult chooses how to work; /brunch:continue resumes interrupted work.'),
      theme.fg('dim', 'Use /model and the thinking control; low/medium thinking often works best.'),
    ];
    this.box = new Box(1, 0);
    this.box.addChild(new Text(lines.join('\n'), 0, 0));
  }

  render(width: number): string[] {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}
