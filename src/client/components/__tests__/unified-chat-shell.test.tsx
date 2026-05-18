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

function createHarness(secondaryChats: SecondaryChat[]): {
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
  it('renders the header strip with spec name, minimize + side-docked + toggle buttons, and close affordance', () => {
    const { Wrapper } = createHarness([]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    expect(screen.getByTestId('unified-chat-shell-spine-label').textContent).toContain('Test spec');
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

  it('close button removes the shell entirely (no bar, no pill); presence-driven expand brings it back', () => {
    const { Wrapper } = createHarness([makeChat(7)]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('unified-chat-shell-close'));
    expect(screen.queryByTestId('unified-chat-shell')).toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-collapsed')).toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-minimized')).toBeNull();
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

  it('side-docked button forwards "side-docked" on click; pressed when current mode matches', () => {
    const { Wrapper } = createHarness([]);
    const onLayoutModeChange = vi.fn();

    render(
      <Wrapper>
        <UnifiedChatShell layoutMode="side-docked" onLayoutModeChange={onLayoutModeChange} />
      </Wrapper>,
    );

    const sideDocked = screen.getByTestId('unified-chat-shell-layout-side-docked');
    expect(sideDocked.getAttribute('data-active')).toBe('true');
    fireEvent.click(sideDocked);
    expect(onLayoutModeChange).toHaveBeenCalledWith('side-docked');
  });

  it('compact↔maximize toggle flips its icon + target based on the current mode', () => {
    const onLayoutModeChange = vi.fn();

    let harness = createHarness([]);
    render(
      <harness.Wrapper>
        <UnifiedChatShell layoutMode="side-docked" onLayoutModeChange={onLayoutModeChange} />
      </harness.Wrapper>,
    );
    let toggle = screen.getByTestId('unified-chat-shell-layout-toggle');
    expect(toggle.getAttribute('data-mode-target')).toBe('maximize');
    expect(toggle.getAttribute('aria-label')).toBe('Maximize');
    expect(toggle.getAttribute('data-active')).toBe('false');
    fireEvent.click(toggle);
    expect(onLayoutModeChange).toHaveBeenLastCalledWith('maximize');

    cleanup();
    onLayoutModeChange.mockClear();
    harness = createHarness([]);
    render(
      <harness.Wrapper>
        <UnifiedChatShell layoutMode="compact" onLayoutModeChange={onLayoutModeChange} />
      </harness.Wrapper>,
    );
    toggle = screen.getByTestId('unified-chat-shell-layout-toggle');
    expect(toggle.getAttribute('data-mode-target')).toBe('maximize');
    expect(toggle.getAttribute('aria-label')).toBe('Maximize');
    expect(toggle.getAttribute('data-active')).toBe('true');
    fireEvent.click(toggle);
    expect(onLayoutModeChange).toHaveBeenLastCalledWith('maximize');

    cleanup();
    onLayoutModeChange.mockClear();
    harness = createHarness([]);
    render(
      <harness.Wrapper>
        <UnifiedChatShell layoutMode="maximize" onLayoutModeChange={onLayoutModeChange} />
      </harness.Wrapper>,
    );
    toggle = screen.getByTestId('unified-chat-shell-layout-toggle');
    expect(toggle.getAttribute('data-mode-target')).toBe('compact');
    expect(toggle.getAttribute('aria-label')).toBe('Compact');
    expect(toggle.getAttribute('data-active')).toBe('true');
    fireEvent.click(toggle);
    expect(onLayoutModeChange).toHaveBeenLastCalledWith('compact');
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
