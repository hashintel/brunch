import { store as createStore, type StateObject, type StatePrimitive, type Store } from '@simplestack/store';
import { useState, useSyncExternalStore } from 'react';

export { store as createStore } from '@simplestack/store';

export { useStoreValue } from '@simplestack/store/react';

export function useStoreState<T extends StateObject | StatePrimitive>(
  storeObj: Store<T>,
): readonly [T, (value: T | ((prevState: T) => T)) => void, () => T] {
  const storeVal = useSyncExternalStore(storeObj.subscribe, storeObj.get, storeObj.get);
  return [storeVal, storeObj.set, storeObj.get] as const;
}

export function useStore<T extends StateObject | StatePrimitive>(initValue: T): Store<T> {
  const [storeObj] = useState<Store<T>>(() => createStore(initValue));
  return storeObj;
}
