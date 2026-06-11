import { useCallback, useEffect, useState } from 'react';

export interface SpecPersistedEnumConfig<T extends string> {
  /** Key slug: `brunch:<slug>:<specificationId>`. Stable per domain. */
  readonly slug: string;
  /** Value used on SSR, an absent key, or a failed decode. */
  readonly fallback: T;
  /** Narrows a stored string to a valid member; null means use `fallback`. */
  readonly decode: (raw: string | null) => T | null;
}

export function specPersistedEnumStorageKey(slug: string, specificationId: number | string): string {
  return `brunch:${slug}:${specificationId}`;
}

function readPersisted<T extends string>(
  specificationId: number | string,
  config: SpecPersistedEnumConfig<T>,
): T {
  if (typeof window === 'undefined') return config.fallback;
  try {
    const decoded = config.decode(
      window.localStorage.getItem(specPersistedEnumStorageKey(config.slug, specificationId)),
    );
    if (decoded !== null) return decoded;
  } catch {
    // ignore
  }
  return config.fallback;
}

function writePersisted<T extends string>(specificationId: number | string, slug: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(specPersistedEnumStorageKey(slug, specificationId), value);
  } catch {
    // ignore
  }
}

/**
 * Per-spec localStorage-backed enum state. Returns `[value, setValue]`; the
 * setter updates React state and persists synchronously. Restores the stored
 * value on mount and re-hydrates when `specificationId` changes. `config` is
 * expected to be a stable module constant.
 */
export function useSpecPersistedEnum<T extends string>(
  specificationId: number | string,
  config: SpecPersistedEnumConfig<T>,
): readonly [T, (next: T) => void] {
  const [value, setValueState] = useState<T>(() => readPersisted(specificationId, config));

  useEffect(() => {
    setValueState(readPersisted(specificationId, config));
  }, [specificationId, config]);

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      writePersisted(specificationId, config.slug, next);
    },
    [specificationId, config.slug],
  );

  return [value, setValue] as const;
}
