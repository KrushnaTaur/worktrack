import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";

interface AsyncState<T> { data: T | null; loading: boolean; error: string | null }

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}

/** Runs `fn` on mount and whenever `deps` change. Keeps the previous data while reloading. */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const [prevDeps, setPrevDeps] = useState(deps);

  // Inputs changed: flag "loading" during render instead of inside the effect.
  if (!sameDeps(prevDeps, deps)) {
    setPrevDeps(deps);
    setState((s) => ({ ...s, loading: true, error: null }));
  }

  useEffect(() => {
    let active = true;
    fn()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (active) setState((s) => ({ ...s, loading: false, error: getErrorMessage(err) }));
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, reload };
}
