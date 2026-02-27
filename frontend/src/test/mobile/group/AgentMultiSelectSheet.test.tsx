import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentMultiSelectSheet } from '@/components/mobile/group/AgentMultiSelectSheet'

const agents: any[] = Array.from({ length: 6 }).map((_, i) => ({
  agent: {
    id: `a${i + 1}`,
    name: `Agent ${i + 1}`,
    icon: '🤖',
    color: '#6366f1',
  },
  status: i === 0 ? 'offline' : 'online',
}))

describe('AgentMultiSelectSheet', () => {
  it('requires at least 2 agents and enforces max 5', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<AgentMultiSelectSheet agents={agents} onConfirm={onConfirm} onClose={onClose} />)

    const continueBtn = screen.getByRole('button', { name: /Continue \(0\)/ })
    expect(continueBtn).toBeDisabled()

    fireEvent.click(screen.getByText('Agent 1'))
    fireEvent.click(screen.getByText('Agent 2'))

    const continue2 = screen.getByRole('button', { name: /Continue \(2\)/ })
    expect(continue2).not.toBeDisabled()

    fireEvent.click(screen.getByText('Agent 3'))
    fireEvent.click(screen.getByText('Agent 4'))
    fireEvent.click(screen.getByText('Agent 5'))
    fireEvent.click(screen.getByText('Agent 6'))

    fireEvent.click(screen.getByRole('button', { name: /Continue \(5\)/ }))
    expect(onConfirm).toHaveBeenCalledWith(['a1', 'a2', 'a3', 'a4', 'a5'])

    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onClose).toHaveBeenCalled()
  })
})
