import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { invalidateBrunchUpdate } from '../subscriptions/brunch-updates.js';

function notification(updates: unknown[], topics: string[] = []) {
  return { jsonrpc: '2.0' as const, method: 'brunch.updated', params: { topics, updates } };
}

describe('brunch.updated execute topic invalidation', () => {
  it('invalidates the exact run detail/list keys and trace indexes', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    invalidateBrunchUpdate(
      queryClient,
      notification([{ topic: 'execute.runs' }, { topic: 'execute.run', runId: 'run-1' }]),
    );

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.runs'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.runTraceIndex'] });
    expect(invalidate).toHaveBeenCalledTimes(4);
  });

  it('falls back to broad run-detail invalidation for a bare execute.run topic', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    invalidateBrunchUpdate(queryClient, notification([], ['execute.run', 'execute.runs']));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.runs'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.runTraceIndex'] });
  });
});
