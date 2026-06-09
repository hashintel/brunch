import {
  formatGraphNodeCode,
  NODE_KIND_METADATA,
  type NodeKind,
  type NodePlane,
} from '../../graph/schema/nodes.js';

// ── Node presentation primitives ──────────────────────────────────────
//
// Ported / adapted from the prior trunk's knowledge-card.tsx. The old UI
// keyed accents per KnowledgeKind; this trunk groups accents by the node's
// conceptual plane (intent / oracle / design / plan) — D67-L. Reference-code
// labels remain canonical: NODE_KIND_METADATA + kindOrdinal (D62-L).

export interface PlaneAccent {
  /** Foreground hue for the kind badge. */
  readonly text: string;
  /** Faint tinted background for the kind badge. */
  readonly bg: string;
}

// Accent per plane — exhaustive over NodePlane (I42-L). Adding a plane without
// an accent is a compile error via `satisfies`.
export const PLANE_ACCENT = {
  intent: { text: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' },
  oracle: { text: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)' },
  design: { text: '#9333ea', bg: 'rgba(147, 51, 234, 0.08)' },
  plan: { text: '#d97706', bg: 'rgba(217, 119, 6, 0.08)' },
} as const satisfies Record<NodePlane, PlaneAccent>;

export function planeAccent(plane: NodePlane): PlaneAccent {
  return PLANE_ACCENT[plane];
}

/** Canonical human reference code, e.g. `G1`, `CTX2`, `AC3` (D62-L). */
export function nodeRefCode(kind: NodeKind, kindOrdinal: number): string {
  return formatGraphNodeCode(kind, kindOrdinal);
}

/** Small mono prefix badge tinted by the node's plane. */
export function KindBadge({ kind, plane }: { kind: NodeKind; plane: NodePlane }) {
  const accent = planeAccent(plane);
  return (
    <span
      className="inline-flex h-4 items-center rounded px-1 font-mono text-[9px] leading-none font-medium"
      style={{ color: accent.text, backgroundColor: accent.bg }}
    >
      {NODE_KIND_METADATA[kind].label}
    </span>
  );
}

/** Small mono count chip. */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="bg-wash text-xxs text-sub inline-flex h-5 items-center rounded-md px-1.5 font-mono font-medium">
      {count}
    </span>
  );
}

/** Neutral reference-code chip used for edge "Links to:" targets. */
export function RefBadge({ code }: { code: string }) {
  return (
    <span className="bg-wash text-xxs text-sub inline-flex h-5 items-center rounded px-1.5 font-mono leading-none font-medium">
      {code}
    </span>
  );
}
