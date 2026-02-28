import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StepProgress } from '@/components/onboarding/steps/StepProgress'

describe('StepProgress', () => {
  it('renders the correct number of step indicators', () => {
    const { container } = render(<StepProgress step={1} total={5} />)
    const steps = container.querySelectorAll('[class*="flex-1"]')
    expect(steps.length).toBe(5)
  })

  it('marks completed steps with primary bg', () => {
    const { container } = render(<StepProgress step={3} total={5} />)
    const steps = Array.from(container.querySelectorAll('[class*="flex-1"]'))
    const primarySteps = steps.filter((s) => s.className.includes('bg-primary'))
    expect(primarySteps.length).toBe(3)
  })

  it('marks remaining steps with muted bg', () => {
    const { container } = render(<StepProgress step={2} total={6} />)
    const steps = Array.from(container.querySelectorAll('[class*="flex-1"]'))
    const mutedSteps = steps.filter((s) => s.className.includes('bg-muted'))
    expect(mutedSteps.length).toBe(4)
  })

  it('marks all steps as primary when step=total', () => {
    const { container } = render(<StepProgress step={4} total={4} />)
    const steps = Array.from(container.querySelectorAll('[class*="flex-1"]'))
    const primarySteps = steps.filter((s) => s.className.includes('bg-primary'))
    expect(primarySteps.length).toBe(4)
  })

  it('marks all steps as muted when step=0', () => {
    const { container } = render(<StepProgress step={0} total={5} />)
    const steps = Array.from(container.querySelectorAll('[class*="flex-1"]'))
    const mutedSteps = steps.filter((s) => s.className.includes('bg-muted'))
    expect(mutedSteps.length).toBe(5)
  })

  it('renders with total=1', () => {
    const { container } = render(<StepProgress step={1} total={1} />)
    const steps = container.querySelectorAll('[class*="flex-1"]')
    expect(steps.length).toBe(1)
  })

  it('renders with a large number of steps', () => {
    const { container } = render(<StepProgress step={7} total={10} />)
    const steps = container.querySelectorAll('[class*="flex-1"]')
    expect(steps.length).toBe(10)
  })

  it('renders inside a flex container', () => {
    const { container } = render(<StepProgress step={2} total={4} />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('flex')
  })
})
