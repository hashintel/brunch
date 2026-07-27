// @vitest-environment happy-dom

import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock for the create-master-chat mutation so each test can drive
// the latch/effect deterministically without spinning a real fetch.
const { createSpy, resultRef, isPendingRef } = vi.hoisted(() => ({
  createSpy:
    vi.fn<
      (request: { parentChatId: number }) => Promise<{ chatId: number; kickoffTurnId: number | null } | null>
    >(),
  resultRef: {
    current: { chatId: 99, kickoffTurnId: 1 } as { chatId: number; kickoffTurnId: number | null } | null,
  },
  isPendingRef: { current: false },
}));

vi.mock('../secondary-chat-trigger.js', () => ({
  useCreateMasterChatMutation: () => ({
    create: createSpy,
    isPending: isPendingRef.current,
  }),
}));

const { useMasterChatBootstrap } = await import('../use-master-chat-bootstrap.js');

function Harness(props: { specificationId: number; parentChatId: number | null; hasMaster: boolean }) {
  useMasterChatBootstrap(props);
  return null;
}

beforeEach(() => {
  createSpy.mockReset();
  createSpy.mockImplementation(() => Promise.resolve(resultRef.current));
  resultRef.current = { chatId: 99, kickoffTurnId: 1 };
  isPendingRef.current = false;
});

afterEach(() => {
  cleanup();
});

describe('useMasterChatBootstrap', () => {
  it('no-ops when hasMaster is true', () => {
    render(<Harness specificationId={1} parentChatId={7} hasMaster={true} />);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('no-ops when parentChatId is null', () => {
    render(<Harness specificationId={1} parentChatId={null} hasMaster={false} />);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('fires create exactly once per (specId, parentChatId) pair within one mount', async () => {
    const { rerender } = render(<Harness specificationId={1} parentChatId={7} hasMaster={false} />);
    // Re-render with the same inputs — the latch must suppress the second call.
    rerender(<Harness specificationId={1} parentChatId={7} hasMaster={false} />);
    rerender(<Harness specificationId={1} parentChatId={7} hasMaster={false} />);
    // Wait one microtask for any pending promise chain.
    await Promise.resolve();
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith({ parentChatId: 7 });
  });

  it('releases the latch on a null create result so the next effect run retries the same pair', async () => {
    // First mount: create resolves to null (server/network error path).
    resultRef.current = null;
    const { rerender } = render(<Harness specificationId={1} parentChatId={7} hasMaster={false} />);
    // Let the rejected create settle so the latch can clear.
    await Promise.resolve();
    await Promise.resolve();
    expect(createSpy).toHaveBeenCalledTimes(1);

    // Bundle invalidation might (transiently) reflect a master before reverting,
    // or some other dep change re-runs the effect. We simulate the simplest
    // dep-change re-run: hasMaster flips true → false. If the latch had NOT
    // been released, the second false-render would early-return because the
    // ref still pointed at the prior `(1:7)` key. Releasing on null lets the
    // retry fire with the same key.
    resultRef.current = { chatId: 99, kickoffTurnId: 1 };
    rerender(<Harness specificationId={1} parentChatId={7} hasMaster={true} />);
    await Promise.resolve();
    rerender(<Harness specificationId={1} parentChatId={7} hasMaster={false} />);
    await Promise.resolve();
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it('auto-retries with the same deps after a null create result (bot round 5)', async () => {
    // Reproduces Cursor Bugbot's "Master bootstrap latch blocks retry" report:
    // a failed create followed by a re-render with identical deps must still
    // retry, instead of stranding the shell on "Opening chat…".
    resultRef.current = null;
    await act(async () => {
      render(<Harness specificationId={1} parentChatId={7} hasMaster={false} />);
    });
    // Auto-retry triggered by setRetryAttempt should re-fire without any dep change.
    await waitFor(() => {
      expect(createSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('caps auto-retries to bound the failure storm (bot round 5)', async () => {
    resultRef.current = null;
    await act(async () => {
      render(<Harness specificationId={1} parentChatId={7} hasMaster={false} />);
    });
    // Let auto-retries settle, then assert the cap holds (1 initial + 2 retries).
    await waitFor(() => {
      expect(createSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    // Extra flushes — the cap should prevent more attempts beyond MAX (3).
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(createSpy.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('fires once per pair: changing parentChatId triggers a fresh create', async () => {
    const { rerender } = render(<Harness specificationId={1} parentChatId={7} hasMaster={false} />);
    await Promise.resolve();
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenLastCalledWith({ parentChatId: 7 });

    rerender(<Harness specificationId={1} parentChatId={8} hasMaster={false} />);
    await Promise.resolve();
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenLastCalledWith({ parentChatId: 8 });
  });
});
