// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense, type ReactElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';
import type { SpecificationState } from '@/shared/specification.js';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: '1' }),
}));

vi.mock('@/client/lib/secondary-chat-stream.js', () => ({
  streamSecondaryChatMessage: vi.fn(),
}));

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
  };
}

function createHarness(secondaryChats: SecondaryChat[]): {
  Wrapper: ({ children }: { children: ReactNode }) => ReactElement;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(specificationQueryKeys.bundle('1'), buildSpec(secondaryChats));
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

describe('UnifiedChatShell — C12 skeleton', () => {
  it('renders the header strip with spec name, four layout buttons, and a close affordance', () => {
    const { Wrapper } = createHarness([]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    expect(screen.getByTestId('unified-chat-shell-spine-label').textContent).toContain('Test spec');
    expect(screen.getByTestId('unified-chat-shell-layout-compact')).not.toBeNull();
    expect(screen.getByTestId('unified-chat-shell-layout-side-docked')).not.toBeNull();
    expect(screen.getByTestId('unified-chat-shell-layout-maximize')).not.toBeNull();
    expect(screen.getByTestId('unified-chat-shell-layout-full')).not.toBeNull();
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

  it('renders one SecondaryChatHost per active secondary chat in creation (id-ascending) order', () => {
    const { Wrapper } = createHarness([makeChat(7), makeChat(8, 'edit'), makeChat(11)]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    const collapsibles = screen.getAllByTestId('secondary-chat-collapsible');
    expect(collapsibles).toHaveLength(3);
    expect(collapsibles.map((el) => el.getAttribute('data-secondary-chat-id'))).toEqual(['7', '8', '11']);
  });

  it('collapses to a bar when the close button is clicked, and re-expands via the expand button', () => {
    const { Wrapper } = createHarness([makeChat(7)]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('unified-chat-shell-close'));
    expect(screen.queryByTestId('unified-chat-shell')).toBeNull();
    expect(screen.getByTestId('unified-chat-shell-collapsed')).not.toBeNull();

    fireEvent.click(screen.getByTestId('unified-chat-shell-expand'));
    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-collapsed')).toBeNull();
  });

  it('forwards layout-mode clicks to onLayoutModeChange when supplied (inert when omitted)', () => {
    const { Wrapper } = createHarness([]);
    const onLayoutModeChange = vi.fn();

    render(
      <Wrapper>
        <UnifiedChatShell layoutMode="maximize" onLayoutModeChange={onLayoutModeChange} />
      </Wrapper>,
    );

    expect(screen.getByTestId('unified-chat-shell').getAttribute('data-layout-mode')).toBe('maximize');
    fireEvent.click(screen.getByTestId('unified-chat-shell-layout-full'));
    expect(onLayoutModeChange).toHaveBeenCalledWith('full');

    cleanup();

    const inert = createHarness([]);
    render(
      <inert.Wrapper>
        <UnifiedChatShell />
      </inert.Wrapper>,
    );
    expect((screen.getByTestId('unified-chat-shell-layout-full') as HTMLButtonElement).disabled).toBe(true);
  });
});
