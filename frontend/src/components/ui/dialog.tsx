import * as React from 'react'
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Native Dialog Implementation for React 19 Compatibility
 *
 * This replaces Radix UI Dialog to work around a critical bug in
 * @radix-ui/react-compose-refs that causes infinite update loops with React 19.
 * See: https://github.com/radix-ui/primitives/issues/3799
 *
 * API is compatible with the shadcn/ui Dialog component.
 */

// Dialog Context
interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  contentId: string
  titleId: string
  descriptionId: string
}

const DialogContext = createContext<DialogContextValue | null>(null)

function useDialogContext() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog')
  }
  return context
}

// Generate unique IDs
let idCounter = 0
function useId(prefix: string) {
  const [id] = useState(() => `${prefix}-${++idCounter}`)
  return id
}

// Dialog Root
interface DialogProps {
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly defaultOpen?: boolean
  readonly children: React.ReactNode
  readonly modal?: boolean
}

function Dialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const contentId = useId('dialog-content')
  const titleId = useId('dialog-title')
  const descriptionId = useId('dialog-description')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const onOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      controlledOnOpenChange?.(newOpen)
    },
    [isControlled, controlledOnOpenChange]
  )

  const contextValue = useMemo(
    () => ({ open, onOpenChange, triggerRef, contentId, titleId, descriptionId }),
    [open, onOpenChange, triggerRef, contentId, titleId, descriptionId]
  )

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  )
}

// Dialog Trigger
interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly asChild?: boolean
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild, children, onClick, ...props }, forwardedRef) => {
    const { onOpenChange, triggerRef } = useDialogContext()

    // Combine refs manually without compose-refs
    const ref = useCallback(
      (node: HTMLButtonElement | null) => {
        // Update forwarded ref
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          ;(forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
        }
        // Update internal ref
        ;(triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
      },
      [forwardedRef, triggerRef]
    )

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (!e.defaultPrevented) {
        onOpenChange(true)
      }
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref,
        onClick: handleClick,
        ...props,
      })
    }

    return (
      <button ref={ref} type="button" onClick={handleClick} {...props}>
        {children}
      </button>
    )
  }
)
DialogTrigger.displayName = 'DialogTrigger'

// Dialog Portal - just renders children (portal handled by dialog element)
interface DialogPortalProps {
  readonly children: React.ReactNode
  readonly container?: HTMLElement | null
}

function DialogPortal({ children }: DialogPortalProps) {
  return <>{children}</>
}

// Dialog Overlay - handled by native dialog backdrop
interface DialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>((_props, _ref) => {
  // Native dialog handles overlay via ::backdrop pseudo-element
  // This component exists for API compatibility but renders nothing
  return null
})
DialogOverlay.displayName = 'DialogOverlay'

// Dialog Close
interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly asChild?: boolean
}

const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ asChild, children, onClick, ...props }, ref) => {
    const { onOpenChange } = useDialogContext()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (!e.defaultPrevented) {
        onOpenChange(false)
      }
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref,
        onClick: handleClick,
        ...props,
      })
    }

    return (
      <button ref={ref} type="button" onClick={handleClick} {...props}>
        {children}
      </button>
    )
  }
)
DialogClose.displayName = 'DialogClose'

// Dialog Content
interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly onEscapeKeyDown?: (event: KeyboardEvent) => void
  readonly onPointerDownOutside?: (event: PointerEvent) => void
  readonly onInteractOutside?: (event: Event) => void
  readonly forceMount?: boolean
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, onEscapeKeyDown, onPointerDownOutside, ...props }, ref) => {
    const { open, onOpenChange, triggerRef, contentId, titleId, descriptionId } = useDialogContext()
    const dialogRef = useRef<HTMLDialogElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    // Combine content refs
    const setContentRef = useCallback(
      (node: HTMLDivElement | null) => {
        ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    // Sync open state with native dialog
    useEffect(() => {
      const dialog = dialogRef.current
      if (!dialog) return

      if (open) {
        if (!dialog.open) {
          dialog.showModal()
        }
      } else if (dialog.open) {
        dialog.close()
        // Return focus to trigger
        triggerRef.current?.focus()
      }
    }, [open, triggerRef])

    // Handle native dialog close (ESC key)
    const handleDialogClose = useCallback(() => {
      onOpenChange(false)
    }, [onOpenChange])

    // Handle backdrop click
    const handleBackdropClick = useCallback(
      (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false)
        }
      },
      [onOpenChange]
    )

    // Handle ESC key with custom handler
    useEffect(() => {
      if (!open) return

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onEscapeKeyDown?.(e)
          // Native dialog handles actual close
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open, onEscapeKeyDown])

    return (
      <dialog // NOSONAR: <dialog> is a native interactive HTML element
        ref={dialogRef}
        onClose={handleDialogClose}
        onClick={handleBackdropClick}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && e.key === 'Escape') handleDialogClose()
        }}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="
          fixed inset-0 z-[60] m-0 h-screen w-screen max-h-none max-w-none
          bg-transparent p-0 overflow-y-auto
          backdrop:bg-black/80
          open:flex open:items-center open:justify-center
        "
      >
        <div // NOSONAR: onClick only prevents event bubble, not interactive
          ref={setContentRef}
          id={contentId}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            'relative w-full max-w-lg mx-4 my-4',
            'grid gap-4 border bg-background p-6 shadow-lg sm:rounded-lg',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            className
          )}
          {...props}
        >
          {children}
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </dialog>
    )
  }
)
DialogContent.displayName = 'DialogContent'

// Dialog Header
interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogHeader = ({ className, ...props }: DialogHeaderProps) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

// Dialog Footer
interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogFooter = ({ className, ...props }: DialogFooterProps) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

// Dialog Title
interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => {
    const { titleId } = useDialogContext()
    return (
      <h2
        ref={ref}
        id={titleId}
        className={cn('text-lg font-semibold leading-none tracking-tight', className)}
        {...props}
      />
    )
  }
)
DialogTitle.displayName = 'DialogTitle'

// Dialog Description
interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => {
    const { descriptionId } = useDialogContext()
    return (
      <p
        ref={ref}
        id={descriptionId}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    )
  }
)
DialogDescription.displayName = 'DialogDescription'

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
