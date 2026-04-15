// @vitest-environment happy-dom

import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMemoComponent } from './use-memo-component';

describe('useMemoComponent', () => {
  it('returns a stable memoized component that skips rerenders when props are unchanged', () => {
    let renderCount = 0;

    function Example({ label }: { label: string }) {
      renderCount += 1;
      return <span>{label}</span>;
    }

    const { result, rerender: rerenderHook } = renderHook(({ component }) => useMemoComponent(component), {
      initialProps: { component: Example },
    });

    const MemoExample = result.current;
    const rendered = render(<MemoExample label={'idle'} />);

    expect(renderCount).toBe(1);
    expect(screen.getByText('idle')).toBeTruthy();

    rendered.rerender(<MemoExample label={'idle'} />);

    expect(renderCount).toBe(1);

    rendered.rerender(<MemoExample label={'loading'} />);

    expect(renderCount).toBe(2);
    expect(screen.getByText('loading')).toBeTruthy();

    rerenderHook({ component: Example });

    expect(result.current).toBe(MemoExample);
  });
});
