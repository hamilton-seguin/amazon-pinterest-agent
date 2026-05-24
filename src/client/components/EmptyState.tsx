import { CheckCircle2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  approved: number;
  skipped: number;
  total: number;
  onReload(): void;
}

export function EmptyState({ approved, skipped, total, onReload }: Props) {
  const reviewed = approved + skipped;
  const message =
    total === 0
      ? 'No drafts pending review. Run `npm run generate:candidates` to fill the queue.'
      : `All ${reviewed} drafts reviewed. Approved are saved to data/approved.json.`;
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <CardContent className="space-y-5 pt-8 pb-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">All done</h2>
            <p className="text-sm text-muted-foreground mt-2">{message}</p>
          </div>
          {total > 0 && (
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <div className="text-success text-2xl font-bold">{approved}</div>
                <div className="text-muted-foreground">approved</div>
              </div>
              <div>
                <div className="text-destructive text-2xl font-bold">{skipped}</div>
                <div className="text-muted-foreground">skipped</div>
              </div>
            </div>
          )}
          <Button variant="outline" onClick={onReload} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Reload queue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
