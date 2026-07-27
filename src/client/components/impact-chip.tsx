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
  // Drop the "impact" word — the chip color already
  // encodes severity, so "Hard" / "Soft" / "None" reads as the chip's job
  // without redundant noise.
  const label = impact === 'hard' ? 'Hard' : impact === 'soft' ? 'Soft' : 'None';
  return (
    <span className={className} aria-label={label} data-impact={impact}>
      {label}
    </span>
  );
}
