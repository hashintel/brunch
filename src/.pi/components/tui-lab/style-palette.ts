import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

export type LabThemeColor =
  | 'accent'
  | 'border'
  | 'borderAccent'
  | 'success'
  | 'warning'
  | 'error'
  | 'muted'
  | 'dim'
  | 'text'
  | 'customMessageLabel'
  | 'toolTitle'
  | 'syntaxKeyword';

export interface LabTheme {
  fg(color: LabThemeColor, text: string): string;
  bg?(color: string, text: string): string;
  bold?(text: string): string;
  italic?(text: string): string;
  underline?(text: string): string;
  inverse?(text: string): string;
  strikethrough?(text: string): string;
  getFgAnsi?(color: LabThemeColor): string;
}

export interface PaletteRole {
  readonly name: string;
  readonly color: LabThemeColor;
  readonly sample: string;
}

export const BRUNCH_STYLE_ROLES: readonly PaletteRole[] = [
  { name: 'primary', color: 'accent', sample: 'brunch product accent' },
  { name: 'good', color: 'success', sample: 'validated / ready' },
  { name: 'warn', color: 'warning', sample: 'needs attention' },
  { name: 'bad', color: 'error', sample: 'blocked / invalid' },
  { name: 'quiet', color: 'muted', sample: 'secondary context' },
  { name: 'surface', color: 'borderAccent', sample: 'surface identity border' },
  { name: 'code', color: 'syntaxKeyword', sample: 'structured token' },
] as const;

const RESET = '\x1b[0m';
const FG_RESET = '\x1b[39m';
const BG_RESET = '\x1b[49m';

export function makeSolidBadge(theme: LabTheme, label: string, color: LabThemeColor): string {
  const fgAnsi = theme.getFgAnsi?.(color);
  const bgAnsi = fgAnsi?.replace(new RegExp(String.raw`\u001b\[38;`, 'g'), '\u001b[48;');
  if (bgAnsi && bgAnsi !== fgAnsi) {
    return `${bgAnsi}\u001b[30m ${label} ${FG_RESET}${BG_RESET}`;
  }
  return theme.inverse ? theme.inverse(` ${label} `) : `[${theme.fg(color, label)}]`;
}

export function renderStylePalettePreview(theme: LabTheme, width: number): string[] {
  const safeWidth = Math.max(1, width);
  const styles = [
    theme.bold?.('bold') ?? 'bold',
    theme.italic?.('italic') ?? 'italic',
    theme.underline?.('underline') ?? 'underline',
    theme.strikethrough?.('strike') ?? 'strike',
    theme.inverse?.(' inverse ') ?? ' inverse ',
  ].join('  ');

  return safeLines(
    [
      theme.fg('accent', 'Brunch TUI style lab'),
      ...BRUNCH_STYLE_ROLES.map(
        (role) => `${makeSolidBadge(theme, role.name, role.color)} ${theme.fg(role.color, role.sample)}`,
      ),
      `${theme.fg('muted', 'text styles')} ${styles}`,
      `${makeSolidBadge(theme, 'solid', 'customMessageLabel')} ${theme.fg('dim', 'badges reset before ordinary trailing text')}`,
    ],
    safeWidth,
  );
}

export function safeLines(lines: readonly string[], width: number): string[] {
  return lines.map((line) => ensureReset(truncateToWidth(line, width)));
}

export function lineVisibleWidths(lines: readonly string[]): number[] {
  return lines.map((line) => visibleWidth(line));
}

function ensureReset(line: string): string {
  return line.endsWith(RESET) ? line : `${line}${RESET}`;
}
