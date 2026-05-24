import { ClipboardCheck, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppView = 'queue' | 'approved'

interface Props {
  view: AppView
  onChange(view: AppView): void
  approvedCount?: number
  queueCount?: number
}

const TABS: Array<{
  id: AppView
  label: string
  icon: typeof Layers
}> = [
  { id: 'queue', label: 'Draft Queue', icon: Layers },
  { id: 'approved', label: 'Approved Selection', icon: ClipboardCheck },
]

export function AppNavigation({
  view,
  onChange,
  approvedCount,
  queueCount,
}: Props) {
  return (
    <nav
      role="tablist"
      aria-label="Views"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1"
    >
      {TABS.map((tab) => {
        const active = tab.id === view
        const count =
          tab.id === 'queue'
            ? queueCount
            : tab.id === 'approved'
              ? approvedCount
              : undefined
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
            {typeof count === 'number' && (
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                  active
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground',
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
