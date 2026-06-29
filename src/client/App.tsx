import { useEffect, useState } from 'react'
import { useDraftReview } from '@/hooks/useDraftReview'
import { useApprovedSelection } from '@/hooks/useApprovedSelection'
import { AppNavigation, type AppView } from '@/components/AppNavigation'
import { DraftQueueView } from '@/components/DraftQueueView'
import { ApprovedSelectionView } from '@/components/ApprovedSelectionView'

export default function App() {
  const [view, setView] = useState<AppView>('queue')
  const review = useDraftReview()
  const approved = useApprovedSelection()

  // Refresh approved list whenever the queue's approve count changes so
  // newly-approved drafts appear in Approved Selection immediately.
  // `approved.reload` is stable (useCallback with no deps) so this won't loop.
  useEffect(() => {
    if (review.approvedCount > 0) void approved.reload()
  }, [review.approvedCount, approved.reload])

  // Refresh approved list when user switches to the approved view.
  useEffect(() => {
    if (view === 'approved') void approved.reload()
  }, [view, approved.reload])

  const queueRemaining = Math.max(0, review.total - review.index)

  const helpText =
    view === 'queue' ? '← skip · → approve · E edit' : '← previous · → next'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold tracking-tight">
            Amazon Product Review
          </h1>
          <AppNavigation
            view={view}
            onChange={setView}
            queueCount={review.loading ? undefined : queueRemaining}
            approvedCount={approved.loading ? undefined : approved.total}
          />
          <span className="text-xs text-muted-foreground hidden md:inline">
            {helpText}
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col" role="tabpanel">
        {view === 'queue' ? (
          <DraftQueueView review={review} />
        ) : (
          <ApprovedSelectionView selection={approved} />
        )}
      </div>
    </div>
  )
}
