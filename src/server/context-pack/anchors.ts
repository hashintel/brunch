import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';

import type { ObserverContextPackInput } from '../context-pack.js';

export interface IntentAnchor {
  id: number;
  kind: KnowledgeKind;
  content: string;
  preview: string;
}

const INTENT_ANCHOR_PREVIEW_MAX_LENGTH = 160;

function formatIntentAnchorPreview(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= INTENT_ANCHOR_PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, INTENT_ANCHOR_PREVIEW_MAX_LENGTH - 1).trimEnd()}…`;
}

export function buildIntentAnchors(entities: ObserverContextPackInput['entities']): IntentAnchor[] {
  const anchors: IntentAnchor[] = [];
  for (const entry of knowledgeKindRegistry) {
    for (const item of entities[entry.collectionKey]) {
      anchors.push({
        id: item.id,
        kind: entry.kind,
        content: item.content,
        preview: formatIntentAnchorPreview(item.content),
      });
    }
  }
  return anchors;
}

export function formatExistingKnowledgeAnchors(
  anchors: readonly IntentAnchor[],
  heading = 'Existing knowledge anchors',
): string | null {
  const lines = anchors.map((item) => `#${item.id} ${item.kind} | ${item.preview}`);
  return lines.length > 0 ? `${heading}:\n${lines.join('\n')}` : null;
}

export function formatAnchorBullets(anchors: readonly IntentAnchor[]): string {
  return anchors.map((item) => `- #${item.id} ${item.content}`).join('\n');
}
