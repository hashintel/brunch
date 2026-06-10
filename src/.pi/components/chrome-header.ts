import type { Theme } from '@earendil-works/pi-coding-agent';
import { type Component, truncateToWidth } from '@earendil-works/pi-tui';

export interface BrunchStartupHeaderFacts {
  project: string;
  spec: string;
  session: string;
  sidecarUrl?: string;
}

const MIN_WIDTH = 20;

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
    return lines.map((line) => truncateToWidth(sanitizeLine(line), safeWidth, '...'));
  }

  private collapsedLines(): string[] {
    const project = sanitizeLine(this.facts.project);
    const lines = [
      this.theme.bold(`brunch — ${project}`),
      `Spec: ${sanitizeLine(this.facts.spec)} · Session: ${sanitizeLine(this.facts.session)}`,
    ];
    if (this.facts.sidecarUrl) {
      lines.push(`Web: ${sanitizeLine(this.facts.sidecarUrl)}`);
    }
    lines.push('Press the expand-tools key for Brunch startup help.');
    return lines;
  }

  private expandedLines(): string[] {
    const lines = [
      this.theme.bold(`brunch — ${sanitizeLine(this.facts.project)}`),
      `Selected spec: ${sanitizeLine(this.facts.spec)}`,
      `Current session: ${sanitizeLine(this.facts.session)}`,
    ];
    if (this.facts.sidecarUrl) {
      lines.push(`Web dashboard: ${sanitizeLine(this.facts.sidecarUrl)}`);
    }
    lines.push(
      'Graph capture: mention graph items with #codes; accepted graph truth flows through Brunch commands.',
      'Runtime posture: use Brunch mode/strategy/lens controls; AUTO choices stay within the active manifest.',
      'Help: use /brunch to switch spec/session; use structured prompts or chat to continue elicitation.',
    );
    return lines;
  }
}

function sanitizeLine(value: string): string {
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}
