import type { ReactNode } from 'react';

import { useChatShellPresence } from './chat-shell-presence.js';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable.js';
import { UnifiedChatShell, type ChatLayoutMode } from './unified-chat-shell.js';
import { useChatLayoutMode } from './use-chat-layout-mode.js';

const LAYOUT_MODE_SHELL_PERCENT: Record<'side-docked' | 'maximize', number> = {
  'side-docked': 50,
  maximize: 70,
};

export interface ChatShellLayoutProps {
  /** Keys the persisted layout-mode storage. */
  readonly specificationId: number | string;
  /** Workspace transcript, graph view, etc. */
  readonly center: ReactNode;
}

/**
 * Wraps `center` with the unified chat shell. Reads presence (minimized /
 * closed / expanded) and the persisted layout mode to dispatch between
 * resizable / compact / full / collapsed shapes. The shell is mounted once
 * per route consumer so closing it on the chat route doesn't affect the
 * graph route's local presence (and vice versa).
 */
export function ChatShellLayout({ specificationId, center }: ChatShellLayoutProps) {
  const { layoutMode, setLayoutMode } = useChatLayoutMode(specificationId);
  const presence = useChatShellPresence();

  if (presence?.isCollapsed) {
    return (
      <div className="h-full" data-testid="specification-view-layout" data-shell-layout-mode="collapsed">
        {center}
        <UnifiedChatShell layoutMode={layoutMode} onLayoutModeChange={setLayoutMode} />
      </div>
    );
  }

  if (layoutMode === 'full') {
    return (
      <div className="h-full" data-testid="specification-view-layout" data-shell-layout-mode="full">
        <UnifiedChatShell layoutMode="full" onLayoutModeChange={setLayoutMode} />
      </div>
    );
  }

  if (layoutMode === 'compact') {
    return (
      <div
        className="relative h-full"
        data-testid="specification-view-layout"
        data-shell-layout-mode="compact"
      >
        <div className="h-full">{center}</div>
        <div
          data-testid="unified-chat-shell-compact-dock"
          className="pointer-events-auto absolute right-4 bottom-4 z-30 flex h-[78vh] max-h-[calc(100%-2rem)] min-h-[420px] w-[456px] max-w-[504px] min-w-[432px] flex-col overflow-hidden rounded-lg border border-rule bg-background shadow-lg"
        >
          <UnifiedChatShell layoutMode="compact" onLayoutModeChange={setLayoutMode} />
        </div>
      </div>
    );
  }

  const shellSize = LAYOUT_MODE_SHELL_PERCENT[layoutMode];
  const centerSize = 100 - shellSize;
  return (
    <ResizablePanelGroup
      key={layoutMode}
      orientation="horizontal"
      className="h-full"
      data-testid="specification-view-layout"
      data-shell-layout-mode={layoutMode}
    >
      <ResizablePanel defaultSize={centerSize} minSize={20}>
        {center}
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={shellSize} minSize={20}>
        <UnifiedChatShell layoutMode={layoutMode} onLayoutModeChange={setLayoutMode} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export type { ChatLayoutMode };
