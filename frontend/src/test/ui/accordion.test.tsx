import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

describe('accordion', () => {
  it('supports single mode open/close', () => {
    render(
      <Accordion type="single" defaultValue="a">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.queryByText('Content B')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Item B'))
    expect(screen.getByText('Content B')).toBeInTheDocument()
    expect(screen.queryByText('Content A')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Item B'))
    expect(screen.queryByText('Content B')).not.toBeInTheDocument()
  })

  it('supports multiple mode', () => {
    render(
      <Accordion type="multiple" defaultValue={['a']}>
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    fireEvent.click(screen.getByText('Item B'))
    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.getByText('Content B')).toBeInTheDocument()
  })
})
