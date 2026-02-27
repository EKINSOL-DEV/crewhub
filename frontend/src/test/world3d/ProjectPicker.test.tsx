import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProjectPicker } from '@/components/world3d/ProjectPicker'

vi.mock('@/contexts/DemoContext', () => ({
  useDemoMode: () => ({ isDemoMode: true }),
}))

describe('ProjectPicker', () => {
  const onSelect = vi.fn()
  const onCreate = vi.fn(async () => ({
    success: true,
    project: { id: 'p-new', name: 'Created', updated_at: 10, status: 'active' },
  }))
  const onClose = vi.fn()

  const projects: any[] = [
    {
      id: 'p1',
      name: 'Alpha',
      description: 'first',
      status: 'active',
      updated_at: 2,
      color: '#111',
    },
    { id: 'p2', name: 'Paused One', status: 'paused', updated_at: 3 },
    { id: 'p3', name: 'Archived', status: 'archived', updated_at: 9 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/settings/projects_base_path')) {
          return { ok: true, json: async () => ({ value: '~/Work' }) } as Response
        }
        if (url.includes('/project-folders/discover')) {
          return {
            ok: true,
            json: async () => ({
              folders: [
                {
                  name: 'AlphaFolder',
                  path: '~/Work/AlphaFolder',
                  file_count: 2,
                  has_readme: true,
                  has_docs: true,
                },
              ],
            }),
          } as Response
        }
        return { ok: true, json: async () => ({}) } as Response
      })
    )
  })

  it('renders list, filters, and selects project', async () => {
    render(
      <ProjectPicker
        projects={projects as any}
        currentProjectId={null}
        onSelect={onSelect}
        onCreate={onCreate}
        onClose={onClose}
      />
    )

    expect(screen.getByText(/Demo Mode/i)).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Archived')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search projects…'), {
      target: { value: 'paused' },
    })
    expect(screen.getByText('Paused One')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Paused One'))
    expect(onSelect).toHaveBeenCalledWith('p2')
  })

  it('creates a project and auto-selects it', async () => {
    render(
      <ProjectPicker
        projects={projects as any}
        currentProjectId={null}
        onSelect={onSelect}
        onCreate={onCreate}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /create new project/i }))
    fireEvent.change(screen.getByLabelText('Project Name *'), { target: { value: 'My App' } })

    await waitFor(() =>
      expect(screen.getByText(/Auto-generated: ~\/Work\/My-App/i)).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /create & assign/i }))

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'My App' }))
      expect(onSelect).toHaveBeenCalledWith('p-new')
    })
  })
})
