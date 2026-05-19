import { ArrowDownToDot, Pencil, Spline } from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '@/client/lib/utils.js';

import { CHAT_SHELL_SPRING, usePrefersReducedMotion } from './use-prefers-reduced-motion.js';

type ProposeChangeKind = 'edit' | 'edge' | 'drill_down';

interface ChipDef {
  readonly kind: ProposeChangeKind;
  readonly label: string;
  readonly hint: string;
  readonly prompt: string;
  readonly Icon: typeof Pencil;
}

// Action-shaped prompts mirror the assistant tool-call kinds (propose_edit,
// propose_edge, propose_drill_down) so Agent-mode chips wire directly into the
// patch-staging pipeline once the assistant returns.
const CHIPS: readonly ChipDef[] = [
  {
    kind: 'edit',
    label: 'Edit',
    hint: 'Propose a content change to this item',
    prompt: 'Propose an edit to this item.',
    Icon: Pencil,
  },
  {
    kind: 'edge',
    label: 'Connect',
    hint: 'Propose a relationship to another item',
    prompt: 'Propose a new edge linking this item to a related one.',
    Icon: Spline,
  },
  {
    kind: 'drill_down',
    label: 'Drill down',
    hint: 'Decompose into finer items',
    prompt: 'Propose a drill-down that decomposes this item into finer pieces.',
    Icon: ArrowDownToDot,
  },
];

export interface ProposeChangeChipsProps {
  readonly onPick: (prompt: string) => void;
  readonly disabled?: boolean;
  readonly pinnedAccent?: string | null;
}

/**
 * Three "propose a change" chips surfaced above the composer textarea while
 * the chat is in Agent (edit) mode on an item-pinned chat. Always visible —
 * not turn-zero gated — so the user can re-invoke a structured action at any
 * point in the conversation.
 */
export function ProposeChangeChips({ onPick, disabled, pinnedAccent }: ProposeChangeChipsProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const fadeSpring = prefersReducedMotion ? { duration: 0 } : CHAT_SHELL_SPRING;
  return (
    <motion.div
      data-testid="propose-change-chips"
      initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fadeSpring}
      className="flex flex-wrap gap-1.5"
    >
      {CHIPS.map(({ kind, label, hint, prompt, Icon }) => (
        <button
          key={kind}
          type="button"
          data-testid={`propose-change-chip-${kind}`}
          data-kind={kind}
          disabled={disabled}
          onClick={() => onPick(prompt)}
          title={hint}
          style={pinnedAccent ? { borderColor: `${pinnedAccent}33`, color: pinnedAccent } : undefined}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-rule bg-background px-2 py-0.5 text-xs',
            'transition-[transform,background-color,color] duration-150',
            'hover:enabled:bg-tint hover:enabled:text-ink active:enabled:scale-95',
            'disabled:opacity-50',
          )}
        >
          <Icon aria-hidden className="size-3" />
          <span>{label}</span>
        </button>
      ))}
    </motion.div>
  );
}
