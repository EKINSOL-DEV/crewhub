import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RoomsTab } from '@/components/settings/RoomsTab'

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  roomsHook: {
    rooms: [
      { id: 'room-main', name: 'Main', icon: '🏠', color: '#111111', sort_order: 0 },
      { id: 'room-dev', name: 'Dev', icon: '🛠️', color: '#222222', sort_order: 1 },
    ],
    createRoom: vi.fn(),
    updateRoom: vi.fn(),
    deleteRoom: vi.fn(),
    reorderRooms: vi.fn(),
    isLoading: false,
    getRoomFromRules: vi.fn(() => 'room-dev'),
  },
  rulesHook: {
    rules: [
      { id: 'r1', rule_type: 'keyword', rule_value: 'bug', room_id: 'room-dev', priority: 50 },
    ],
    createRule: vi.fn(),
    deleteRule: vi.fn(),
    updateRule: vi.fn(),
    isLoading: false,
  },
}))

vi.mock('@/hooks/useRooms', () => ({ useRooms: () => mocks.roomsHook }))
vi.mock('@/hooks/useRoomAssignmentRules', () => ({ useRoomAssignmentRules: () => mocks.rulesHook }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/components/shared/roomUtils', () => ({ generateRoomId: (s: string) => `id-${s}` }))
vi.mock('@/components/settings/shared', () => ({
  CollapsibleSection: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}))
vi.mock('@/components/shared/CreateRoomDialog', () => ({
  CreateRoomDialog: ({ open, onCreate, onChange, value }: any) =>
    open ? (
      <div>
        <input
          aria-label="room-name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <button onClick={onCreate}>confirm-create-room</button>
      </div>
    ) : null,
}))
vi.mock('@/components/shared/DeleteRoomDialog', () => ({
  DeleteRoomDialog: ({ open, onConfirm }: any) =>
    open ? <button onClick={onConfirm}>confirm-delete-room</button> : null,
}))

// make custom Select controls trivial to interact with
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder ?? 'value'}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))
vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => '' } } }))

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open')
    },
  })
  mocks.roomsHook.createRoom.mockResolvedValue({ success: true })
  mocks.roomsHook.updateRoom.mockResolvedValue({ success: true })
  mocks.roomsHook.deleteRoom.mockResolvedValue({ success: true })
  mocks.rulesHook.createRule.mockResolvedValue(true)
  mocks.rulesHook.deleteRule.mockResolvedValue(true)
})

describe('RoomsTab', () => {
  it('creates room and reports modal state changes', async () => {
    const onModalStateChange = vi.fn()
    render(
      <RoomsTab
        onModalStateChange={onModalStateChange}
        sessions={[{ key: 'agent:main:main', label: 'Main' } as any]}
      />
    )

    fireEvent.click(screen.getByText('Create New Room'))
    fireEvent.change(screen.getByLabelText('room-name'), { target: { value: 'Ops' } })
    fireEvent.click(screen.getByText('confirm-create-room'))

    await waitFor(() => expect(mocks.roomsHook.createRoom).toHaveBeenCalled())
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Room Created!' }))
    expect(onModalStateChange).toHaveBeenCalled()
  })

  it('deletes room via dialog', async () => {
    render(<RoomsTab />)
    const deleteButtons = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('hover:text-red-600'))
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByText('confirm-delete-room'))
    await waitFor(() => expect(mocks.roomsHook.deleteRoom).toHaveBeenCalled())
  })

  it('opens test rules dialog and renders match results', async () => {
    render(
      <RoomsTab
        sessions={[
          {
            key: 'agent:dev:subagent:x',
            label: 'bug fix',
            model: 'opus',
            channel: 'whatsapp',
          } as any,
        ]}
      />
    )

    fireEvent.click(screen.getByText('Test Rules'))
    expect(await screen.findByText(/Test Routing Rules/)).toBeInTheDocument()
    expect(screen.getAllByText('🛠️ Dev').length).toBeGreaterThan(0)
  })
})
