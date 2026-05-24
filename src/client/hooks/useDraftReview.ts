import { useCallback, useEffect, useState } from 'react';
import type { PinDraft } from '../../types.js';
import { draftsApi } from '@/lib/apiClient';

interface ReviewState {
  loading: boolean;
  error: string | null;
  drafts: PinDraft[];
  index: number;
  approvedCount: number;
  skippedCount: number;
}

export interface DraftReview extends ReviewState {
  current: PinDraft | undefined;
  total: number;
  approve(updates?: { pinTitle?: string; pinDescription?: string }): Promise<void>;
  skip(): Promise<void>;
  saveEdits(updates: { pinTitle?: string; pinDescription?: string }): Promise<void>;
  reload(): Promise<void>;
}

export function useDraftReview(): DraftReview {
  const [state, setState] = useState<ReviewState>({
    loading: true,
    error: null,
    drafts: [],
    index: 0,
    approvedCount: 0,
    skippedCount: 0,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const drafts = await draftsApi.list('drafted');
      setState((s) => ({
        ...s,
        loading: false,
        drafts,
        index: 0,
        approvedCount: 0,
        skippedCount: 0,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = state.drafts[state.index];
  const total = state.drafts.length;

  const advance = useCallback(
    (kind: 'approve' | 'skip') =>
      setState((s) => ({
        ...s,
        index: s.index + 1,
        approvedCount: kind === 'approve' ? s.approvedCount + 1 : s.approvedCount,
        skippedCount: kind === 'skip' ? s.skippedCount + 1 : s.skippedCount,
      })),
    [],
  );

  const approve = useCallback(
    async (updates?: { pinTitle?: string; pinDescription?: string }) => {
      if (!current) return;
      try {
        await draftsApi.approve(current.asin, updates);
        advance('approve');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, error: msg }));
      }
    },
    [current, advance],
  );

  const skip = useCallback(async () => {
    if (!current) return;
    try {
      await draftsApi.skip(current.asin);
      advance('skip');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, error: msg }));
    }
  }, [current, advance]);

  const saveEdits = useCallback(
    async (updates: { pinTitle?: string; pinDescription?: string }) => {
      if (!current) return;
      try {
        const updated = await draftsApi.update(current.asin, updates);
        setState((s) => {
          const next = [...s.drafts];
          next[s.index] = updated;
          return { ...s, drafts: next };
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, error: msg }));
      }
    },
    [current],
  );

  return {
    ...state,
    current,
    total,
    approve,
    skip,
    saveEdits,
    reload: load,
  };
}
