import { AlertTriangle, CheckCircle2, Edit3, Hourglass, Loader2, XCircle } from 'lucide-react';

import type {
  ReconciliationNeedAgentClassification,
  ReconciliationNeedAgentStatus,
} from '@/shared/reconciliation-need.js';

type Variant = 'queued' | 'classifying' | 'auto-confirm' | 'auto-edit' | 'substantive' | 'failed';

interface ChipStyle {
  icon: typeof Hourglass;
  label: string;
  accent: string;
  animated?: boolean;
}

const VARIANT_STYLES: Record<Variant, ChipStyle> = {
  queued: { icon: Hourglass, label: 'queued', accent: '#6b7280' },
  classifying: { icon: Loader2, label: 'classifying', accent: '#3484fa', animated: true },
  'auto-confirm': { icon: CheckCircle2, label: 'auto-confirm', accent: '#16a34a' },
  'auto-edit': { icon: Edit3, label: 'auto-edit', accent: '#ea580c' },
  substantive: { icon: AlertTriangle, label: 'substantive', accent: '#a16207' },
  failed: { icon: XCircle, label: 'failed', accent: '#dc2626' },
};

function variantFor(
  status: ReconciliationNeedAgentStatus | null,
  classification: ReconciliationNeedAgentClassification | null,
): Variant | null {
  if (status === null) return null;
  if (status === 'queued') return 'queued';
  if (status === 'classifying') return 'classifying';
  if (status === 'failed') return 'failed';
  if (classification === 'auto-confirm') return 'auto-confirm';
  if (classification === 'auto-edit') return 'auto-edit';
  if (classification === 'substantive') return 'substantive';
  return null;
}

export interface ClassificationChipProps {
  agentStatus: ReconciliationNeedAgentStatus | null;
  agentClassification: ReconciliationNeedAgentClassification | null;
  agentProposal: string | null;
}

export function ClassificationChip({
  agentStatus,
  agentClassification,
  agentProposal,
}: ClassificationChipProps): React.ReactElement | null {
  const variant = variantFor(agentStatus, agentClassification);
  if (variant === null) return null;

  const style = VARIANT_STYLES[variant];
  const Icon = style.icon;
  const tooltip =
    variant === 'failed' && agentProposal !== null && agentProposal.length > 0 ? agentProposal : style.label;

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
      style={{ backgroundColor: `${style.accent}14`, color: style.accent }}
      data-classification-chip={variant}
      title={tooltip}
    >
      <Icon className={style.animated === true ? 'size-3 animate-spin' : 'size-3'} aria-hidden />
      {style.label}
    </span>
  );
}

export const __testing = { variantFor };
