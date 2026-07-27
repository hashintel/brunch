import { Hand, Radar, Workflow } from 'lucide-react';
import type { ComponentType } from 'react';

import type { LayoutMode } from '@/client/components/graph/graphForces';
import { cn } from '@/client/lib/utils';

const MODES: ReadonlyArray<{ mode: LayoutMode; label: string; Icon: ComponentType<{ className?: string }> }> =
  [
    { mode: 'force', label: 'Force', Icon: Radar },
    { mode: 'workflow', label: 'Workflow', Icon: Workflow },
    { mode: 'free', label: 'Free', Icon: Hand },
  ];

export function GraphLayoutToggle({
  mode,
  onChange,
}: {
  mode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}) {
  return (
    <div
      data-graph-layout-toggle=""
      className="flex items-center gap-0.5 rounded-full border border-rule bg-white/90 p-0.5 shadow-[var(--shadow-card)] backdrop-blur-sm"
    >
      {MODES.map(({ mode: candidate, label, Icon }) => (
        <button
          key={candidate}
          type="button"
          data-graph-layout-mode={candidate}
          aria-label={`${label} layout`}
          aria-pressed={mode === candidate}
          title={`${label} layout`}
          onClick={() => onChange(candidate)}
          className={cn(
            'flex size-7 items-center justify-center rounded-full text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30',
            mode === candidate && 'bg-wash text-ink',
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
