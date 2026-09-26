import { useCallback, useEffect, useState } from 'react';
import { isApiError } from '@/core/api/error';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const errorMessage = (e: unknown): string =>
  isApiError(e) ? e.message : e instanceof Error ? e.message : 'Something went wrong';

/**
 * Runs an async loader on mount and whenever `deps` change. Returns state plus a
 * `reload` function for manual refresh after mutations.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> & {
  reload: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });

  const run = useCallback(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((e) => {
        if (active) setState({ data: null, loading: false, error: errorMessage(e) });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const [nonce, setNonce] = useState(0);
  useEffect(() => run(), [run, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
