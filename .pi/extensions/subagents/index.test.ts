import { describe, expect, it } from 'vitest';

import { Semaphore } from './index.js';

describe('vendored subagent Semaphore', () => {
  it('admits up to the configured limit and drains every waiter', async () => {
    const semaphore = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const completed: number[] = [];

    await Promise.all(
      [1, 2, 3, 4, 5].map((id) =>
        semaphore.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          completed.push(id);
          active -= 1;
        }),
      ),
    );

    expect(peak).toBe(2);
    expect(completed).toHaveLength(5);
  });

  it('hands a released permit to the oldest waiter before a new arrival', async () => {
    const semaphore = new Semaphore(1);
    const started: string[] = [];
    let active = 0;
    let peak = 0;
    let releaseFirst!: () => void;

    const first = semaphore.run(async () => {
      started.push('first');
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      active -= 1;
    });
    const second = semaphore.run(async () => {
      started.push('second');
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
    });

    releaseFirst();
    const third = semaphore.run(async () => {
      started.push('third');
      active += 1;
      peak = Math.max(peak, active);
      active -= 1;
    });

    await Promise.all([first, second, third]);
    expect(started).toEqual(['first', 'second', 'third']);
    expect(peak).toBe(1);
  });
});
