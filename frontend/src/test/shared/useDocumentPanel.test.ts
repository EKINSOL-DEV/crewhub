/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  countDocFiles,
  formatDocDate,
  getDocNodeIcon,
  isDocFilteredOut,
  matchesDocSearch,
  sortDocNodes,
  useDocumentPanel,
  type DocNode,
} from '@/components/zen/hooks/useDocumentPanel'

describe('useDocumentPanel helpers', () => {
  it('formats date, sorts nodes, counts files, and matches search', () => {
    expect(formatDocDate(undefined)).toBe('')
    expect(formatDocDate(1700000000)).toMatch(/[0-9]{2}/)
    expect(formatDocDate(1700000000, true)).toContain(' ')

    const nodes: DocNode[] = [
      { name: 'b.md', path: 'b.md', type: 'file', lastModified: 10 },
      { name: 'Dir', path: 'Dir', type: 'directory', children: [] },
      { name: 'a.md', path: 'a.md', type: 'file', lastModified: 100 },
    ]

    expect(sortDocNodes(nodes, 'name').map((n) => n.name)).toEqual(['Dir', 'a.md', 'b.md'])
    expect(sortDocNodes(nodes, 'date').map((n) => n.name)).toEqual(['Dir', 'a.md', 'b.md'])

    const tree: DocNode[] = [
      {
        name: 'docs',
        path: 'docs',
        type: 'directory',
        children: [{ name: 'guide.md', path: 'docs/guide.md', type: 'file' }],
      },
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]

    expect(countDocFiles(tree)).toBe(2)
    expect(matchesDocSearch(tree[0].children![0], 'guide')).toBe(true)
    expect(isDocFilteredOut(tree[1], 'xx')).toBe(true)
    expect(isDocFilteredOut(tree[1], 'r')).toBe(false)
    expect(getDocNodeIcon(false, false)).toBe('📄')
    expect(getDocNodeIcon(true, false)).toBe('📁')
    expect(getDocNodeIcon(true, true)).toBe('📂')
  })
})

describe('useDocumentPanel hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads tree and opens document content', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        json: async () => [{ name: 'a.md', path: 'a.md', type: 'file' }],
      } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: '# hi' }) } as any)

    const { result } = renderHook(() => useDocumentPanel())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tree).toHaveLength(1)
    expect(result.current.fileCount).toBe(1)

    act(() => {
      result.current.openDoc('a.md')
    })
    await waitFor(() => expect(result.current.contentLoading).toBe(false))
    expect(result.current.selectedPath).toBe('a.md')
    expect(result.current.content).toBe('# hi')
    expect(result.current.fullscreenOpen).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('handles tree and document fetch failures with custom messages', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('tree-fail'))
      .mockResolvedValueOnce({ ok: false } as any)

    const { result } = renderHook(() =>
      useDocumentPanel({ treeErrorMessage: 'Tree failed', documentErrorMessage: 'Doc failed' })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Tree failed')

    act(() => {
      result.current.openDoc('missing.md')
    })
    await waitFor(() => expect(result.current.contentLoading).toBe(false))
    expect(result.current.error).toBe('Doc failed')
  })
})
