import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ApprovedPinCard } from './ApprovedPinCard'
import type { ApprovedSelection } from '@/hooks/useApprovedSelection'

interface Props {
  selection: ApprovedSelection
}

export function ApprovedSelectionView({ selection }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        selection.next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        selection.prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection])

  if (selection.loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        Loading approved Pins…
      </div>
    )
  }

  if (selection.error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-lg font-semibold text-destructive">Error</h2>
          <p className="text-sm text-muted-foreground">{selection.error}</p>
          <button
            className="text-sm underline text-primary"
            onClick={() => void selection.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!selection.current) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="space-y-5 pt-8 pb-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
              <ClipboardCheck className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">No approved Pins yet</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Approve drafts in the Draft Queue, then come back here to copy
                them into Pinterest manually.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void selection.reload()}
              className="gap-2"
            >
              <RotateCw className="h-4 w-4" /> Reload
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { index, total, current, next, prev, reload } = selection
  const atFirst = index === 0
  const atLast = index === total - 1

  return (
    <>
      <div className="w-full max-w-xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Approved {index + 1} / {total}
          </span>
          <button
            onClick={() => void reload()}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            title="Reload approved list"
          >
            <RotateCw className="h-3 w-3" /> reload
          </button>
        </div>
        <div className="h-1.5 mt-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${total === 0 ? 0 : ((index + 1) / total) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start gap-6 py-6">
        <div className="w-full max-w-xl px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.asin}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <ApprovedPinCard draft={current} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-4 pb-2">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={prev}
            disabled={atFirst}
            aria-label="Previous (Left Arrow)"
            title="Previous  ←"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-16 text-center">
            {index + 1} / {total}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={next}
            disabled={atLast}
            aria-label="Next (Right Arrow)"
            title="Next  →"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  )
}
