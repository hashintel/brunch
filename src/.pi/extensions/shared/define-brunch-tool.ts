import { defineTool, type Theme, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import type { TSchema } from 'typebox';

import { withLateralPadding } from '../../components/lateral-padding.js';

interface BrunchToolRendererState {
  statusText?: Text;
}

type BrunchToolDefinition<TParams extends TSchema, TDetails> = Omit<
  ToolDefinition<TParams, TDetails, BrunchToolRendererState>,
  'renderShell' | 'renderCall' | 'renderResult'
>;

/** Define a Brunch-authored tool with the canonical one-line fallback renderer. */
export function defineBrunchTool<TParams extends TSchema, TDetails = unknown>(
  tool: BrunchToolDefinition<TParams, TDetails>,
) {
  const title = tool.label || tool.name;

  return defineTool<TParams, TDetails, BrunchToolRendererState>({
    ...tool,
    renderShell: 'self',
    renderCall(_args, theme, context) {
      const statusText = context.state.statusText ?? new Text('', 0, 0);
      context.state.statusText = statusText;
      statusText.setText(renderStatus(theme, title, 'accent'));
      return withLateralPadding(statusText, 1);
    },
    renderResult(_result, { isPartial }, theme, context) {
      const statusText = context.state.statusText ?? new Text('', 0, 0);
      context.state.statusText = statusText;
      statusText.setText(
        renderStatus(theme, title, isPartial ? 'accent' : context.isError ? 'error' : 'success'),
      );
      return new Text('', 0, 0);
    },
  });
}

function renderStatus(theme: Theme, title: string, status: 'accent' | 'success' | 'error'): string {
  return `${theme.fg(status, theme.bold('◉'))}${theme.fg('muted', ` Brunch: ${title}`)}`;
}
