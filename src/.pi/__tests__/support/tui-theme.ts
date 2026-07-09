import type { LabTheme } from '../../components/tui-lab/index.js';

export function createTestLabTheme(): LabTheme {
  const colorCodes: Record<string, string> = {
    accent: '\x1b[38;5;33m',
    border: '\x1b[38;5;33m',
    borderAccent: '\x1b[38;5;214m',
    success: '\x1b[38;5;34m',
    warning: '\x1b[38;5;220m',
    error: '\x1b[38;5;196m',
    muted: '\x1b[38;5;244m',
    dim: '\x1b[38;5;240m',
    modeSpecifyBorder: '\x1b[38;5;99m',
    modeExecuteBorder: '\x1b[38;5;34m',
    text: '\x1b[39m',
    customMessageLabel: '\x1b[38;5;99m',
    toolTitle: '\x1b[38;5;69m',
    syntaxKeyword: '\x1b[38;5;141m',
  };
  return {
    fg: (color, text) => `${colorCodes[color]}${text}\x1b[39m`,
    inverse: (text) => `\x1b[7m${text}\x1b[27m`,
    getFgAnsi: (color) => colorCodes[color],
  };
}
