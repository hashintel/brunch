import { describe, expect, it, vi } from 'vitest';

import { withCookBus } from './presenter.js';
import { CookBus } from './presenter/bus.js';

describe('withCookBus', () => {
  it('runs the work with a bus and disposes it afterward', async () => {
    const dispose = vi.spyOn(CookBus.prototype, 'dispose');
    let seen: CookBus | undefined;

    await withCookBus('cook', async (bus) => {
      seen = bus;
    });

    expect(seen).toBeInstanceOf(CookBus);
    expect(dispose).toHaveBeenCalledTimes(1);
    dispose.mockRestore();
  });

  it('disposes the bus even when the work throws', async () => {
    const dispose = vi.spyOn(CookBus.prototype, 'dispose');

    await expect(
      withCookBus('plan', async () => {
        throw new Error('work boom');
      }),
    ).rejects.toThrow('work boom');

    expect(dispose).toHaveBeenCalledTimes(1);
    dispose.mockRestore();
  });
});
