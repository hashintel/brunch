import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/client/lib/utils';
import type { WorkflowPhase, WorkflowPhaseStatus } from '@/shared/api-types.js';

// ── Stage sidebar (expanded, 240px) ──────────────────────────────────

export interface StageItem {
  key: string;
  label: string;
  status: 'done' | 'active' | 'future';
  children?: StageItem[];
}

function StageIcon({ status }: { status: StageItem['status'] }) {
  if (status === 'done') {
    return (
      <span className="flex size-3.5 items-center justify-center">
        <span className="size-[10.5px] rounded-full bg-[#2070e6]" />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="flex size-3.5 items-center justify-center">
        <span className="size-[10.5px] rounded-full border-[1.3px] border-[#2070e6]" />
      </span>
    );
  }
  return (
    <span className="flex size-3.5 items-center justify-center">
      <span className="size-[10.5px] rounded-full border-[1.3px] border-dashed border-[rgba(0,0,0,0.35)]" />
    </span>
  );
}

function StageRow({
  stage,
  depth = 0,
  onClick,
}: {
  stage: StageItem;
  depth?: number;
  onClick?: (key: string) => void;
}) {
  const isTopLevel = depth === 0;
  return (
    <>
      <button
        type="button"
        onClick={() => onClick?.(stage.key)}
        className={cn(
          'flex h-8 w-full items-center gap-1.5 rounded-md text-xs font-medium',
          isTopLevel ? 'px-2' : 'pr-3.5 pl-6',
          stage.status === 'future' ? 'text-sub' : 'text-ink',
        )}
      >
        <StageIcon status={stage.status} />
        <span className="flex-1 text-left">{stage.label}</span>
        {stage.children && stage.children.length > 0 && <ChevronRight className="size-3 text-hint" />}
      </button>
      {stage.children?.map((child) => (
        <StageRow key={child.key} stage={child} depth={depth + 1} onClick={onClick} />
      ))}
    </>
  );
}

export function StageSidebar({
  stages,
  projectLabel = 'Project Spec',
  onStageClick,
  onCollapse,
}: {
  stages: StageItem[];
  projectLabel?: string;
  onStageClick?: (key: string) => void;
  onCollapse?: () => void;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-2 border-r border-rule bg-tint py-2">
      <div className="flex flex-1 flex-col gap-1">
        {/* Project selector */}
        <div className="px-2">
          <button
            type="button"
            className="flex h-8 w-full items-center gap-1.5 rounded-md border border-primary/20 bg-white px-2 text-xs font-medium text-ink shadow-[var(--shadow-card),0px_0px_0px_1px_rgba(32,112,230,0.2)]"
          >
            <span className="flex-1 text-left">{projectLabel}</span>
            <ChevronDown className="size-3 text-hint" />
          </button>
        </div>

        {/* Stage list */}
        <nav className="mt-1 flex flex-col gap-0.5 px-2">
          {stages.map((stage) => (
            <StageRow key={stage.key} stage={stage} onClick={onStageClick} />
          ))}
        </nav>
      </div>

      {/* Collapse button */}
      <div className="flex justify-end px-2">
        <button
          type="button"
          onClick={onCollapse}
          className="flex size-8 items-center justify-center rounded-md bg-wash text-sub"
          title="Collapse sidebar"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
    </aside>
  );
}

// ── Phase sidebar (narrow, 48px) — collapsed view ────────────────────

export type Phase = WorkflowPhase;
export type PhaseStatus = WorkflowPhaseStatus;

const phaseOrder: Phase[] = ['scope', 'design', 'requirements', 'criteria'];

function PhasePill({
  index,
  phase,
  status,
  isActive,
  onClick,
}: {
  index: number;
  phase: Phase;
  status: PhaseStatus;
  isActive: boolean;
  onClick?: () => void;
}) {
  const isFuture = status === 'unstarted';

  return (
    <button
      type="button"
      onClick={onClick}
      title={phase[0].toUpperCase() + phase.slice(1)}
      className={cn(
        'flex size-8 items-center justify-center rounded-md text-sm font-medium transition-colors',
        isActive &&
          'border border-primary/20 bg-card text-foreground shadow-[var(--shadow-card),0px_0px_0px_1px_rgba(0,0,0,0.08)]',
        !isActive && !isFuture && 'bg-card text-foreground shadow-[var(--shadow-card-ring)]',
        isFuture && !isActive && 'bg-wash text-sub',
      )}
    >
      {index + 1}
    </button>
  );
}

export function PhaseSidebar({
  phases,
  activePhase,
  onPhaseClick,
  onExpand,
}: {
  phases: Record<Phase, PhaseStatus>;
  activePhase: Phase;
  onPhaseClick?: (phase: Phase) => void;
  onExpand?: () => void;
}) {
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center justify-between border-r border-rule bg-tint py-2">
      <div className="flex flex-col gap-2">
        {phaseOrder.map((phase, i) => (
          <PhasePill
            key={phase}
            index={i}
            phase={phase}
            status={phases[phase]}
            isActive={phase === activePhase}
            onClick={() => onPhaseClick?.(phase)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onExpand}
        className="flex size-8 items-center justify-center rounded-md bg-wash text-sub"
        title="Expand sidebar"
      >
        <ChevronRight className="size-4" />
      </button>
    </aside>
  );
}

// ── Empty state card ──────────────────────────────────────────────────

export function EmptyCard({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border border-dashed border-rule bg-[#f7f7f7] p-4',
        className,
      )}
    >
      {title && <p className="text-sm font-medium text-sub">{title}</p>}
      <p className="text-xs leading-relaxed text-hint">{description}</p>
      {children}
    </div>
  );
}

// ── Shell button primitives ───────────────────────────────────────────

export function Button({
  variant = 'ghost',
  size = 'md',
  className,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: 'ghost' | 'outline' | 'primary';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'ghost' && 'bg-wash text-sub hover:bg-wash/80',
        variant === 'outline' && 'bg-card text-foreground shadow-[var(--shadow-card-ring)]',
        variant === 'primary' &&
          'bg-gradient-to-b from-[#3484fa] to-[#2070e6] text-white shadow-[0px_0px_0px_1px_#1060d6,inset_0px_1px_1px_0px_rgba(255,255,255,0.2)]',
        size === 'md' && 'h-8 px-3.5 text-sm',
        size === 'sm' && 'h-7 px-2.5 text-xs-plus',
        className,
      )}
      {...props}
    />
  );
}

// ── Tab switcher ─────────────────────────────────────────────────────

export function TabSwitcher({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange?: (key: string) => void;
}) {
  return (
    <div className="flex items-start rounded-[9px] bg-tint p-[3px]">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange?.(tab.key)}
            className={cn(
              'flex h-8 items-center justify-center rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors',
              isActive && 'bg-card text-foreground shadow-[var(--shadow-card-ring)]',
              !isActive && 'text-sub hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
