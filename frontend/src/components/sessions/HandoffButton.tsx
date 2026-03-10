import { memo, useCallback, useRef, useState } from 'react'
import { ExternalLink, Terminal, Code, Clipboard, Check, Loader2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { executeHandoff, copyToClipboard, type HandoffTarget } from '@/lib/handoff'
import { useHandoffTargets } from '@/hooks/useHandoffTargets'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface HandoffButtonProps {
  /** Session key (e.g. claude:<uuid>, cc:<agent-id>, agent:main:main) */
  readonly sessionKey: string
  /** Optional working directory override */
  readonly workingDir?: string
  /** Size variant */
  readonly size?: 'sm' | 'default'
  /** Additional class names */
  readonly className?: string
}

const ICON_MAP: Record<string, typeof Terminal> = {
  terminal: Terminal,
  code: Code,
  clipboard: Clipboard,
}

function getTargetIcon(target: HandoffTarget) {
  return ICON_MAP[target.icon] || ExternalLink
}

export const HandoffButton = memo(function HandoffButton({
  sessionKey,
  workingDir,
  size = 'sm',
  className,
}: HandoffButtonProps) {
  const { targets, loading: targetsLoading } = useHandoffTargets()
  const [open, setOpen] = useState(false)
  const [executing, setExecuting] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleHandoff = useCallback(
    async (target: HandoffTarget) => {
      setOpen(false)
      setExecuting(target.id)

      try {
        const result = await executeHandoff(sessionKey, target.id, workingDir)

        if (result.success) {
          setSuccess(target.id)
          showToast({ message: result.message, duration: 3000 })
          setTimeout(() => setSuccess(null), 2000)
        } else {
          // Auto-fallback to clipboard
          if (result.fallback_command || result.command) {
            const cmd = result.fallback_command || result.command
            const copied = await copyToClipboard(cmd)
            if (copied) {
              showToast({
                message: `${target.label} failed. Command copied to clipboard.`,
                duration: 4000,
              })
              setSuccess('clipboard')
              setTimeout(() => setSuccess(null), 2000)
            } else {
              showToast({ message: result.error || 'Handoff failed', duration: 4000 })
            }
          } else {
            showToast({ message: result.error || 'Handoff failed', duration: 4000 })
          }
        }
      } catch (err) {
        showToast({
          message: err instanceof Error ? err.message : 'Handoff failed',
          duration: 4000,
        })
      } finally {
        setExecuting(null)
      }
    },
    [sessionKey, workingDir]
  )

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200)
  }, [])

  if (targetsLoading) return null

  // If only clipboard target available, show simple button
  if (targets.length === 1 && targets[0].id === 'clipboard') {
    const t = targets[0]
    const Icon = getTargetIcon(t)
    return (
      <Button
        size={size}
        variant="outline"
        className={cn('h-8 text-xs', className)}
        onClick={() => handleHandoff(t)}
        disabled={executing !== null}
      >
        {executing === t.id ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : success === t.id ? (
          <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
        ) : (
          <Icon className="h-3.5 w-3.5 mr-1.5" />
        )}
        {t.label}
      </Button>
    )
  }

  // Split button: primary action + dropdown
  const primaryTarget = targets[0]
  const PrimaryIcon = getTargetIcon(primaryTarget)

  return (
    <div
      className="relative inline-flex"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Primary button */}
      <Button
        size={size}
        variant="outline"
        className={cn('h-8 text-xs rounded-r-none border-r-0', className)}
        onClick={() => handleHandoff(primaryTarget)}
        disabled={executing !== null}
        title={`Continue in ${primaryTarget.label}`}
      >
        {executing === primaryTarget.id ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : success === primaryTarget.id ? (
          <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
        ) : (
          <PrimaryIcon className="h-3.5 w-3.5 mr-1.5" />
        )}
        Continue in...
      </Button>

      {/* Dropdown toggle */}
      <Button
        size={size}
        variant="outline"
        className="h-8 px-1.5 rounded-l-none"
        onClick={() => setOpen(!open)}
        disabled={executing !== null}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[200px] bg-popover border rounded-md shadow-md py-1 text-sm">
          {targets.map((target) => {
            const Icon = getTargetIcon(target)
            const isClipboard = target.id === 'clipboard'

            return (
              <button
                key={target.id}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left transition-colors',
                  isClipboard && 'border-t mt-1 pt-2'
                )}
                onClick={() => handleHandoff(target)}
                disabled={executing !== null}
              >
                {executing === target.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : success === target.id ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span>{isClipboard ? target.label : `Continue in ${target.label}`}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
