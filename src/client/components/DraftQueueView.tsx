import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useDraftReview, type DraftReview } from '@/hooks/useDraftReview';
import { DraftProgress } from '@/components/DraftProgress';
import { DraftReviewCard } from '@/components/DraftReviewCard';
import { DraftActions } from '@/components/DraftActions';
import { EditDraftDialog } from '@/components/EditDraftDialog';
import { EmptyState } from '@/components/EmptyState';

interface Props {
  review: DraftReview;
}

export function DraftQueueView({ review }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const handleApprove = useCallback(() => void review.approve(), [review]);
  const handleSkip = useCallback(() => void review.skip(), [review]);
  const handleEdit = useCallback(() => setEditOpen(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handleEdit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editOpen, handleApprove, handleSkip, handleEdit]);

  if (review.loading) {
    return <CenteredMessage>Loading drafts…</CenteredMessage>;
  }

  if (review.error) {
    return (
      <CenteredMessage>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-destructive">Error</h2>
          <p className="text-sm text-muted-foreground">{review.error}</p>
          <button className="text-sm underline text-primary" onClick={() => void review.reload()}>
            Retry
          </button>
        </div>
      </CenteredMessage>
    );
  }

  const isDone = !review.current;

  if (isDone) {
    return (
      <EmptyState
        approved={review.approvedCount}
        skipped={review.skippedCount}
        total={review.total}
        onReload={() => void review.reload()}
      />
    );
  }

  return (
    <>
      <DraftProgress
        index={review.index}
        total={review.total}
        approved={review.approvedCount}
        skipped={review.skippedCount}
      />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6">
        <AnimatePresence mode="wait">
          <DraftReviewCard
            key={review.current!.asin}
            draft={review.current!}
            onApprove={handleApprove}
            onSkip={handleSkip}
          />
        </AnimatePresence>
        <DraftActions onApprove={handleApprove} onSkip={handleSkip} onEdit={handleEdit} />
      </div>
      <EditDraftDialog
        draft={review.current}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={review.saveEdits}
      />
    </>
  );
}

export function useDraftQueue(): DraftReview {
  return useDraftReview();
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 text-center text-muted-foreground">
      {children}
    </div>
  );
}
