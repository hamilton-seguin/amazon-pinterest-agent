import { cn } from '@/lib/utils';

interface Props {
  index: number;
  total: number;
  approved: number;
  skipped: number;
}

export function DraftProgress({ index, total, approved, skipped }: Props) {
  const current = Math.min(index + 1, total);
  const pct = total === 0 ? 0 : Math.min(100, (index / total) * 100);
  return (
    <div className="w-full max-w-xl mx-auto px-4 pt-6 pb-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span className="font-medium text-foreground">
          Draft {current} / {total}
        </span>
        <span>
          <span className="text-success">{approved} approved</span>
          <span className="mx-2 opacity-50">·</span>
          <span className="text-destructive">{skipped} skipped</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn('h-full bg-primary transition-all duration-300 ease-out')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
