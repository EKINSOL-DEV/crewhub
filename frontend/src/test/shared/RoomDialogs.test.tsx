import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CreateRoomDialog } from '@/components/shared/CreateRoomDialog'
import { DeleteRoomDialog } from '@/components/shared/DeleteRoomDialog'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, 'open', { value: true, writable: true, configurable: true })
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, 'open', { value: false, writable: true, configurable: true })
  })
})

describe('CreateRoomDialog', () => {
  const onOpenChange = vi.fn()
  const onChange = vi.fn()
  const onCreate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with current value and handles input/actions', () => {
    render(
      <CreateRoomDialog
        open
        onOpenChange={onOpenChange}
        onChange={onChange}
        onCreate={onCreate}
        value={{ name: 'Research Lab', icon: '🧠', color: '#4f46e5' }}
      />
    )

    expect(screen.getByText('Create New Room')).toBeInTheDocument()
    expect(screen.getByText('ID: research-lab-room')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Room Name'), { target: { value: 'New Name' } })
    expect(onChange).toHaveBeenCalled()

    fireEvent.keyDown(screen.getByLabelText('Room Name'), { key: 'Enter' })
    expect(onCreate).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Create Room').closest('button') as HTMLButtonElement)
    expect(onCreate).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByText('Cancel').closest('button') as HTMLButtonElement)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('allows selecting icon and color buttons', () => {
    render(
      <CreateRoomDialog
        open
        onOpenChange={onOpenChange}
        onChange={onChange}
        onCreate={onCreate}
        value={{ name: '', icon: '🧠', color: '#4f46e5' }}
      />
    )

    fireEvent.click(screen.getByText('💻').closest('button') as HTMLButtonElement)
    expect(onChange).toHaveBeenCalled()

    const colorButtons = document.querySelectorAll('button[style*="background-color"]')
    fireEvent.click(colorButtons[1] as HTMLButtonElement)
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})

describe('DeleteRoomDialog', () => {
  it('renders and handles confirm/cancel', () => {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()

    render(<DeleteRoomDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />)

    expect(screen.getByText('Delete Room?')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Delete Room').closest('button') as HTMLButtonElement)
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Cancel').closest('button') as HTMLButtonElement)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
