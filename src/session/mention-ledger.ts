import type { WorkspaceGraphRuntime } from '../graph/workspace-store.js';
import type { TranscriptEntryLike } from '../projections/session/continuity-entry-classifier.js';

export interface MentionFact {
  readonly entityId: string;
  readonly handle: string;
  readonly title?: string;
  readonly seenLsn: number;
}

export interface MentionEntry {
  readonly type: 'custom';
  readonly customType: 'brunch.mention';
  readonly data: MentionFact;
}

export const MENTION_STALENESS_HINT_ENTRY_TYPE = 'brunch.mention_staleness_hint' as const;

export interface MentionStalenessEntry {
  readonly type: 'custom';
  readonly customType: typeof MENTION_STALENESS_HINT_ENTRY_TYPE;
  readonly data: {
    readonly entityId: string;
    readonly handle?: string;
    readonly seenLsn: number;
    readonly currentLsn: number;
  };
}

export function graphHandlesInText(text: string): readonly string[] {
  return [...new Set([...text.matchAll(/#([A-Z]+\d+)/g)].map((match) => match[1]!))];
}

export function resolveMentionFacts(options: {
  readonly text: string;
  readonly specId: number;
  readonly graph: WorkspaceGraphRuntime;
}): readonly MentionFact[] {
  const readers = options.graph.forSpec(options.specId);
  return graphHandlesInText(options.text).flatMap((handle) => {
    const nodeId = readers.resolveNodeCode(handle);
    if (nodeId === undefined) return [];
    const [neighborhood] = readers.getNodes([{ id: nodeId }]);
    if (!neighborhood || neighborhood.status !== 'found') return [];
    return [
      {
        entityId: String(neighborhood.node.id),
        handle,
        title: neighborhood.node.title,
        seenLsn: neighborhood.node.updatedAtLsn,
      },
    ];
  });
}

export function mentionEntry(fact: MentionFact): MentionEntry {
  return { type: 'custom', customType: 'brunch.mention', data: fact };
}

export function mentionFactsFromEntries(entries: readonly TranscriptEntryLike[]): readonly MentionFact[] {
  return entries.flatMap((entry) => {
    if (entry.customType !== 'brunch.mention' || !isRecord(entry.data)) return [];
    const entityId = typeof entry.data.entityId === 'string' ? entry.data.entityId : undefined;
    const handle = typeof entry.data.handle === 'string' ? entry.data.handle : undefined;
    const seenLsn = typeof entry.data.seenLsn === 'number' ? entry.data.seenLsn : undefined;
    if (!entityId || !handle || seenLsn === undefined) return [];
    return [
      {
        entityId,
        handle,
        seenLsn,
        ...(typeof entry.data.title === 'string' ? { title: entry.data.title } : {}),
      },
    ];
  });
}

export function stalenessEntriesForMentions(options: {
  readonly mentions: readonly MentionFact[];
  readonly currentByEntityId: ReadonlyMap<string, number>;
}): readonly MentionStalenessEntry[] {
  return options.mentions.flatMap((mention) => {
    const currentLsn = options.currentByEntityId.get(mention.entityId);
    if (currentLsn === undefined || currentLsn <= mention.seenLsn) return [];
    return [
      {
        type: 'custom' as const,
        customType: MENTION_STALENESS_HINT_ENTRY_TYPE,
        data: {
          entityId: mention.entityId,
          handle: mention.handle,
          seenLsn: mention.seenLsn,
          currentLsn,
        },
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
