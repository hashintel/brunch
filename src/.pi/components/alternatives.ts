/**
 * Brunch alternatives transcript primitive.
 *
 * Owns the `alternatives-card-set` custom message type end-to-end:
 *   - registerMessageRenderer to draw bordered cards in the transcript
 *   - registerTool (`present_alternatives`) so the LLM can emit a card set
 *
 * Compared with an ephemeral picker (e.g. `ctx.ui.custom`), this surface
 * presents alternatives via `pi.sendMessage`: persistent, immediately returned,
 * and visible to transcript replay/RPC clients through markdown fallback text.
 */

import { StringEnum } from '@earendil-works/pi-ai';
import type { ExtensionAPI, ThemeColor } from '@earendil-works/pi-coding-agent';
import { Container, Text } from '@earendil-works/pi-tui';
import { Type, type TSchema } from 'typebox';

import { defineBrunchTool } from '../extensions/shared/define-brunch-tool.js';
import { CardComponent, ResponsiveColumns, chunk } from './cards.js';

// ── Types & schema ─────────────────────────────────────────────────────
const FLAVOR = StringEnum(['accent', 'success', 'warning', 'muted'] as const);
type Flavor = 'accent' | 'success' | 'warning' | 'muted';

interface Alternative {
  title: string;
  body: string;
  flavor?: Flavor;
}

type Layout = 'stack' | 'columns';

interface AlternativesDetails {
  headline?: string | undefined;
  alternatives: Alternative[];
  layout?: Layout | undefined;
  columnCount?: number | undefined;
  minColumnWidth?: number | undefined;
}

const AlternativeSchema = Type.Object({
  title: Type.String({ description: 'Short label for the card header' }),
  body: Type.String({
    description: 'Markdown content rendered inside the card',
  }),
  flavor: Type.Optional(FLAVOR),
});

const LAYOUT = StringEnum(['stack', 'columns'] as const);

const PresentAlternativesParams = Type.Object({
  headline: Type.Optional(Type.String({ description: 'Optional headline shown above the cards' })),
  alternatives: Type.Array(AlternativeSchema, { minItems: 1, maxItems: 6 }),
  layout: Type.Optional(LAYOUT),
  columnCount: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 4,
      description: "Cards per row when layout is 'columns'. Default 2.",
    }),
  ),
  minColumnWidth: Type.Optional(
    Type.Integer({
      minimum: 20,
      maximum: 200,
      description: 'Minimum width per card before falling back to vertical stack. Default 40.',
    }),
  ),
});

function flavorToColor(flavor: Flavor | undefined): ThemeColor {
  switch (flavor) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'muted':
      return 'muted';
    default:
      return 'accent';
  }
}

// Plain-markdown fallback so RPC clients without the renderer still see
// coherent content. Also persisted as the message `content` field.
function alternativesToMarkdown(details: AlternativesDetails): string {
  const sections: string[] = [];
  if (details.headline) sections.push(`## ${details.headline}`);
  for (const alt of details.alternatives) {
    sections.push(`### ${alt.title}\n\n${alt.body}`);
  }
  return sections.join('\n\n---\n\n');
}

function supportsAlternativesPrimitive(pi: ExtensionAPI): boolean {
  const candidate = pi as Partial<ExtensionAPI>;
  return (
    typeof candidate.registerMessageRenderer === 'function' &&
    typeof candidate.registerTool === 'function' &&
    typeof candidate.sendMessage === 'function'
  );
}

export function registerBrunchAlternatives(
  pi: ExtensionAPI,
  adaptToolParameters: <Schema extends TSchema>(schema: Schema) => Schema,
) {
  if (!supportsAlternativesPrimitive(pi)) {
    return;
  }

  // ── Renderer ────────────────────────────────────────────────────────
  pi.registerMessageRenderer('alternatives-card-set', (message, _opts, theme) => {
    const details = message.details as AlternativesDetails | undefined;
    if (!details) {
      // Fallback: if details is missing, render the raw content string.
      return new Text(typeof message.content === 'string' ? message.content : '', 0, 0);
    }

    const container = new Container();
    if (details.headline) {
      container.addChild(new Text(theme.fg('customMessageLabel', theme.bold(details.headline)), 1, 1));
    }

    const layout = details.layout ?? 'stack';
    const columnCount = Math.max(1, Math.min(4, details.columnCount ?? 2));
    const minColumnWidth = details.minColumnWidth ?? 40;

    const makeCard = (alt: Alternative) =>
      new CardComponent(alt.title, alt.body, theme, flavorToColor(alt.flavor));

    if (layout === 'columns' && details.alternatives.length > 1) {
      const groups = chunk(details.alternatives, columnCount);
      groups.forEach((group, gi) => {
        container.addChild(new ResponsiveColumns(group.map(makeCard), minColumnWidth));
        if (gi < groups.length - 1) container.addChild(new Text('', 0, 0));
      });
    } else {
      details.alternatives.forEach((alt, i) => {
        container.addChild(makeCard(alt));
        if (i < details.alternatives.length - 1) container.addChild(new Text('', 0, 0));
      });
    }
    return container;
  });

  // ── Tool ────────────────────────────────────────────────────────────
  pi.registerTool(
    defineBrunchTool({
      name: 'present_alternatives',
      label: 'Present Alternatives',
      description:
        'Present 1–6 alternative options to the user as bordered cards. Each alternative has a short title and a markdown body. Optional `flavor` (accent/success/warning/muted) styles the card border. Use when comparing options, surfacing draft variants, or laying out trade-offs.',
      promptSnippet: 'Present comparable alternatives as bordered cards in the transcript',
      promptGuidelines: [
        'Use present_alternatives when the user needs to compare 2–6 options side by side.',
        "Each alternative's body should be self-contained markdown — headings, lists, code blocks all work.",
        'After present_alternatives, ask the user which one they prefer rather than picking yourself.',
      ],
      parameters: adaptToolParameters(PresentAlternativesParams),

      async execute(_toolCallId, params) {
        const details: AlternativesDetails = {
          headline: params.headline,
          alternatives: params.alternatives,
          layout: params.layout,
          columnCount: params.columnCount,
          minColumnWidth: params.minColumnWidth,
        };

        pi.sendMessage({
          customType: 'alternatives-card-set',
          content: alternativesToMarkdown(details), // fallback / replay
          display: true,
          details,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Presented ${params.alternatives.length} alternative${
                params.alternatives.length === 1 ? '' : 's'
              }.`,
            },
          ],
          details: { count: params.alternatives.length },
          terminate: true,
        };
      },
    }),
  );
}
