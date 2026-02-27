import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProjectManagerModal } from '@/components/zen/ProjectManagerModal'

const mockUpdateProject = vi.fn()
const mockDeleteProject = vi.fn()
const mockFetchOverview = vi.fn()

const project = {
  id: 'p1',
  name: 'Project One',
  description: 'Desc',
  icon: '📋',
  color: '#7aa2f7',
  folder_path: null,
  status: 'active' as const,
  created_at: 1700000000000,
  updated_at: 1700000000000,
  rooms: [],
}

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [project],
    createProject: vi.fn(),
    updateProject: mockUpdateProject,
    deleteProject: mockDeleteProject,
    fetchOverview: mockFetchOverview,
  }),
}))

describe('ProjectManagerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchOverview.mockResolvedValue({
      success: true,
      projects: [{ ...project, room_count: 2, agent_count: 3 }],
    })
    mockUpdateProject.mockResolvedValue({ success: true })
    mockDeleteProject.mockResolvedValue({ success: true })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/projects/p1')) {
          return Promise.resolve({ ok: true, json: async () => ({ rooms: ['r1'] }) })
        }
        if (url.includes('/rooms')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ rooms: [{ id: 'r1', name: 'Room A' }] }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })
    )
  })

  it('does not render when closed', () => {
    const { container } = render(<ProjectManagerModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('focuses selected project from details view', async () => {
    const onProjectSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <ProjectManagerModal
        isOpen
        initialProjectId="p1"
        onClose={onClose}
        onProjectSelect={onProjectSelect}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: /Focus on this project/i }))
    expect(onProjectSelect).toHaveBeenCalledWith('p1', 'Project One', '#7aa2f7')
    expect(onClose).toHaveBeenCalled()
  })

  it('opens delete confirmation and loads assigned rooms', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<ProjectManagerModal isOpen initialProjectId="p1" onClose={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: /Delete$/ }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/projects/p1'))
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/rooms'))
    })
  })
})
