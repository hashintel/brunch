// ImpactChip — small color-coded pill rendering a staged edit patch's
// pre-classified impact tier (design §4.1 / SIDE_CHAT.md).
//
// Color cues mirror the patch-list overlay's deferred banner family:
//   - none → neutral wash
//   - soft → cool blue (matches the Apply button)
//   - hard → warm amber (matches the deferred banner)
//
// Shared by `patch-list-overlay.tsx` (canonical overlay expanded list) and
// `secondary-chat-staging-strip.tsx` (per-chat inline staging strip) so both
// surfaces speak the same visual language.

import type { EditImpactTier } from './patch-list-reducer.js';

export interface ImpactChipProps {
  impact: EditImpactTier;
}

export function ImpactChip({ impact }: ImpactChipProps): React.ReactElement {
  const className =
    impact === 'hard'
      ? 'rounded bg-[rgba(255,219,168,0.6)] px-1.5 py-0.5 text-[10px] font-medium text-ink'
      : impact === 'soft'
        ? 'rounded bg-[rgba(32,112,230,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[#1060d6]'
        : 'rounded bg-wash px-1.5 py-0.5 text-[10px] font-medium text-sub';
  const label = impact === 'hard' ? 'Hard impact — V3' : impact === 'soft' ? 'Soft impact' : 'No impact';
  return (
    <span className={className} aria-label={label} data-impact={impact}>
      {label}
    </span>
  );
}
