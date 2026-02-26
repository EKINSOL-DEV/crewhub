import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({
  value: '',
  onValueChange: () => {},
})

interface TabsProps {
  readonly defaultValue?: string
  readonly value?: string
  readonly onValueChange?: (value: string) => void
  readonly className?: string
  readonly children: React.ReactNode
}

export function Tabs({
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const value = controlledValue ?? internalValue
  const handleChange = React.useCallback(
    (v: string) => {
      setInternalValue(v)
      onValueChange?.(v)
    },
    [onValueChange]
  )

  const tabsContextValue = React.useMemo(
    () => ({ value, onValueChange: handleChange }),
    [value, handleChange]
  )

  return (
    <TabsContext.Provider value={tabsContextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  readonly className?: string
  readonly children: React.ReactNode
}

export function TabsList({ className, children }: TabsListProps) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  readonly value: string
  readonly className?: string
  readonly children: React.ReactNode
}

export function TabsTrigger({ value, className, children }: TabsTriggerProps) {
  const { value: selected, onValueChange } = React.useContext(TabsContext)
  const isActive = selected === value

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive && 'bg-background text-foreground shadow-sm',
        className
      )}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  readonly value: string
  readonly className?: string
  readonly children: React.ReactNode
}

export function TabsContent({ value, className, children }: TabsContentProps) {
  const { value: selected } = React.useContext(TabsContext)
  if (selected !== value) return null

  return (
    <div
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </div>
  )
}
