// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense, type ReactElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import {
  PatchListProvider,
  usePatchList,
  type PatchAppliers,
  type StagePatchInput,
} from '@/client/components/patch-list-host.js';
import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';
import type { SpecificationState } from '@/shared/specification.js';

import { makeNeed } from './reconciliation-need-fixtures.js';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: '1' }),
}));

// Mock at the @ai-sdk/react boundary + the `ai` DefaultChatTransport so the
// host (rendered transitively by the shell) can render without hitting the
// real chat substrate from this happy-dom suite.
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(async () => {}),
    status: 'ready' as const,
  }),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    DefaultChatTransport: class DefaultChatTransport {
      constructor(_options: unknown) {}
    },
  };
});

const { UnifiedChatShell } = await import('../unified-chat-shell.js');

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

function buildSpec(secondaryChats: SecondaryChat[]): SpecificationState {
  return {
    specification: {
      id: 1,
      name: 'Test spec',
      mode: 'greenfield',
      active_turn_id: 42,
      primary_chat_id: 1,
      created_at: '2026-04-12 10:00:00',
      updated_at: '2026-04-12 10:00:00',
    },
    workflow: {
      phases: {
        grounding: {
          status: 'in_progress',
          closeability: false,
          readiness: 'low',
          closureBasis: null,
          proposalPending: false,
          turnId: null,
          summary: null,
        },
        design: {
          status: 'unstarted',
          closeability: false,
          readiness: 'low',
          closureBasis: null,
          proposalPending: false,
          turnId: null,
          summary: null,
        },
        requirements: {
          status: 'unstarted',
          closeability: false,
          readiness: 'low',
          closureBasis: null,
          proposalPending: false,
          turnId: null,
          summary: null,
        },
        criteria: {
          status: 'unstarted',
          closeability: false,
          readiness: 'low',
          closureBasis: null,
          proposalPending: false,
          turnId: null,
          summary: null,
        },
      },
    },
    turns: [],
    secondaryChats,
  };
}

function makeChat(id: number, mode: 'explore' | 'edit' = 'explore'): SecondaryChat {
  return {
    chat: {
      id,
      specification_id: 1,
      kind: 'side_chat',
      parent_chat_id: 1,
      invoked_in_turn_id: 3,
      pinned_item_id: 5,
      pinned_span_hint: null,
      pinned_reconciliation_need_id: null,
      mode,
    },
    kickoffTurn: null,
    turns: [],
    pinnedItemKind: 'context',
    pinnedReconciliationNeed: null,
    anchoredItemIds: [],
  };
}

function createHarness(
  secondaryChats: SecondaryChat[],
  options: { openNeeds?: ReadonlyArray<ReturnType<typeof makeNeed>> } = {},
): {
  Wrapper: ({ children }: { children: ReactNode }) => ReactElement;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(specificationQueryKeys.bundle('1'), buildSpec(secondaryChats));
  queryClient.setQueryData(specificationQueryKeys.entities('1'), {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
  });
  queryClient.setQueryData(specificationQueryKeys.reconciliationNeeds('1'), options.openNeeds ?? []);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="suspense-fallback" />}>{children}</Suspense>
    </QueryClientProvider>
  );
  return { Wrapper };
}

afterEach(() => {
  cleanup();
});

describe('UnifiedChatShell', () => {
  it('renders the header strip with minimize + side-docked + toggle buttons, and close affordance', () => {
    const { Wrapper } = createHarness([]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    // The spec name was removed from the header — only structural affordances
    // (chat switcher when applicable + layout/minimize/close buttons) live here.
    expect(screen.getByTestId('unified-chat-shell-spine-label').textContent).not.toContain('Test spec');
    expect(screen.getByTestId('unified-chat-shell-minimize')).not.toBeNull();
    expect(screen.getByTestId('unified-chat-shell-layout-side-docked')).not.toBeNull();
    expect(screen.getByTestId('unified-chat-shell-layout-toggle')).not.toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-layout-compact')).toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-layout-maximize')).toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-layout-full')).toBeNull();
    expect(screen.getByTestId('unified-chat-shell-close')).not.toBeNull();
  });

  it('defaults to side-docked layout when no layoutMode prop is supplied', () => {
    const { Wrapper } = createHarness([]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    expect(screen.getByTestId('unified-chat-shell').getAttribute('data-layout-mode')).toBe('side-docked');
    expect(screen.getByTestId('unified-chat-shell-layout-side-docked').getAttribute('data-active')).toBe(
      'true',
    );
  });

  it('renders the empty-state copy when the spec has no secondary chats', () => {
    const { Wrapper } = createHarness([]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    expect(screen.getByTestId('unified-chat-shell-empty')).not.toBeNull();
  });

  it('renders the most-recent (highest id) item-anchored chat by default; switcher hidden for a single chat', () => {
    const { Wrapper } = createHarness([makeChat(7)]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    const collapsibles = screen.getAllByTestId('secondary-chat-collapsible');
    expect(collapsibles).toHaveLength(1);
    expect(collapsibles[0]!.getAttribute('data-secondary-chat-id')).toBe('7');
    expect(screen.queryByTestId('chat-switcher-trigger')).toBeNull();
  });

  it('mounts the switcher when 2+ item-anchored chats exist; renders the most-recent as active', () => {
    const { Wrapper } = createHarness([makeChat(7), makeChat(8, 'edit'), makeChat(11)]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    const collapsibles = screen.getAllByTestId('secondary-chat-collapsible');
    expect(collapsibles).toHaveLength(1);
    expect(collapsibles[0]!.getAttribute('data-secondary-chat-id')).toBe('11');
    expect(screen.getByTestId('chat-switcher-trigger')).not.toBeNull();
  });

  it('close button collapses the shell to the "Ask Brunch" pill (same as minimize); presence-driven expand brings it back', () => {
    // "Ask Brunch" is a persistent affordance: the X button can't make the
    // chat entry point disappear entirely — closing collapses to the same
    // bottom-right pill as minimize so the user can always return.
    const { Wrapper } = createHarness([makeChat(7)]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('unified-chat-shell-close'));
    expect(screen.queryByTestId('unified-chat-shell')).toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-collapsed')).toBeNull();
    const pill = screen.getByTestId('unified-chat-shell-minimized');
    expect(pill.textContent).toContain('Ask Brunch');

    fireEvent.click(pill);
    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-minimized')).toBeNull();
  });

  it('minimized pill shows a badge with the number of open per-item subchats', () => {
    const { Wrapper } = createHarness([makeChat(7), makeChat(11)]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('unified-chat-shell-minimize'));
    const pill = screen.getByTestId('unified-chat-shell-minimized');
    expect(pill.getAttribute('data-open-chat-count')).toBe('2');
    expect(screen.getByTestId('unified-chat-shell-minimized-count').textContent).toBe('2');
  });

  it('minimize button collapses to a bottom-right "Ask Brunch" pill; clicking it restores', () => {
    const { Wrapper } = createHarness([makeChat(7)]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('unified-chat-shell-minimize'));
    expect(screen.queryByTestId('unified-chat-shell')).toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-collapsed')).toBeNull();
    const pill = screen.getByTestId('unified-chat-shell-minimized');
    expect(pill.textContent).toContain('Ask Brunch');

    fireEvent.click(pill);
    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-minimized')).toBeNull();
  });

  it('dock button toggles between "side-docked" and "compact"; pressed while in either', () => {
    // The single dock-vs-compact button is a toggle. In side-docked, it
    // shows the picture-in-picture icon and switches to compact. In compact,
    // it shows the panel-right icon and switches back to side-docked. In
    // either state, `data-active` is `true` (it represents "the chat is
    // currently in one of the two docked shapes").
    const { Wrapper } = createHarness([]);
    const onLayoutModeChange = vi.fn();

    render(
      <Wrapper>
        <UnifiedChatShell layoutMode="side-docked" onLayoutModeChange={onLayoutModeChange} />
      </Wrapper>,
    );
    const dockBtn = screen.getByTestId('unified-chat-shell-layout-side-docked');
    expect(dockBtn.getAttribute('data-active')).toBe('true');
    expect(dockBtn.getAttribute('data-mode-target')).toBe('compact');
    expect(dockBtn.getAttribute('aria-label')).toBe('Compact');
    fireEvent.click(dockBtn);
    expect(onLayoutModeChange).toHaveBeenLastCalledWith('compact');

    cleanup();
    onLayoutModeChange.mockClear();
    const next = createHarness([]);
    render(
      <next.Wrapper>
        <UnifiedChatShell layoutMode="compact" onLayoutModeChange={onLayoutModeChange} />
      </next.Wrapper>,
    );
    const dockBtn2 = screen.getByTestId('unified-chat-shell-layout-side-docked');
    expect(dockBtn2.getAttribute('data-active')).toBe('true');
    expect(dockBtn2.getAttribute('data-mode-target')).toBe('side-docked');
    expect(dockBtn2.getAttribute('aria-label')).toBe('Dock to side');
    fireEvent.click(dockBtn2);
    expect(onLayoutModeChange).toHaveBeenLastCalledWith('side-docked');
  });

  it('maximize toggle flips between "full" and the default "side-docked" based on the current mode', () => {
    // The header's Maximize button now renders the chat full-screen
    // (`'full'` hides the center workspace). Restoring from full goes back
    // to the default `'side-docked'` split. Compact has its own dock-toggle
    // button now, so the maximize-toggle only treats `'full'` as pressed.
    const onLayoutModeChange = vi.fn();

    let harness = createHarness([]);
    render(
      <harness.Wrapper>
        <UnifiedChatShell layoutMode="side-docked" onLayoutModeChange={onLayoutModeChange} />
      </harness.Wrapper>,
    );
    let toggle = screen.getByTestId('unified-chat-shell-layout-toggle');
    expect(toggle.getAttribute('data-mode-target')).toBe('full');
    expect(toggle.getAttribute('aria-label')).toBe('Maximize');
    expect(toggle.getAttribute('data-active')).toBe('false');
    fireEvent.click(toggle);
    expect(onLayoutModeChange).toHaveBeenLastCalledWith('full');

    cleanup();
    onLayoutModeChange.mockClear();
    harness = createHarness([]);
    render(
      <harness.Wrapper>
        <UnifiedChatShell layoutMode="compact" onLayoutModeChange={onLayoutModeChange} />
      </harness.Wrapper>,
    );
    toggle = screen.getByTestId('unified-chat-shell-layout-toggle');
    expect(toggle.getAttribute('data-mode-target')).toBe('full');
    expect(toggle.getAttribute('aria-label')).toBe('Maximize');
    // Compact is not pressed on the maximize-toggle anymore — that affordance
    // is owned by the dock-vs-compact button.
    expect(toggle.getAttribute('data-active')).toBe('false');
    fireEvent.click(toggle);
    expect(onLayoutModeChange).toHaveBeenLastCalledWith('full');

    cleanup();
    onLayoutModeChange.mockClear();
    harness = createHarness([]);
    render(
      <harness.Wrapper>
        <UnifiedChatShell layoutMode="full" onLayoutModeChange={onLayoutModeChange} />
      </harness.Wrapper>,
    );
    toggle = screen.getByTestId('unified-chat-shell-layout-toggle');
    expect(toggle.getAttribute('data-mode-target')).toBe('side-docked');
    expect(toggle.getAttribute('aria-label')).toBe('Restore');
    expect(toggle.getAttribute('data-active')).toBe('true');
    fireEvent.click(toggle);
    expect(onLayoutModeChange).toHaveBeenLastCalledWith('side-docked');
  });

  it('both layout buttons are disabled when no onLayoutModeChange is supplied', () => {
    const { Wrapper } = createHarness([]);
    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );
    expect((screen.getByTestId('unified-chat-shell-layout-side-docked') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByTestId('unified-chat-shell-layout-toggle') as HTMLButtonElement).disabled).toBe(true);
  });

  describe('ChatShellPatchPanel mount', () => {
    function makeAppliers(): PatchAppliers {
      const noop = vi.fn(() => Promise.resolve({ undo: () => Promise.resolve() }));
      return {
        annotate: noop as unknown as PatchAppliers['annotate'],
        edit: noop as unknown as PatchAppliers['edit'],
        edge: noop as unknown as PatchAppliers['edge'],
        drillDown: noop as unknown as PatchAppliers['drillDown'],
      };
    }

    interface StagerRef {
      current: { stage: ((input: StagePatchInput) => string) | null };
    }

    function Stager({ refs }: { refs: StagerRef }) {
      const actions = usePatchList();
      refs.current = { stage: actions ? (input) => actions.stage(input) : null };
      return null;
    }

    it('does not render the panel when no patches are staged', () => {
      const { Wrapper } = createHarness([makeChat(7)]);
      render(
        <Wrapper>
          <PatchListProvider appliers={makeAppliers()}>
            <UnifiedChatShell />
          </PatchListProvider>
        </Wrapper>,
      );
      expect(screen.queryByTestId('chat-shell-patch-panel')).toBeNull();
    });

    it('does not render the Pending review region when openNeeds is empty', () => {
      const { Wrapper } = createHarness([makeChat(7)]);
      render(
        <Wrapper>
          <PatchListProvider appliers={makeAppliers()}>
            <UnifiedChatShell />
          </PatchListProvider>
        </Wrapper>,
      );
      expect(screen.queryByRole('region', { name: 'Pending review' })).toBeNull();
    });

    it('mounts <PendingReviewSection /> inside the shell body when openNeeds is non-empty', () => {
      const need = makeNeed({ id: 12, specification_id: 1, target_item_id: 5 });
      const { Wrapper } = createHarness([makeChat(7)], { openNeeds: [need] });
      render(
        <Wrapper>
          <PatchListProvider appliers={makeAppliers()}>
            <UnifiedChatShell />
          </PatchListProvider>
        </Wrapper>,
      );
      const region = screen.getByRole('region', { name: 'Pending review' });
      const body = screen.getByTestId('unified-chat-shell-body');
      expect(body.contains(region)).toBe(true);
    });

    it('mounts the panel inside the shell body when staged patches exist', () => {
      const { Wrapper } = createHarness([makeChat(7)]);
      const refs: StagerRef = { current: { stage: null } };
      render(
        <Wrapper>
          <PatchListProvider appliers={makeAppliers()}>
            <Stager refs={refs} />
            <UnifiedChatShell />
          </PatchListProvider>
        </Wrapper>,
      );

      act(() => {
        refs.current.stage?.({
          kind: 'annotate',
          anchor: { kind: 'decision', itemId: 1 },
          summary: 'note',
          body: 'b',
        } as StagePatchInput);
      });

      const panel = screen.getByTestId('chat-shell-patch-panel');
      expect(panel).not.toBeNull();
      const body = screen.getByTestId('unified-chat-shell-body');
      // Panel lives inside the shell body (so it scrolls with body, hidden when shell is minimized/closed).
      expect(body.contains(panel)).toBe(true);
    });
  });
});
