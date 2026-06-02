import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ModalShellProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  maxWidth?: number
  showEscBadge?: boolean
}

export function ModalShell({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 420,
  showEscBadge = false,
}: ModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn('p-5 gap-0')}
        style={{ maxWidth }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="mb-4 flex-row items-center justify-between space-y-0">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
            {description && (
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                {description}
              </DialogDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showEscBadge && (
              <kbd className="text-[11px] px-1.5 py-0.5 bg-muted border border-border rounded text-muted-foreground">
                ESC
              </kbd>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </Button>
          </div>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
