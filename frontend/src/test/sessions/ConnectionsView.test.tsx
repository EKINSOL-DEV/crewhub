/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConnectionsView } from '@/components/sessions/ConnectionsView'

const subscribeMock = vi.fn(() => vi.fn())

vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: (...args: any[]) => subscribeMock(...args),
  },
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, 'open', { value: true, writable: true, configurable: true })
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, 'open', { value: false, writable: true, configurable: true })
  })
})

describe('ConnectionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method || 'GET'

      if (url === '/api/connections' && method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            connections: [
              {
                id: 'c1',
                name: 'Main Gateway',
                type: 'openclaw',
                config: { gateway_url: 'http://localhost:3000' },
                enabled: true,
                status: 'connected',
                created_at: 1,
                updated_at: 1,
              },
              {
                id: 'c2',
                name: 'Codex CLI',
                type: 'codex',
                config: { cli_path: '/usr/local/bin/codex' },
                enabled: false,
                status: 'error',
                error: 'bad token',
                created_at: 1,
                updated_at: 1,
              },
            ],
          }),
        } as Response
      }

      if (url === '/api/connections/c1/connect' && method === 'POST') {
        return { ok: true, json: async () => ({ connected: false, error: 'refused' }) } as Response
      }

      if (method === 'DELETE') {
        return { ok: true, json: async () => ({}) } as Response
      }

      if (url === '/api/connections' && method === 'POST') {
        return { ok: true, json: async () => ({ id: 'new-id' }) } as Response
      }

      return { ok: true, json: async () => ({}) } as Response
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders connections, can test/delete and show error banner', async () => {
    render(<ConnectionsView embedded />)

    expect(await screen.findByText('Main Gateway')).toBeInTheDocument()
    expect(screen.getByText('Codex CLI')).toBeInTheDocument()
    expect(screen.getByText('bad token')).toBeInTheDocument()

    const testBtnMain = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'Test connection')!
    fireEvent.click(testBtnMain)

    expect(await screen.findByText(/Connection failed: refused/i)).toBeInTheDocument()

    const deleteBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'Delete connection') as HTMLButtonElement
    fireEvent.click(deleteBtn)
    fireEvent.click(screen.getByText('Confirm?').closest('button') as HTMLButtonElement)

    await waitFor(() => {
      expect((fetch as any).mock.calls.some((c: any[]) => c[1]?.method === 'DELETE')).toBe(true)
    })
  })

  it('can open add dialog and submit a new connection', async () => {
    render(<ConnectionsView embedded />)

    await screen.findByText('Main Gateway')
    fireEvent.click(screen.getByRole('button', { name: /add connection/i }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New One' } })
    fireEvent.change(screen.getByLabelText('Gateway URL'), { target: { value: 'http://x' } })

    const submitBtn = screen
      .getAllByText('Add Connection')
      .map((el) => el.closest('button'))
      .filter(Boolean)
      .at(-1) as HTMLButtonElement
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect((fetch as any).mock.calls.some((c: any[]) => c[1]?.method === 'POST')).toBe(true)
    })
  })
})
