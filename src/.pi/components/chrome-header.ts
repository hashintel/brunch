import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Theme } from '@earendil-works/pi-coding-agent';
import { type Component, truncateToWidth } from '@earendil-works/pi-tui';

import { formatBrunchProductIdentity, readBrunchAnsiLogo } from './brunch-identity.js';

export interface BrunchStartupHeaderFacts {
  project: string;
  spec: string;
  session: string;
  sidecarUrl?: string;
}

const HEADER_TOP_PADDING_LINES = 6;
const MIN_WIDTH = 20;
const ASSET_DIR = new URL('./workspace-dialog/assets/', import.meta.url);
const PACKAGE_JSON_URL = new URL('../../../package.json', import.meta.url);
const LOCAL_BUILD_TIME = formatBuildTime(new Date());

export class BrunchStartupHeader implements Component {
  private expanded = false;

  constructor(
    private readonly facts: BrunchStartupHeaderFacts,
    private readonly theme: Pick<Theme, 'fg' | 'bold'>,
  ) {}

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
  }

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Math.max(MIN_WIDTH, width);
    const lines = this.expanded ? this.expandedLines() : this.collapsedLines();
    return lines.map((line) => truncateToWidth(line, safeWidth, '...'));
  }

  private collapsedLines(): string[] {
    return [
      ...this.topPaddingLines(),
      ...this.identityLines(),
      '',
      this.shortcutHelpLine(),
      this.webOrExpandHelpLine(),
    ];
  }

  private expandedLines(): string[] {
    return [
      ...this.topPaddingLines(),
      ...this.identityLines(),
      '',
      this.shortcutHelpLine(),
      this.webOrExpandHelpLine(),
      '',
      `Project: ${sanitizeText(this.facts.project)}`,
      `Selected spec: ${sanitizeText(this.facts.spec)}`,
      `Current session: ${sanitizeText(this.facts.session)}`,
      'Graph capture: mention graph items with #codes; accepted graph truth flows through Brunch commands.',
      'Runtime posture: use Brunch mode/strategy/lens controls; AUTO choices stay within the active manifest.',
      'Help: use /brunch to switch spec/session; use structured prompts or chat to continue elicitation.',
    ];
  }

  private topPaddingLines(): string[] {
    return Array.from({ length: HEADER_TOP_PADDING_LINES }, () => '');
  }

  private identityLines(): string[] {
    return formatBrunchProductIdentity({
      logoLines: readBrunchAnsiLogo({ assetUrl: ASSET_DIR, truecolor: true }),
      version: brunchVersion(),
      theme: this.theme,
    });
  }

  private shortcutHelpLine(): string {
    return this.theme.fg(
      'dim',
      'escape interrupt · ctrl+c/ctrl+d clear/exit · /brunch switch · # mention · ! bash · ctrl+o more',
    );
  }

  private webOrExpandHelpLine(): string {
    if (this.facts.sidecarUrl) {
      return this.theme.fg('dim', `web-ui: ${sanitizeText(this.facts.sidecarUrl)}`);
    }
    return this.theme.fg('dim', 'Press ctrl+o to show full Brunch startup help and active surfaces.');
  }
}

interface PackageJson {
  version?: unknown;
  private?: unknown;
}

function brunchVersion(): { version: string; dev: string | null } {
  const pkg = readPackage();
  const version = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  const isLocalDev = pkg.private === true || version === '0.0.0';
  return {
    version: `v${version}`,
    dev: isLocalDev ? `(dev @ ${LOCAL_BUILD_TIME})` : null,
  };
}

function readPackage(): PackageJson {
  try {
    return JSON.parse(readFileSync(fileURLToPath(PACKAGE_JSON_URL), 'utf8')) as PackageJson;
  } catch {
    return {};
  }
}

function formatBuildTime(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}
