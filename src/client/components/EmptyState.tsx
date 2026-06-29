import { CheckCircle2, RotateCw, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CopyField } from './CopyField'

interface Props {
  approved: number
  skipped: number
  total: number
  onReload(): void
}

export function EmptyState({ approved, skipped, total, onReload }: Props) {
  const reviewed = approved + skipped
  const nothingThisSession = reviewed === 0

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <CardContent className="space-y-5 pt-8 pb-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {nothingThisSession ? 'Draft queue is empty' : 'All done'}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {nothingThisSession
                ? 'No drafts with status "drafted" right now.'
                : `Reviewed ${reviewed} drafts. Approved saved to data/approved.json.`}
            </p>
          </div>

          {total > 0 && (
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <div className="text-success text-2xl font-bold">
                  {approved}
                </div>
                <div className="text-muted-foreground">approved</div>
              </div>
              <div>
                <div className="text-destructive text-2xl font-bold">
                  {skipped}
                </div>
                <div className="text-muted-foreground">skipped</div>
              </div>
            </div>
          )}

          <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-left text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Terminal className="h-3.5 w-3.5" /> Adding more drafts
            </div>
            <p className="text-muted-foreground">
              If <code className="font-mono">data/candidates.json</code> has new
              items collected by{' '}
              <code className="font-mono">npm run collect</code> (or the daily
              pipeline), convert them into drafts with:
            </p>
            <pre className="font-mono text-[11px] bg-background/60 rounded px-2 py-1.5 overflow-x-auto">
              npm run draft -- --manual
            </pre>
            <p className="text-muted-foreground">
              Then click <span className="font-medium">Reload queue</span>.
            </p>
          </div>

          <Button variant="outline" onClick={onReload} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Reload queue
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
