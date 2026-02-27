import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DocumentTreeNode } from '@/components/shared/DocumentTreeNode'
import type { DocNode } from '@/components/zen/hooks/useDocumentPanel'

describe('DocumentTreeNode', () => {
  const formatDate = vi.fn(() => 'today')

  it('renders files and opens on click + keyboard', () => {
    const onOpen = vi.fn()
    const file: DocNode = { name: 'README.md', path: 'README.md', type: 'file', lastModified: 123 }

    render(
      <DocumentTreeNode
        node={file}
        depth={1}
        sortKey="name"
        onOpen={onOpen}
        searchQuery=""
        variant="zen"
        formatDate={formatDate}
      />
    )

    const fileButton = screen.getByRole('button', { name: /README/i })
    expect(screen.getByText('README')).toBeInTheDocument()
    expect(screen.getByText('today')).toBeInTheDocument()

    fireEvent.click(fileButton)
    fireEvent.keyDown(fileButton, { key: 'Enter' })
    fireEvent.keyDown(fileButton, { key: ' ' })
    expect(onOpen).toHaveBeenCalledTimes(3)
    expect(onOpen).toHaveBeenCalledWith('README.md')
  })

  it('renders directory collapsed then expands and sorts children', () => {
    const onOpen = vi.fn()
    const tree: DocNode = {
      name: 'docs',
      path: 'docs',
      type: 'directory',
      children: [
        { name: 'b.md', path: 'docs/b.md', type: 'file' },
        { name: 'a.md', path: 'docs/a.md', type: 'file' },
      ],
    }

    render(
      <DocumentTreeNode
        node={tree}
        depth={1}
        sortKey="name"
        onOpen={onOpen}
        searchQuery=""
        variant="mobile"
        formatDate={() => ''}
      />
    )

    const dirButton = screen.getByRole('button', { name: /docs/i })
    expect(screen.queryByText('a')).not.toBeInTheDocument()
    fireEvent.click(dirButton)
    const labels = screen.getAllByText(/^[ab]$/).map((n) => n.textContent)
    expect(labels).toEqual(['a', 'b'])
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('auto-expands at root and search mode, and filters unmatched file nodes', () => {
    const onOpen = vi.fn()
    const root: DocNode = {
      name: 'root',
      path: 'root',
      type: 'directory',
      children: [{ name: 'needle.md', path: 'root/needle.md', type: 'file' }],
    }

    const { rerender } = render(
      <DocumentTreeNode
        node={root}
        depth={0}
        sortKey="name"
        onOpen={onOpen}
        searchQuery=""
        variant="zen"
        formatDate={() => ''}
      />
    )

    expect(screen.getByText('needle')).toBeInTheDocument()

    const unmatched: DocNode = { name: 'other.md', path: 'other.md', type: 'file' }
    rerender(
      <DocumentTreeNode
        node={unmatched}
        depth={1}
        sortKey="name"
        onOpen={onOpen}
        searchQuery="ab"
        variant="zen"
        formatDate={() => ''}
      />
    )

    expect(screen.queryByText('other')).not.toBeInTheDocument()
  })
})
