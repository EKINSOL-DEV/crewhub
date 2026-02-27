import * as React from 'react'

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>( // NOSONAR: renders span when htmlFor is absent
  ({ className, htmlFor, ...props }, ref) => {
    const baseClass = `text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className || ''}`

    if (!htmlFor) {
      return <span className={baseClass}>{props.children}</span>
    }

    return <label ref={ref} htmlFor={htmlFor} className={baseClass} {...props} />
  }
)
Label.displayName = 'Label'
