import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent';
import { Key, matchesKey, type Component } from '@earendil-works/pi-tui';

import type {
  WorkspaceLaunchInventory,
  SpecSessionActivationDecision,
} from '../../../session/workspace-session-coordinator.js';
import { formatBrunchProductIdentity, readBrunchAnsiLogo } from '../brunch-identity.js';
import { resolveBrunchVersion } from '../brunch-version.js';
import { projectRoundedBox } from '../rounded-box.js';
import { projectScrollViewport } from '../scroll-viewport.js';
import {
  buildWorkspaceSelectionView,
  selectWorkspaceSelectionOption,
  type WorkspaceSelectionStage,
  type WorkspaceSelectionView,
} from './model.js';

export const WORKSPACE_DIALOG_WIDTH = 80;
// ceiling: fixed viewport size rather than deriving from tui.terminal.rows. This component holds no
// TUI reference today (Component.render(width) never receives height) — adding one only to size this
// would be new surface for no other present need. Revisit if a real case needs it sized off the
// actual overlay height instead of a flat cap.
export const WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS = 8;
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
    const { lines, thumbRows } = this.#contentLines();
    return renderFrame(lines, dialogWidth, this.#theme, thumbRows);
  }

  invalidate(): void {}

  #contentLines(): { lines: string[]; thumbRows: ReadonlySet<number> } {
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
      return { lines, thumbRows: new Set() };
    }

    const optionLines = view.options.map((option, index) => {
      const selected = index === this.#selectedIndex;
      const prefix = selected ? style(this.#theme, 'accent', '› ') : '  ';
      const label = selected ? style(this.#theme, 'accent', option.label) : option.label;
      const detail = option.detail ? `  ${style(this.#theme, 'dim', option.detail)}` : '';
      return `${prefix}${label}${detail}`;
    });

    const window = projectScrollViewport(
      optionLines,
      WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS,
      this.#selectedIndex,
    );
    const optionsStart = lines.length;
    lines.push(...window.lines);
    const thumbRows = new Set(
      window.isThumbRow.flatMap((isThumb, index) => (isThumb ? [optionsStart + index] : [])),
    );

    lines.push('', style(this.#theme, 'dim', '↑↓ navigate • enter select • esc cancel'));
    return { lines, thumbRows };
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

function renderFrame(
  content: string[],
  width: number,
  theme: WorkspaceDialogTheme | undefined,
  thumbRows: ReadonlySet<number>,
): string[] {
  return projectRoundedBox(content, { blankPadding: { top: 1, bottom: 1 }, thumbRows }, width, (text) =>
    style(theme, 'borderMuted', text),
  );
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
