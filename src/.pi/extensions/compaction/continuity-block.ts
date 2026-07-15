import type { CustomMessageEntry } from '@earendil-works/pi-coding-agent';

import { compactionAnchorContract } from './anchor-contract.js';
import type { SelectedCompactionAnchor } from './select-anchors.js';

export const BRUNCH_COMPACTION_BLOCK_SCHEMA_VERSION = 1;
const OPEN = `<!-- brunch:compaction-continuity version=${BRUNCH_COMPACTION_BLOCK_SCHEMA_VERSION} -->`;
const CLOSE = '<!-- /brunch:compaction-continuity -->';

export function renderBrunchContinuityBlock(selected: readonly SelectedCompactionAnchor[]): string {
  const carriers = selected
    .map((anchor) => anchor.entry)
    .filter((entry): entry is CustomMessageEntry => entry.type === 'custom_message')
    .map((entry) => ({
      customType: entry.customType,
      content: entry.content,
      display: entry.display,
      ...(entry.details === undefined ? {} : { details: entry.details }),
    }));
  const payload = canonicalize({
    blockSchemaVersion: BRUNCH_COMPACTION_BLOCK_SCHEMA_VERSION,
    anchorContractVersion: compactionAnchorContract.version,
    carriers,
  });
  return `${OPEN}\n## Brunch continuity anchors\n\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`\n${CLOSE}`;
}

export function stripBrunchContinuityBlock(summary: string | undefined): string | undefined {
  if (summary === undefined || !summary.startsWith(`${OPEN}\n`)) return summary;

  const match = summary.match(
    new RegExp(
      `^${OPEN}\\n## Brunch continuity anchors\\n\\n\`\`\`json\\n([^\\n]*)\\n\`\`\`\\n${CLOSE}(?:\\n|$)`,
    ),
  );
  if (!match) return summary;

  try {
    if (!isCurrentPayload(JSON.parse(match[1]!))) return summary;
  } catch {
    return summary;
  }

  return summary.slice(match[0].length);
}

function isCurrentPayload(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.blockSchemaVersion === BRUNCH_COMPACTION_BLOCK_SCHEMA_VERSION &&
    payload.anchorContractVersion === compactionAnchorContract.version &&
    Array.isArray(payload.carriers) &&
    payload.carriers.every(isCarrier)
  );
}

function isCarrier(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const carrier = value as Record<string, unknown>;
  const content = carrier.content;
  return (
    typeof carrier.customType === 'string' &&
    typeof carrier.display === 'boolean' &&
    (typeof content === 'string' ||
      (Array.isArray(content) &&
        content.every(
          (block) =>
            block !== null &&
            typeof block === 'object' &&
            !Array.isArray(block) &&
            typeof (block as Record<string, unknown>).type === 'string',
        )))
  );
}

function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = left[index]!.codePointAt(0)! - right[index]!.codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => compareCodePoints(a, b))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}
