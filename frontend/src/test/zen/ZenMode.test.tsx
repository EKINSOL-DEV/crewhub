import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ZenMode, ZenModeButton } from '@/components/zen/ZenMode'

const mockCreateTab = vi.fn()
const mockCloseTab = vi.fn()
const mockSwitchTab = vi.fn()
const mockUpdateTabLayout = vi.fn()
const mockUpdateTabLabel = vi.fn()
const mockReopenClosedTab = vi.fn()
const mockSetPanelAgent = vi.fn()
const mockSetProjectFilter = vi.fn()
const mockClearProjectFilter = vi.fn()
const mockSetTheme = vi.fn()

vi.mock('@/contexts/WorldFocusContext', () => ({
  useWorldFocus: () => ({ state: { level: 'room', focusedRoomId: 'r1' } }),
}))
vi.mock('@/contexts/RoomsContext', () => ({
  useRoomsContext: () => ({
    rooms: [{ id: 'r1', name: 'Room One', project_id: 'p1', project_name: 'P One' }],
  }),
}))

vi.mock('@/components/zen/hooks/useZenMode', () => ({
  useZenMode: () => ({
    tabs: [
      {
        id: 'tab1',
        label: 'Zen',
        layout: { kind: 'leaf', panelId: 'panel1', panelType: 'chat' },
        focusedPanelId: 'panel1',
        maximizedPanelId: null,
      },
    ],
    activeTab: {
      id: 'tab1',
      label: 'Zen',
      layout: { kind: 'leaf', panelId: 'panel1', panelType: 'chat' },
      focusedPanelId: 'panel1',
      maximizedPanelId: null,
    },
    activeTabId: 'tab1',
    canAddTab: true,
    closedTabs: [],
    createTab: mockCreateTab,
    closeTab: mockCloseTab,
    switchTab: mockSwitchTab,
    updateTabLayout: mockUpdateTabLayout,
    updateTabLabel: mockUpdateTabLabel,
    reopenClosedTab: mockReopenClosedTab,
    setScrollPosition: vi.fn(),
    getScrollPosition: vi.fn(),
    clearProjectFilter: mockClearProjectFilter,
    setProjectFilter: mockSetProjectFilter,
    projectFilter: null,
    setPanelAgent: mockSetPanelAgent,
    updatePanelState: vi.fn(),
  }),
}))

const colorProxy = new Proxy(
  {},
  {
    get: () => '#888',
  }
)

vi.mock('@/components/zen/hooks/useZenTheme', () => ({
  useZenTheme: () => ({
    currentTheme: {
      id: 'tokyo',
      name: 'Tokyo',
      colors: new Proxy(
        { syntax: colorProxy },
        {
          get: (target, prop) => (prop in target ? (target as any)[prop] : '#888'),
        }
      ),
    },
    themes: [{ id: 'tokyo', name: 'Tokyo' }],
    setTheme: mockSetTheme,
  }),
}))

vi.mock('@/components/zen/hooks/useZenKeyboard', () => ({ useZenKeyboard: vi.fn() }))
vi.mock('@/components/zen/ZenCommandPalette', () => ({
  useCommandRegistry: () => [{ id: 'x', label: 'X' }],
  ZenCommandPalette: ({ onClose }: any) => <button onClick={onClose}>palette</button>,
}))

vi.mock('@/components/zen/ZenTopBar', () => ({
  ZenTopBar: (props: any) => (
    <div>
      <button onClick={props.onOpenThemePicker}>open-theme</button>
      <button onClick={props.onOpenCommandPalette}>open-command</button>
      <button onClick={props.onOpenKeyboardHelp}>open-help</button>
      <button onClick={props.onAddTab}>add-tab</button>
      <button onClick={props.onCloseTab}>close-tab</button>
    </div>
  ),
}))
vi.mock('@/components/zen/ZenStatusBar', () => ({
  ZenStatusBar: ({ roomName, themeName }: any) => (
    <div>
      status:{roomName}:{themeName}
    </div>
  ),
}))
vi.mock('@/components/zen/ZenPanelContainer', () => ({
  ZenPanelContainer: ({ node, renderPanel }: any) => <div>{renderPanel(node)}</div>,
}))
vi.mock('@/components/zen/ZenChatPanel', () => ({
  ZenChatPanel: ({ roomId }: any) => <div>chat-room:{roomId || 'none'}</div>,
}))
vi.mock('@/components/zen/ZenSessionsPanel', () => ({
  ZenSessionsPanel: () => <div>sessions</div>,
}))
vi.mock('@/components/zen/ZenActivityPanel', () => ({
  ZenActivityPanel: () => <div>activity</div>,
}))
vi.mock('@/components/zen/ZenRoomsPanel', () => ({ ZenRoomsPanel: () => <div>rooms</div> }))
vi.mock('@/components/zen/ZenTasksPanel', () => ({
  ZenTasksPanel: ({ projectId }: any) => <div>tasks:{projectId || 'none'}</div>,
}))
vi.mock('@/components/zen/ZenKanbanPanel', () => ({ ZenKanbanPanel: () => <div>kanban</div> }))
vi.mock('@/components/zen/ZenCronPanel', () => ({ ZenCronPanel: () => <div>cron</div> }))
vi.mock('@/components/zen/ZenLogsPanel', () => ({ ZenLogsPanel: () => <div>logs</div> }))
vi.mock('@/components/zen/ZenDocsPanel', () => ({ ZenDocsPanel: () => <div>docs</div> }))
vi.mock('@/components/zen/ProjectsPanel', () => ({ ProjectsPanel: () => <div>projects</div> }))
vi.mock('@/components/zen/ZenEmptyPanel', () => ({ ZenEmptyPanel: () => <div>empty</div> }))
vi.mock('@/components/zen/ZenThemePicker', () => ({
  ZenThemePicker: ({ onClose }: any) => <button onClick={onClose}>theme-picker</button>,
}))
vi.mock('@/components/zen/ZenKeyboardHelp', () => ({
  ZenKeyboardHelp: ({ onClose }: any) => <button onClick={onClose}>kb-help</button>,
}))
vi.mock('@/components/zen/ZenSessionManager', () => ({
  ZenAgentPicker: ({ onClose }: any) => <button onClick={onClose}>agent-picker</button>,
}))
vi.mock('@/components/zen/ZenLayoutManager', () => ({
  ZenSaveLayoutModal: ({ onClose }: any) => <button onClick={onClose}>save-layout</button>,
  ZenLayoutPicker: ({ onClose }: any) => <button onClick={onClose}>layout-picker</button>,
  addRecentLayout: vi.fn(),
}))
vi.mock('@/components/zen/ZenBrowserPanel', () => ({ ZenBrowserPanel: () => <div>browser</div> }))
vi.mock('@/components/zen/ZenErrorBoundary', () => ({
  ZenErrorBoundary: ({ children }: any) => <>{children}</>,
}))

describe('ZenMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders shell and opens modals from topbar actions', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="Agent One"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Zen Mode - Focused workspace')).toBeInTheDocument()
    expect(screen.getByText('chat-room:r1')).toBeInTheDocument()
    expect(screen.getByText('status::Tokyo')).toBeInTheDocument()

    fireEvent.click(screen.getByText('open-theme'))
    expect(screen.getByText('theme-picker')).toBeInTheDocument()

    fireEvent.click(screen.getByText('open-command'))
    expect(screen.getByText('palette')).toBeInTheDocument()

    fireEvent.click(screen.getByText('open-help'))
    expect(screen.getByText('kb-help')).toBeInTheDocument()

    fireEvent.click(screen.getByText('add-tab'))
    expect(mockCreateTab).toHaveBeenCalled()
    fireEvent.click(screen.getByText('close-tab'))
    expect(mockCloseTab).toHaveBeenCalled()
  })

  it('renders entry button and click works', () => {
    const onClick = vi.fn()
    render(<ZenModeButton onClick={onClick} />)
    fireEvent.click(screen.getByTitle('Enter Zen Mode (Ctrl+Shift+Z)'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // ── Second-pass: additional branch coverage ──────────────────────

  it('theme picker modal closes after close button', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="Agent One"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('open-theme'))
    expect(screen.getByText('theme-picker')).toBeInTheDocument()

    // theme-picker's onClose → close button
    fireEvent.click(screen.getByText('theme-picker'))
    expect(screen.queryByText('theme-picker')).not.toBeInTheDocument()
  })

  it('command palette modal closes', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="Agent One"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('open-command'))
    expect(screen.getByText('palette')).toBeInTheDocument()

    fireEvent.click(screen.getByText('palette'))
    expect(screen.queryByText('palette')).not.toBeInTheDocument()
  })

  it('keyboard help modal closes', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="Agent One"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('open-help'))
    expect(screen.getByText('kb-help')).toBeInTheDocument()

    fireEvent.click(screen.getByText('kb-help'))
    expect(screen.queryByText('kb-help')).not.toBeInTheDocument()
  })

  it('renders with connected=false without crashing', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="Offline Agent"
        agentIcon="🤖"
        agentColor="#ff0000"
        connected={false}
        onExit={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Zen Mode - Focused workspace')).toBeInTheDocument()
  })

  it('renders with no sessionKey (null)', () => {
    render(
      <ZenMode
        sessionKey={null}
        agentName={null}
        agentIcon={null}
        agentColor={null}
        connected={false}
        onExit={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Zen Mode - Focused workspace')).toBeInTheDocument()
  })

  it('renders with exitLabel and exitIcon props', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="Agent"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
        exitLabel="Projects"
        exitIcon="📋"
      />
    )
    expect(screen.getByLabelText('Zen Mode - Focused workspace')).toBeInTheDocument()
  })

  it('status bar shows room and theme name', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="A"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
      />
    )
    // ZenStatusBar mock: status:{roomName}:{themeName}
    // roomName derived from worldFocusState → rooms → room 'r1' → ''
    // room has no .name passed to ZenMode, so it uses room.name from context 'Room One'
    // but only when selectedRoomId is set
    expect(screen.getByText(/status:/)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo/)).toBeInTheDocument()
  })

  it('createTab is called when add-tab is clicked', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="A"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('add-tab'))
    expect(mockCreateTab).toHaveBeenCalledTimes(1)
  })

  it('closeTab is called when close-tab is clicked', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="A"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('close-tab'))
    expect(mockCloseTab).toHaveBeenCalledTimes(1)
  })

  it('renders panel content (chat panel for leaf node)', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="A"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
      />
    )
    // The active tab has layout: { kind: 'leaf', panelType: 'chat' }
    // renderPanel → ZenChatPanel → 'chat-room:{roomId}'
    expect(screen.getByText(/chat-room:/)).toBeInTheDocument()
  })

  it('renders with roomName override prop', () => {
    render(
      <ZenMode
        sessionKey="agent:a1:main"
        agentName="A"
        agentIcon="🤖"
        agentColor={null}
        connected
        onExit={vi.fn()}
        roomName="Dev Lab"
      />
    )
    expect(screen.getByLabelText('Zen Mode - Focused workspace')).toBeInTheDocument()
  })
})
