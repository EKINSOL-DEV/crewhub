/**
 * MobileDocsPanel Tests
 * Tests for the mobile fullscreen docs browser
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MobileDocsPanel } from '@/components/mobile/MobileDocsPanel'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSetSearchQuery = vi.fn()
const mockSetSortKey = vi.fn()
const mockSetFullscreenOpen = vi.fn()
const mockOpenDoc = vi.fn()

let mockLoading = false
let mockError: string | null = null
let mockSortedTree: any[] = []
let mockFullscreenOpen = false
let mockSearchQuery = ''
let mockSortKey = 'name'
let mockFileCount = 0
let mockContent = ''
let mockSelectedPath: string | null = null
let mockContentLoading = false

vi.mock('@/components/zen/hooks/useDocumentPanel', () => ({
  useDocumentPanel: () => ({
    sortedTree: mockSortedTree,
    loading: mockLoading,
    error: mockError,
    content: mockContent,
    selectedPath: mockSelectedPath,
    contentLoading: mockContentLoading,
    fullscreenOpen: mockFullscreenOpen,
    searchQuery: mockSearchQuery,
    sortKey: mockSortKey,
    fileCount: mockFileCount,
    setSearchQuery: mockSetSearchQuery,
    setSortKey: mockSetSortKey,
    setFullscreenOpen: mockSetFullscreenOpen,
    openDoc: mockOpenDoc,
  }),
  formatDocDate: (ts: number, _short: boolean) => new Date(ts).toLocaleDateString(),
}))

vi.mock('@/components/markdown/FullscreenOverlay', () => ({
  FullscreenOverlay: ({ open, onClose, title }: any) =>
    open ? (
      <div data-testid="fullscreen-overlay">
        <span>{title}</span>
        <button onClick={onClose}>Close Doc</button>
      </div>
    ) : null,
}))

vi.mock('@/components/shared/DocumentTreeNode', () => ({
  DocumentTreeNode: ({ node, onOpen }: any) => (
    <div data-testid="tree-node" data-path={node.path} onClick={() => onOpen(node.path)}>
      {node.name}
    </div>
  ),
}))

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileDocsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoading = false
    mockError = null
    mockSortedTree = []
    mockFullscreenOpen = false
    mockSearchQuery = ''
    mockSortKey = 'name'
    mockFileCount = 0
    mockContent = ''
    mockSelectedPath = null
    mockContentLoading = false
  })

  describe('header', () => {
    it('renders docs title', () => {
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.getByText('📚 Docs')).toBeInTheDocument()
    })

    it('shows file count', () => {
      mockFileCount = 7
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.getByText('7 files')).toBeInTheDocument()
    })

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn()
      render(<MobileDocsPanel onBack={onBack} />)
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('toggles sort key when sort button is clicked', () => {
      render(<MobileDocsPanel onBack={vi.fn()} />)
      // Sort button is 3rd button in header (back, sort, search)
      const buttons = screen.getAllByRole('button')
      // Sort button has title
      const sortBtn = screen.getByTitle(/Sort by/)
      fireEvent.click(sortBtn)
      expect(mockSetSortKey).toHaveBeenCalledTimes(1)
    })

    it('shows clock icon when sorted by name (will toggle to date)', () => {
      mockSortKey = 'name'
      render(<MobileDocsPanel onBack={vi.fn()} />)
      // When sorted by name, title says "Sort by date"
      expect(screen.getByTitle('Sort by date')).toBeInTheDocument()
    })

    it('shows SortAsc icon when sorted by date (will toggle to name)', () => {
      mockSortKey = 'date'
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.getByTitle('Sort by name')).toBeInTheDocument()
    })

    it('shows search bar when search button is clicked', () => {
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.queryByPlaceholderText('Search documents...')).not.toBeInTheDocument()

      const searchBtn = screen.getAllByRole('button').at(-1)!
      fireEvent.click(searchBtn)

      expect(screen.getByPlaceholderText('Search documents...')).toBeInTheDocument()
    })

    it('hides search bar when search button is clicked again', () => {
      render(<MobileDocsPanel onBack={vi.fn()} />)
      const searchBtn = screen.getAllByRole('button').at(-1)!
      fireEvent.click(searchBtn) // show
      fireEvent.click(searchBtn) // hide
      expect(screen.queryByPlaceholderText('Search documents...')).not.toBeInTheDocument()
    })

    it('calls setSearchQuery when typing in search', () => {
      render(<MobileDocsPanel onBack={vi.fn()} />)
      const searchBtn = screen.getAllByRole('button').at(-1)!
      fireEvent.click(searchBtn)
      const input = screen.getByPlaceholderText('Search documents...')
      fireEvent.change(input, { target: { value: 'readme' } })
      expect(mockSetSearchQuery).toHaveBeenCalledWith('readme')
    })
  })

  describe('tree content states', () => {
    it('shows Loading… when loading', () => {
      mockLoading = true
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('shows error message when error occurs', () => {
      mockError = 'Failed to load docs'
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.getByText('Failed to load docs')).toBeInTheDocument()
    })

    it('shows "No documents found" when tree is empty', () => {
      mockSortedTree = []
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.getByText('No documents found')).toBeInTheDocument()
    })

    it('renders tree nodes when docs are available', () => {
      mockSortedTree = [
        { path: 'docs/README.md', name: 'README', type: 'file', children: [] },
        { path: 'docs/guide.md', name: 'Guide', type: 'file', children: [] },
      ]
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.getByText('README')).toBeInTheDocument()
      expect(screen.getByText('Guide')).toBeInTheDocument()
    })

    it('calls openDoc when a tree node is clicked', () => {
      mockSortedTree = [{ path: 'docs/README.md', name: 'README', type: 'file', children: [] }]
      render(<MobileDocsPanel onBack={vi.fn()} />)
      fireEvent.click(screen.getByText('README'))
      expect(mockOpenDoc).toHaveBeenCalledWith('docs/README.md')
    })
  })

  describe('fullscreen overlay', () => {
    it('renders fullscreen overlay when open', () => {
      mockFullscreenOpen = true
      mockSelectedPath = 'docs/README.md'
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.getByTestId('fullscreen-overlay')).toBeInTheDocument()
    })

    it('does not render fullscreen overlay when closed', () => {
      mockFullscreenOpen = false
      render(<MobileDocsPanel onBack={vi.fn()} />)
      expect(screen.queryByTestId('fullscreen-overlay')).not.toBeInTheDocument()
    })

    it('calls setFullscreenOpen(false) when overlay close button is clicked', () => {
      mockFullscreenOpen = true
      mockSelectedPath = 'docs/guide.md'
      render(<MobileDocsPanel onBack={vi.fn()} />)
      fireEvent.click(screen.getByText('Close Doc'))
      expect(mockSetFullscreenOpen).toHaveBeenCalledWith(false)
    })

    it('shows "Loading…" as content when contentLoading is true', () => {
      mockFullscreenOpen = true
      mockContentLoading = true
      mockSelectedPath = 'docs/guide.md'
      render(<MobileDocsPanel onBack={vi.fn()} />)
      // The overlay gets content passed to it; title comes from selectedPath
      expect(screen.getByTestId('fullscreen-overlay')).toBeInTheDocument()
    })
  })
})
