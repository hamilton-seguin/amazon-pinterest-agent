import { useCallback, useEffect, useState } from 'react';
import type { PinDraft } from '../../types.js';
import { draftsApi } from '@/lib/apiClient';

interface State {
  loading: boolean;
  error: string | null;
  approved: PinDraft[];
  index: number;
}

export interface ApprovedSelection extends State {
  current: PinDraft | undefined;
  total: number;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  reload(): Promise<void>;
}

export function useApprovedSelection(enabled = true): ApprovedSelection {
  const [state, setState] = useState<State>({
    loading: enabled,
    error: null,
    approved: [],
    index: 0,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const approved = await draftsApi.list('approved');
      setState((s) => ({
        ...s,
        loading: false,
        approved,
        index: Math.min(s.index, Math.max(0, approved.length - 1)),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const total = state.approved.length;
  const current = state.approved[state.index];

  const next = useCallback(
    () =>
      setState((s) => ({
        ...s,
        index: s.approved.length === 0 ? 0 : Math.min(s.index + 1, s.approved.length - 1),
      })),
    [],
  );
  const prev = useCallback(
    () => setState((s) => ({ ...s, index: Math.max(s.index - 1, 0) })),
    [],
  );
  const goTo = useCallback(
    (i: number) =>
      setState((s) => ({
        ...s,
        index: s.approved.length === 0 ? 0 : Math.max(0, Math.min(i, s.approved.length - 1)),
      })),
    [],
  );

  return { ...state, current, total, next, prev, goTo, reload: load };
}
