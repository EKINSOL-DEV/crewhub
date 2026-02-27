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
})
