import { memo, useState, type ComponentType } from 'react';

export function useMemoComponent<C extends ComponentType<any>>(c: C) {
  const [memoized] = useState(() => memo(c));
  return memoized;
}
