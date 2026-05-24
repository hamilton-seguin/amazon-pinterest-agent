import { Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onApprove(): void;
  onSkip(): void;
  onEdit(): void;
  disabled?: boolean;
}

export function DraftActions({ onApprove, onSkip, onEdit, disabled }: Props) {
  return (
    <div className="flex items-center justify-center gap-4 pb-2">
      <Button
        variant="destructive"
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={onSkip}
        disabled={disabled}
        aria-label="Reject (Left Arrow)"
        title="Reject  ←"
      >
        <X className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full"
        onClick={onEdit}
        disabled={disabled}
        aria-label="Edit (E)"
        title="Edit  E"
      >
        <Pencil className="h-5 w-5" />
      </Button>
      <Button
        variant="success"
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={onApprove}
        disabled={disabled}
        aria-label="Approve (Right Arrow)"
        title="Approve  →"
      >
        <Check className="h-6 w-6" />
      </Button>
    </div>
  );
}
