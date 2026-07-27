// ContentDiff — pure presentational word-level diff for `before` vs `after` strings.
//
// Used by the side-chat staged-patch row to expand a one-line summary into a
// visible diff (FE-665, SIDE_CHAT.md §4.1 "Detail (expandable)"). Designed to
// also drop into the canonical PatchListOverlay's per-entry detail and a
// future direct-edit row preview without modification — the component is
// pure, takes only two strings + an optional label, and emits no side effects.
//
// Color philosophy: tints come from the existing wash/tint family rather than
// saturated GitHub red/green. Removed words use the warm tint family already
// in use by the deferred-banner (rgba(255,219,168,…)). Added words use the
// cool blue family already in use by the Apply button (#3484fa). Both render
// at low opacity over the row background so the surrounding type stays the
// dominant signal.

import { diffWordsWithSpace } from 'diff';
import { useMemo } from 'react';

interface Segment {
  kind: 'unchanged' | 'added' | 'removed';
  value: string;
}

function computeSegments(before: string, after: string): readonly Segment[] {
  const parts = diffWordsWithSpace(before, after);
  return parts.map((part) => ({
    kind: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
    value: part.value,
  }));
}

export interface ContentDiffProps {
  before: string;
  after: string;
  // Optional small label rendered above the diff (e.g. "Content", "Rationale").
  label?: string;
}

export function ContentDiff({ before, after, label }: ContentDiffProps): React.ReactElement | null {
  const segments = useMemo(() => computeSegments(before, after), [before, after]);

  // Render nothing when there is no actual change to surface — the consumer
  // can always render the component unconditionally and it stays out of the
  // way when before === after (or both are empty).
  const hasChange = segments.some((segment) => segment.kind !== 'unchanged');
  if (!hasChange) {
    return null;
  }

  return (
    <div data-content-diff className="flex flex-col gap-1 text-xs leading-relaxed">
      {label !== undefined ? (
        <span className="text-[10px] font-medium tracking-wide text-hint uppercase">{label}</span>
      ) : null}
      <p className="whitespace-pre-wrap text-ink">
        {segments.map((segment, index) => {
          if (segment.kind === 'unchanged') {
            return <span key={index}>{segment.value}</span>;
          }
          if (segment.kind === 'removed') {
            return (
              <span
                key={index}
                data-diff-kind="removed"
                data-testid="content-diff-removed"
                className="rounded-[2px] bg-[rgba(255,219,168,0.55)] text-ink line-through decoration-ink/40"
              >
                {segment.value}
              </span>
            );
          }
          return (
            <span
              key={index}
              data-diff-kind="added"
              data-testid="content-diff-added"
              className="rounded-[2px] bg-[rgba(52,132,250,0.14)] text-[#1060d6]"
            >
              {segment.value}
            </span>
          );
        })}
      </p>
    </div>
  );
}
