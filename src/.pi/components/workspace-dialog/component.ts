import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent';
import { Key, matchesKey, truncateToWidth, visibleWidth, type Component } from '@earendil-works/pi-tui';

import type {
  WorkspaceLaunchInventory,
  SpecSessionActivationDecision,
} from '../../../session/workspace-session-coordinator.js';
import { formatBrunchProductIdentity, readBrunchAnsiLogo } from '../brunch-identity.js';
import { resolveBrunchVersion } from '../brunch-version.js';
import {
  buildWorkspaceSelectionView,
  selectWorkspaceSelectionOption,
  type WorkspaceSelectionStage,
  type WorkspaceSelectionView,
} from './model.js';

export const WORKSPACE_DIALOG_WIDTH = 80;
const CTRL_C = '\x03';
const ASSET_DIR = new URL('./assets/', import.meta.url);

export type WorkspaceDialogTheme = Pick<Theme, 'fg'>;

export interface WorkspaceDialogComponentOptions {
  inventory: WorkspaceLaunchInventory;
  onDecision: (decision: SpecSessionActivationDecision) => void;
  theme?: WorkspaceDialogTheme;
  includeContinue?: boolean;
}

export function createWorkspaceDialogComponent(options: WorkspaceDialogComponentOptions): Component {
  return new WorkspaceDialogComponent(options);
}

class WorkspaceDialogComponent implements Component {
  #inventory: WorkspaceLaunchInventory;
  #onDecision: (decision: SpecSessionActivationDecision) => void;
  #theme: WorkspaceDialogTheme | undefined;
  #includeContinue: boolean;
  #selectedIndex = 0;
  #stage: WorkspaceSelectionStage = { stage: 'home' };
  #history: WorkspaceSelectionStage[] = [];
  #title = '';

  constructor(options: WorkspaceDialogComponentOptions) {
    this.#inventory = options.inventory;
    this.#onDecision = options.onDecision;
    this.#theme = options.theme;
    this.#includeContinue = options.includeContinue ?? true;
  }

  handleInput(data: string): void {
    if (data === CTRL_C) {
      this.#onDecision({ action: 'cancel' });
      return;
    }

    if (this.#stage.stage === 'newSpecTitle') {
      this.#handleTitleInput(data);
      return;
    }

    const view = this.#view();

    if (matchesKey(data, Key.up)) {
      this.#selectedIndex = Math.max(0, this.#selectedIndex - 1);
      return;
    }
    if (matchesKey(data, Key.down)) {
      this.#selectedIndex = Math.min(view.options.length - 1, this.#selectedIndex + 1);
      return;
    }
    if (matchesKey(data, Key.escape)) {
      this.#backOrCancel();
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.#selectCurrentOption();
    }
  }

  render(width: number): string[] {
    const dialogWidth = Math.max(24, Math.min(width, WORKSPACE_DIALOG_WIDTH));
    const content = this.#contentLines();
    return renderFrame(content, dialogWidth, this.#theme);
  }

  invalidate(): void {}

  #contentLines(): string[] {
    const view = this.#view();
    const title = style(this.#theme, 'accent', view.title);
    const subtitle = style(
      this.#theme,
      'dim',
      'Choose or create the spec/session before the agent loop runs.',
    );
    const lines = [
      ...formatBrunchProductIdentity({
        logoLines: readLogo(),
        version: resolveBrunchVersion(),
        ...(this.#theme ? { theme: this.#theme } : {}),
      }),
      '',
      title,
      subtitle,
      '',
    ];

    if (this.#stage.stage === 'newSpecTitle') {
      lines.push('New specification title:', `› ${this.#title}`);
      lines.push('', style(this.#theme, 'dim', 'enter create • esc back'));
      return lines;
    }

    for (const [index, option] of view.options.entries()) {
      const selected = index === this.#selectedIndex;
      const prefix = selected ? style(this.#theme, 'accent', '› ') : '  ';
      const label = selected ? style(this.#theme, 'accent', option.label) : option.label;
      const detail = option.detail ? `  ${style(this.#theme, 'dim', option.detail)}` : '';
      lines.push(`${prefix}${label}${detail}`);
    }
    lines.push('', style(this.#theme, 'dim', '↑↓ navigate • enter select • esc cancel'));
    return lines;
  }

  #selectCurrentOption(): void {
    const result = selectWorkspaceSelectionOption(this.#view(), this.#selectedIndex, this.#inventory, {
      includeContinue: this.#includeContinue,
    });
    if ('decision' in result) {
      this.#onDecision(result.decision);
      return;
    }
    this.#history.push(this.#stage);
    this.#stage = viewToStage(result.view);
    this.#selectedIndex = 0;
    if (this.#stage.stage === 'newSpecTitle') this.#title = '';
  }

  #handleTitleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.#backOrCancel();
      return;
    }
    if (matchesKey(data, Key.backspace)) {
      this.#title = this.#title.slice(0, -1);
      return;
    }
    if (matchesKey(data, Key.enter)) {
      const title = this.#title.trim();
      if (title.length > 0) {
        this.#onDecision({ action: 'newSpec', title });
      }
      return;
    }
    const text = printableInputText(data);
    if (text) {
      this.#title += text;
    }
  }

  #view(): WorkspaceSelectionView {
    return buildWorkspaceSelectionView(this.#inventory, this.#stage, {
      includeContinue: this.#includeContinue,
    });
  }

  #backOrCancel(): void {
    const previous = this.#history.pop();
    if (!previous) {
      this.#onDecision({ action: 'cancel' });
      return;
    }
    this.#stage = previous;
    this.#selectedIndex = 0;
    this.#title = '';
  }
}

function viewToStage(view: WorkspaceSelectionView): WorkspaceSelectionStage {
  if (view.stage === 'newSpecTitle') return { stage: 'newSpecTitle', title: '' };
  if (view.stage === 'specAction' && view.specId) return { stage: 'specAction', specId: view.specId };
  if (view.stage === 'sessionList' && view.specId) return { stage: 'sessionList', specId: view.specId };
  if (view.stage === 'specList') return { stage: 'specList' };
  return { stage: 'home' };
}

function renderFrame(content: string[], width: number, theme: WorkspaceDialogTheme | undefined): string[] {
  return [
    topBorderLine(width, theme),
    emptyLine(width, theme),
    ...content.map((line) => contentLine(line, width, theme)),
    emptyLine(width, theme),
    bottomBorderLine(width, theme),
  ];
}

function contentLine(content: string, width: number, theme: WorkspaceDialogTheme | undefined): string {
  if (width <= 4) return truncateToWidth(content, width);
  const innerWidth = width - 4;
  const inner = truncateToWidth(content, innerWidth);
  const padding = ' '.repeat(Math.max(0, innerWidth - visibleWidth(inner)));
  const vertical = style(theme, 'borderMuted', '│');
  return `${vertical} ${inner}${padding} ${vertical}`;
}

function emptyLine(width: number, theme: WorkspaceDialogTheme | undefined): string {
  if (width <= 2) return ' '.repeat(Math.max(0, width));
  const vertical = style(theme, 'borderMuted', '│');
  return `${vertical}${' '.repeat(width - 2)}${vertical}`;
}

function topBorderLine(width: number, theme: WorkspaceDialogTheme | undefined): string {
  if (width <= 2) return ' '.repeat(Math.max(0, width));
  return style(theme, 'borderMuted', `╭${'─'.repeat(width - 2)}╮`);
}

function bottomBorderLine(width: number, theme: WorkspaceDialogTheme | undefined): string {
  if (width <= 2) return ' '.repeat(Math.max(0, width));
  return style(theme, 'borderMuted', `╰${'─'.repeat(width - 2)}╯`);
}

function readLogo(): string[] {
  return readBrunchAnsiLogo({
    assetUrl: ASSET_DIR,
    truecolor: supportsTruecolor(),
  });
}

export function supportsTruecolor(): boolean {
  const colorterm = process.env.COLORTERM?.toLowerCase() ?? '';
  const term = process.env.TERM?.toLowerCase() ?? '';
  return colorterm === 'truecolor' || colorterm === '24bit' || term.includes('truecolor');
}

function style(theme: WorkspaceDialogTheme | undefined, color: ThemeColor, text: string): string {
  return theme ? theme.fg(color, text) : text;
}

function printableInputText(data: string): string {
  return Array.from(data)
    .filter((char) => char >= ' ' && char !== '\u007f')
    .join('');
}
