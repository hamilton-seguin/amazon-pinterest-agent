import { useEffect, useState } from 'react'
import type { PinDraft } from '../../types.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  draft: PinDraft | undefined
  open: boolean
  onOpenChange(open: boolean): void
  onSave(updates: {
    pinTitle?: string
    pinDescription?: string
  }): Promise<void> | void
}

export function EditDraftDialog({ draft, open, onOpenChange, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open && draft) {
      setTitle(draft.pinTitle)
      setDescription(draft.pinDescription)
    }
  }, [open, draft])

  async function handleSave() {
    if (!draft) return
    const nextTitle = title.trim()
    const nextDesc = description.trim()
    const updates: { pinTitle?: string; pinDescription?: string } = {}
    if (nextTitle && nextTitle !== draft.pinTitle.trim()) {
      updates.pinTitle = nextTitle
    }
    if (nextDesc && nextDesc !== draft.pinDescription.trim()) {
      updates.pinDescription = nextDesc
    }
    if (Object.keys(updates).length > 0) await onSave(updates)
    onOpenChange(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Edit draft</DialogTitle>
          <DialogDescription>
            Update pin title and description before approving.
            <span className="opacity-70">
              {' '}
              Cmd/Ctrl + Enter to save, Esc to cancel.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-title">
              Pin title
            </label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-desc">
              Pin description
            </label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
