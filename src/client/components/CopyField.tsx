import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  multiline?: boolean;
  className?: string;
}

type Status = 'idle' | 'copied' | 'error';

const FEEDBACK_MS = 1500;

export function CopyField({ label, value, multiline = false, className }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<number | null>(null);
  const empty = !value;

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    if (empty) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('idle'), FEEDBACK_MS);
  }, [empty, value]);

  const buttonLabel =
    status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : 'Copy';

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </label>
        <Button
          type="button"
          variant={status === 'copied' ? 'success' : status === 'error' ? 'destructive' : 'outline'}
          size="sm"
          onClick={handleCopy}
          disabled={empty}
          className="h-7 px-2 text-xs gap-1.5"
          aria-label={`Copy ${label}`}
        >
          {status === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {buttonLabel}
        </Button>
      </div>
      <div
        className={cn(
          'rounded-md border border-border bg-input/60 px-3 py-2 text-sm break-words',
          multiline ? 'whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto' : 'truncate font-mono text-xs',
          empty && 'italic text-muted-foreground',
        )}
        title={value}
      >
        {empty ? '—' : value}
      </div>
    </div>
  );
}
