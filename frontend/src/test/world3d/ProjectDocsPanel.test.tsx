import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProjectDocsPanel } from '@/components/world3d/ProjectDocsPanel'

vi.mock('@/lib/api', () => ({ API_BASE: '/api' }))
vi.mock('@/lib/formatters', () => ({ formatFileSize: (size: number) => `${size}B` }))

describe('ProjectDocsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/files?depth=3')) {
          return {
            ok: true,
            json: async () => ({
              files: [
                {
                  name: 'docs',
                  path: 'docs',
                  type: 'directory',
                  children: [
                    {
                      name: 'README.md',
                      path: 'docs/README.md',
                      type: 'document',
                      extension: '.md',
                      size: 10,
                    },
                    {
                      name: 'app.ts',
                      path: 'docs/app.ts',
                      type: 'code',
                      extension: '.ts',
                      size: 5,
                    },
                  ],
                },
              ],
            }),
          } as Response
        }
        if (url.includes('/files/content?path=docs%2FREADME.md')) {
          return {
            ok: true,
            json: async () => ({
              path: 'docs/README.md',
              name: 'README.md',
              type: 'document',
              extension: '.md',
              size: 10,
              content: '# Title\n## Part\n### Detail\n#### More\nSome [link](https://example.com)',
            }),
          } as Response
        }
        if (url.includes('/files/content?path=docs%2Fapp.ts')) {
          return {
            ok: true,
            json: async () => ({
              path: 'docs/app.ts',
              name: 'app.ts',
              type: 'code',
              extension: '.ts',
              size: 5,
              content: 'console.log(1)',
            }),
          } as Response
        }
        return { ok: false, json: async () => ({ detail: 'boom' }) } as Response
      })
    )
  })

  it('loads files, filters by type and opens markdown viewer', async () => {
    render(<ProjectDocsPanel projectId="p1" projectName="Alpha" onClose={vi.fn()} />)

    expect(await screen.findByText('Alpha Docs')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /📝 Docs/i }))

    fireEvent.click(screen.getByText('README.md'))

    expect(await screen.findByText('Contents')).toBeInTheDocument()
    expect(screen.getAllByText('Title').length).toBeGreaterThan(1)
    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute(
      'href',
      'https://example.com'
    )

    fireEvent.click(screen.getByRole('button', { name: '←' }))
    expect(screen.getByText('Alpha Docs')).toBeInTheDocument()
  })

  it('opens code file and renders preformatted content', async () => {
    render(<ProjectDocsPanel projectId="p1" projectName="Alpha" onClose={vi.fn()} />)

    await screen.findByText('README.md')
    fireEvent.click(screen.getByText('app.ts'))

    await waitFor(() => {
      expect(screen.getByText('console.log(1)')).toBeInTheDocument()
    })
  })
})
