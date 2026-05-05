import { MessageCircle, NotebookPen } from 'lucide-react';

export interface SelectionMenuProps {
  rect: DOMRect | null;
  onChat: () => void;
  onAnnotate: () => void;
}

export function SelectionMenu({ rect, onChat, onAnnotate }: SelectionMenuProps) {
  if (!rect) return null;
  const GAP = 8;
  const ESTIMATED_HEIGHT = 36;
  const top = rect.top - ESTIMATED_HEIGHT - GAP;
  const left = rect.left + rect.width / 2;
  return (
    <div
      data-selection-menu
      role="toolbar"
      aria-label="Selection actions"
      style={{
        position: 'fixed',
        top: `${Math.max(top, GAP)}px`,
        left: `${left}px`,
        transform: 'translateX(-50%)',
        zIndex: 60,
      }}
      className="pointer-events-auto inline-flex items-center gap-0.5 rounded-md bg-white p-0.5 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.08)]"
    >
      <button
        type="button"
        onClick={onChat}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-ink hover:bg-[rgba(0,0,0,0.04)]"
      >
        <MessageCircle className="size-3.5" aria-hidden />
        Chat
      </button>
      <button
        type="button"
        onClick={onAnnotate}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-ink hover:bg-[rgba(0,0,0,0.04)]"
      >
        <NotebookPen className="size-3.5" aria-hidden />
        Annotate
      </button>
    </div>
  );
}
