/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ActivityLogStream } from '@/components/world3d/ActivityLogStream'

vi.mock('@/services/activityService', () => ({
  fetchActivityEntries: vi.fn(),
  subscribeToActivityUpdates: vi.fn(),
}))
import { fetchActivityEntries, subscribeToActivityUpdates } from '@/services/activityService'

const entries = [
  {
    id: '1',
    timestamp: Date.now(),
    sessionKey: 's',
    type: 'message',
    icon: '💬',
    description: 'Hello',
  },
]

describe('ActivityLogStream', () => {
  beforeEach(() => {
    ;(fetchActivityEntries as any).mockResolvedValue(entries)
    ;(subscribeToActivityUpdates as any).mockImplementation((_k: string, cb: () => void) => {
      cb()
      return () => {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading then renders activity entries', async () => {
    render(<ActivityLogStream sessionKey="s1" />)
    expect(screen.getByText('Loading activity…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument())
  })

  it('shows empty state when no entries', async () => {
    ;(fetchActivityEntries as any).mockResolvedValueOnce([])
    render(<ActivityLogStream sessionKey="s2" />)
    await waitFor(() => expect(screen.getByText('No recent activity')).toBeInTheDocument())
  })

  it('renders full log button and handles hover/click', async () => {
    const onOpenFullLog = vi.fn()
    render(<ActivityLogStream sessionKey="s3" onOpenFullLog={onOpenFullLog} />)
    await waitFor(() => expect(screen.getByText('View Full Log →')).toBeInTheDocument())
    const btn = screen.getByText('View Full Log →')
    fireEvent.mouseEnter(btn)
    fireEvent.mouseLeave(btn)
    fireEvent.click(btn)
    expect(onOpenFullLog).toHaveBeenCalled()
  })
})
