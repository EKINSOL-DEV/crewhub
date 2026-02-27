import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  DragDropProvider,
  useDragState,
  useDragActions,
  useDragDrop,
} from '@/contexts/DragDropContext'

function Consumer() {
  const state = useDragState()
  const actions = useDragActions()
  const combined = useDragDrop()

  return (
    <div>
      <div data-testid="dragging">{String(state.isDragging)}</div>
      <div data-testid="session">{state.sessionKey ?? 'none'}</div>
      <div data-testid="error">{state.error ?? 'none'}</div>
      <div data-testid="combined">{String(combined.drag.isDragging)}</div>

      <button onClick={() => actions.startDrag('s1', 'Session 1', 'room-a')}>start</button>
      <button onClick={actions.endDrag}>end</button>
      <button onClick={() => void actions.dropOnRoom('room-b')}>drop-room</button>
      <button onClick={() => void actions.dropOnParking()}>drop-parking</button>
      <button onClick={actions.clearError}>clear-error</button>
      <button onClick={() => actions.setInteractingWithUI(true)}>ui-on</button>
    </div>
  )
}

describe('DragDropContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts/ends drag and handles escape cancel', () => {
    render(
      <DragDropProvider>
        <Consumer />
      </DragDropProvider>
    )

    fireEvent.click(screen.getByText('start'))
    expect(screen.getByTestId('dragging')).toHaveTextContent('true')
    expect(screen.getByTestId('session')).toHaveTextContent('s1')
    expect(screen.getByTestId('combined')).toHaveTextContent('true')
    expect(screen.getByLabelText('Drag and drop parking overlay')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('dragging')).toHaveTextContent('false')

    fireEvent.click(screen.getByText('start'))
    fireEvent.click(screen.getByText('end'))
    expect(screen.getByTestId('dragging')).toHaveTextContent('false')
  })

  it('drops on room successfully and invokes callback', async () => {
    const onAssignmentChanged = vi.fn()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DragDropProvider onAssignmentChanged={onAssignmentChanged}>
        <Consumer />
      </DragDropProvider>
    )

    fireEvent.click(screen.getByText('start'))
    fireEvent.click(screen.getByText('drop-room'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/session-room-assignments'),
        expect.objectContaining({ method: 'POST' })
      )
    })
    expect(onAssignmentChanged).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('dragging')).toHaveTextContent('false')
  })

  it('handles drop errors and clears error', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ detail: 'cannot move' }), { status: 400 })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DragDropProvider>
        <Consumer />
      </DragDropProvider>
    )

    fireEvent.click(screen.getByText('start'))
    fireEvent.click(screen.getByText('drop-room'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('cannot move')
    })

    fireEvent.click(screen.getByText('clear-error'))
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('drops on parking (DELETE) and treats 404 as success', async () => {
    const onAssignmentChanged = vi.fn()
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DragDropProvider onAssignmentChanged={onAssignmentChanged}>
        <Consumer />
      </DragDropProvider>
    )

    fireEvent.click(screen.getByText('start'))
    fireEvent.click(screen.getByText('drop-parking'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/session-room-assignments/s1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
    expect(onAssignmentChanged).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('dragging')).toHaveTextContent('false')
  })
})
