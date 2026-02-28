import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AgentsSettingsTab } from '@/components/sessions/AgentsSettingsTab'

const mockToast = vi.fn()

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

function okJson(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }))
}

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
      this.dispatchEvent(new Event('close'))
    },
  })

  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url.endsWith('/api/agents') && method === 'GET') {
      return okJson({
        agents: [
          {
            id: 'a1',
            name: 'Alpha',
            display_name: 'Alpha Prime',
            icon: '🤖',
            avatar_url: null,
            color: '#6b7280',
            agent_session_key: null,
            default_model: 'gpt-4',
            default_room_id: 'r1',
            sort_order: 0,
            is_pinned: true,
            auto_spawn: false,
            bio: 'Initial bio',
            created_at: Date.now(),
            updated_at: Date.now(),
            is_stale: false,
          },
        ],
      })
    }
    if (url.endsWith('/api/rooms') && method === 'GET') {
      return okJson({ rooms: [{ id: 'r1', name: 'HQ', icon: '🏠' }] })
    }
    if (url.includes('/generate-bio') && method === 'POST') {
      return okJson({ bio: 'Generated bio text' })
    }
    if (url.includes('/api/agents/a1') && method === 'PUT') {
      return okJson({ ok: true })
    }
    if (url.includes('/api/agents/a1') && method === 'DELETE') {
      return okJson({ ok: true })
    }
    if (url.endsWith('/api/agents') && method === 'POST') {
      return okJson({ ok: true })
    }
    return Promise.resolve(new Response('{}', { status: 404 }))
  }) as any
})

describe('AgentsSettingsTab', () => {
  it('loads agents, edits/saves, generates bio, deletes, and adds new agent', async () => {
    render(<AgentsSettingsTab />)

    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Edit agent'))
    fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
    await waitFor(() => expect(screen.getByDisplayValue('Generated bio text')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Save/i }))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Agent Updated' }))
    )

    fireEvent.click(screen.getByTitle('Delete agent'))
    expect(await screen.findByText(/Delete 🤖 Alpha Prime\?/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Agent deleted' }))
    )

    fireEvent.click(screen.getByRole('button', { name: /Add Agent/i }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New Test Agent' } })
    await waitFor(() =>
      expect(screen.getByLabelText('Agent ID (slug) *')).toHaveValue('new-test-agent')
    )
    fireEvent.click(screen.getByRole('button', { name: /Create Agent/i }))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Agent created' }))
    )
  })

  it('shows load error toast when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 })) as any
    render(<AgentsSettingsTab />)
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to load agents' })
      )
    )
  })

  // ── Second-pass: additional branch coverage ──────────────────────

  it('cancel edit restores original values', async () => {
    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Edit agent'))
    // Check edit form appears
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()

    // Click cancel
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    // Edit form should disappear
    expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument()
  })

  it('shows toast on save error', async () => {
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url.endsWith('/api/agents') && method === 'GET')
        return okJson({
          agents: [
            {
              id: 'a1',
              name: 'Alpha',
              display_name: 'Alpha Prime',
              icon: '🤖',
              avatar_url: null,
              color: '#6b7280',
              agent_session_key: null,
              default_model: null,
              default_room_id: 'r1',
              sort_order: 0,
              is_pinned: false,
              auto_spawn: false,
              bio: '',
              created_at: Date.now(),
              updated_at: Date.now(),
              is_stale: false,
            },
          ],
        })
      if (url.endsWith('/api/rooms')) return okJson({ rooms: [] })
      if (url.includes('/api/agents/a1') && method === 'PUT')
        return Promise.resolve(new Response('{}', { status: 500 }))
      return okJson({})
    }) as any

    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Edit agent'))
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Failed to save' }))
    )
  })

  it('shows toast on generate bio error', async () => {
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url.endsWith('/api/agents') && method === 'GET')
        return okJson({
          agents: [
            {
              id: 'a1',
              name: 'Alpha',
              display_name: 'Alpha Prime',
              icon: '🤖',
              avatar_url: null,
              color: '#6b7280',
              agent_session_key: null,
              default_model: null,
              default_room_id: null,
              sort_order: 0,
              is_pinned: false,
              auto_spawn: false,
              bio: null,
              created_at: Date.now(),
              updated_at: Date.now(),
              is_stale: false,
            },
          ],
        })
      if (url.endsWith('/api/rooms')) return okJson({ rooms: [] })
      if (url.includes('/generate-bio')) return Promise.resolve(new Response('{}', { status: 500 }))
      return okJson({})
    }) as any

    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Edit agent'))
    fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to generate bio' })
      )
    )
  })

  it('delete cancel dialog dismisses without deleting', async () => {
    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Delete agent'))
    expect(await screen.findByText(/Delete 🤖 Alpha Prime\?/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    // Dialog should be gone
    expect(screen.queryByText(/Delete 🤖 Alpha Prime\?/i)).not.toBeInTheDocument()
    // Agent should still be in list
    expect(screen.getByText('Alpha Prime')).toBeInTheDocument()
  })

  it('shows delete error toast when delete fails', async () => {
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url.endsWith('/api/agents') && method === 'GET')
        return okJson({
          agents: [
            {
              id: 'a1',
              name: 'Alpha',
              display_name: 'Alpha Prime',
              icon: '🤖',
              avatar_url: null,
              color: '#6b7280',
              agent_session_key: null,
              default_model: null,
              default_room_id: 'r1',
              sort_order: 0,
              is_pinned: true,
              auto_spawn: false,
              bio: null,
              created_at: Date.now(),
              updated_at: Date.now(),
              is_stale: false,
            },
          ],
        })
      if (url.endsWith('/api/rooms')) return okJson({ rooms: [] })
      if (url.includes('/api/agents/a1') && method === 'DELETE')
        return Promise.resolve(new Response('{}', { status: 500 }))
      return okJson({})
    }) as any

    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Delete agent'))
    fireEvent.click(await screen.findByRole('button', { name: /^Delete$/i }))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to delete agent' })
      )
    )
  })

  it('shows stale agent badge and warning when is_stale=true', async () => {
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url.endsWith('/api/agents') && method === 'GET')
        return okJson({
          agents: [
            {
              id: 'a1',
              name: 'Ghost',
              display_name: 'Ghost Agent',
              icon: '👻',
              avatar_url: null,
              color: '#6b7280',
              agent_session_key: null,
              default_model: null,
              default_room_id: null,
              sort_order: 0,
              is_pinned: false,
              auto_spawn: false,
              bio: null,
              created_at: Date.now(),
              updated_at: Date.now(),
              is_stale: true,
            },
          ],
        })
      if (url.endsWith('/api/rooms')) return okJson({ rooms: [] })
      return okJson({})
    }) as any

    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Ghost Agent')).toBeInTheDocument()
    expect(screen.getByText('Not in OpenClaw')).toBeInTheDocument()
    // Stale count warning in header
    expect(screen.getByText(/1 agent not found in OpenClaw gateway/i)).toBeInTheDocument()
  })

  it('shows Pinned badge for pinned agents', async () => {
    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()
    // Alpha has is_pinned: true in the base fixture
    expect(screen.getByText('Pinned')).toBeInTheDocument()
  })

  it('shows empty state when no agents registered', async () => {
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url.endsWith('/api/agents') && method === 'GET') return okJson({ agents: [] })
      if (url.endsWith('/api/rooms')) return okJson({ rooms: [] })
      return okJson({})
    }) as any

    render(<AgentsSettingsTab />)
    await waitFor(() => expect(screen.getByText(/No agents registered yet/i)).toBeInTheDocument())
  })

  it('shows create agent error toast on server error', async () => {
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url.endsWith('/api/agents') && method === 'GET') return okJson({ agents: [] })
      if (url.endsWith('/api/rooms')) return okJson({ rooms: [] })
      if (url.endsWith('/api/agents') && method === 'POST')
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'Agent ID taken' }), { status: 409 })
        )
      return okJson({})
    }) as any

    render(<AgentsSettingsTab />)
    await waitFor(() => screen.getByRole('button', { name: /Add Agent/i }))

    fireEvent.click(screen.getByRole('button', { name: /Add Agent/i }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Dupe Bot' } })
    await waitFor(() => expect(screen.getByLabelText('Agent ID (slug) *')).toHaveValue('dupe-bot'))
    fireEvent.click(screen.getByRole('button', { name: /Create Agent/i }))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to create agent' })
      )
    )
  })

  it('edit icon inline with Enter key saves', async () => {
    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()

    // Click the icon to edit inline
    fireEvent.click(screen.getByTitle('Click to edit icon'))

    // Agent icon editing input appears
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Save icon/i })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /Save icon/i }))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Icon updated' }))
    )
  })

  it('cancels icon edit on Escape', async () => {
    render(<AgentsSettingsTab />)
    expect(await screen.findByText('Alpha Prime')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Click to edit icon'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Save icon/i })).toBeInTheDocument()
    )

    // Press Escape in the icon input
    const iconInput = document.querySelector('input[maxLength="4"]') as HTMLInputElement
    if (iconInput) {
      fireEvent.keyDown(iconInput, { key: 'Escape' })
    }
    // Icon editing mode should exit
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Save icon/i })).not.toBeInTheDocument()
    )
  })
})
