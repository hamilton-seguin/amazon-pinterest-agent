import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PinDraft } from '../../types.js'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyField } from './CopyField'
import { cn } from '@/lib/utils'

interface Props {
  draft: PinDraft
}

function formatAll(d: PinDraft): string {
  return [
    `Title:\n${d.pinTitle}`,
    ``,
    `Description:\n${d.pinDescription}`,
    ``,
    `Link:\n${d.affiliateUrl}`,
    ``,
    `Image:\n${d.imageUrl}`,
  ].join('\n')
}

export function ApprovedPinCard({ draft }: Props) {
  const [imgError, setImgError] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(formatAll(draft))
      setCopiedAll(true)
      window.setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      // ignore — per-field copy still works
    }
  }

  return (
    <Card className="overflow-hidden">
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
          <Badge
            variant="secondary"
            className="bg-black/60 text-white border-transparent"
          >
            {draft.category}
          </Badge>
          <Badge
            variant="default"
            className={cn(
              'border-transparent text-white',
              draft.score >= 70
                ? 'bg-success/80'
                : draft.score >= 40
                  ? 'bg-primary/80'
                  : 'bg-muted-foreground/70',
            )}
          >
            Score {draft.score}
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">ASIN {draft.asin}</span>
          <a
            href={draft.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
          >
            Open in new tab <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <CopyField label="Title" value={draft.pinTitle} />
        <CopyField label="Description" value={draft.pinDescription} multiline />
        <CopyField label="Affiliate Link" value={draft.affiliateUrl} />
        <CopyField label="Image URL" value={draft.imageUrl} />

        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            variant={copiedAll ? 'success' : 'secondary'}
            size="sm"
            onClick={handleCopyAll}
          >
            {copiedAll ? 'Copied all!' : 'Copy all fields'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
