import { AlertTriangle, CheckCircle2, Edit3, Hourglass, Loader2, XCircle } from 'lucide-react';

import type {
  ReconciliationNeedAgentClassification,
  ReconciliationNeedAgentStatus,
} from '@/shared/reconciliation-need.js';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip.js';

type Variant = 'queued' | 'classifying' | 'auto-confirm' | 'auto-edit' | 'substantive' | 'failed';

interface ChipStyle {
  icon: typeof Hourglass;
  label: string;
  accent: string;
  animated?: boolean;
}

const VARIANT_STYLES: Record<Variant, ChipStyle> = {
  queued: { icon: Hourglass, label: 'Queued', accent: '#6b7280' },
  classifying: { icon: Loader2, label: 'Classifying', accent: '#3484fa', animated: true },
  'auto-confirm': { icon: CheckCircle2, label: 'Auto-confirm', accent: '#16a34a' },
  'auto-edit': { icon: Edit3, label: 'Auto-edit', accent: '#ea580c' },
  substantive: { icon: AlertTriangle, label: 'Substantive', accent: '#a16207' },
  failed: { icon: XCircle, label: 'Failed', accent: '#dc2626' },
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
  // For failed rows, surface the agent's error message in the tooltip
  // instead of the generic "Failed" label so the user can immediately
  // see why classification didn't succeed.
  const tooltipBody =
    variant === 'failed' && agentProposal !== null && agentProposal.length > 0 ? agentProposal : style.label;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            // Icon-only badge. Background fill at ~8% alpha keeps the
            // accent legible without competing with the row's text. The
            // status label moves into the tooltip — keeps the row chrome
            // tight while preserving discoverability on hover/focus. The
            // `title` attribute mirrors the tooltip body so the native
            // hover tooltip still works in keyboard-only or non-pointer
            // contexts.
            className="inline-flex size-4 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ backgroundColor: `${style.accent}14`, color: style.accent }}
            data-classification-chip={variant}
            data-classification-label={style.label}
            tabIndex={0}
            aria-label={style.label}
            title={tooltipBody}
          >
            <Icon className={style.animated === true ? 'size-3 animate-spin' : 'size-3'} aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent data-classification-chip-tooltip={variant} className="max-w-[260px] text-xs">
          <span className="font-medium">{style.label}</span>
          {tooltipBody !== style.label && (
            <span className="mt-1 block text-[11px] whitespace-pre-wrap opacity-90">{tooltipBody}</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const __testing = { variantFor };
