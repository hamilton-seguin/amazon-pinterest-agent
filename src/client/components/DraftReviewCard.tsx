import { useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import type { PinDraft } from '../../types.js';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 140;

interface Props {
  draft: PinDraft;
  onApprove(): void;
  onSkip(): void;
}

export function DraftReviewCard({ draft, onApprove, onSkip }: Props) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const approveOpacity = useTransform(x, [40, 160], [0, 1]);
  const skipOpacity = useTransform(x, [-160, -40], [1, 0]);
  const [imgError, setImgError] = useState(false);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) onApprove();
    else if (info.offset.x < -SWIPE_THRESHOLD) onSkip();
  }

  return (
    <div className="relative w-full max-w-xl mx-auto px-4">
      <motion.div
        key={draft.asin}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x, rotate }}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: 'grabbing' }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="cursor-grab"
      >
        <Card className="overflow-hidden relative">
          <motion.div
            style={{ opacity: approveOpacity }}
            className="absolute top-6 left-6 z-10 rotate-[-12deg] border-4 border-success text-success font-extrabold text-3xl px-4 py-1 rounded-lg pointer-events-none"
          >
            APPROVE
          </motion.div>
          <motion.div
            style={{ opacity: skipOpacity }}
            className="absolute top-6 right-6 z-10 rotate-[12deg] border-4 border-destructive text-destructive font-extrabold text-3xl px-4 py-1 rounded-lg pointer-events-none"
          >
            SKIP
          </motion.div>

          <div className="relative aspect-[4/3] w-full bg-muted overflow-hidden flex items-center justify-center">
            {!imgError ? (
              <img
                src={draft.imageUrl}
                alt={draft.pinTitle}
                className="h-full w-full object-contain"
                onError={() => setImgError(true)}
                draggable={false}
              />
            ) : (
              <div className="text-muted-foreground text-sm">Image unavailable</div>
            )}
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge variant="secondary" className="bg-black/60 text-white border-transparent">
                {draft.category}
              </Badge>
              <Badge
                variant="default"
                className={cn(
                  'border-transparent text-white',
                  scoreColor(draft.score),
                )}
              >
                Score {draft.score}
              </Badge>
            </div>
          </div>

          <CardContent className="space-y-3">
            <h3 className="text-lg font-semibold leading-snug line-clamp-2">{draft.pinTitle}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-h-44 overflow-y-auto">
              {draft.pinDescription}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span className="font-mono">ASIN {draft.asin}</span>
              <a
                href={draft.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary transition-colors"
              >
                Affiliate link <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-success/80';
  if (score >= 40) return 'bg-primary/80';
  return 'bg-muted-foreground/70';
}
