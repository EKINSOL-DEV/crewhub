import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiKeysTab } from '@/components/settings/ApiKeysTab'

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getSelf: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  ADMIN_KEY_STORAGE_KEY: 'crewhub_admin_key',
  apiKeyApi: mockApi,
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true)
  )
  vi.stubGlobal('alert', vi.fn())
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
    },
  })
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('ApiKeysTab', () => {
  it('validates admin key and renders/revokes key rows', async () => {
    mockApi.getSelf.mockResolvedValue({})
    mockApi.list.mockResolvedValue({
      keys: [
        {
          id: 'k_1',
          key_prefix: 'ch_live_abcd',
          name: 'Primary',
          scopes: ['read', 'self'],
          agent_id: 'agent-1',
          created_at: Date.now() - 1000,
          expires_at: Date.now() + 5 * 24 * 3600 * 1000,
          last_used_at: Date.now() - 60_000,
          revoked: false,
          is_expired: false,
        },
      ],
    })
    mockApi.revoke.mockResolvedValue({ ok: true })

    render(<ApiKeysTab />)

    fireEvent.change(screen.getByPlaceholderText('ch_live_…'), { target: { value: 'admin-key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText(/admin access granted/i)
    expect(await screen.findByText('Primary')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Details'))
    expect(await screen.findByText('Key ID')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Revoke'))
    await waitFor(() => expect(mockApi.revoke).toHaveBeenCalledWith('k_1'))
  })

  it('shows invalid key error and does not render key manager', async () => {
    mockApi.getSelf.mockRejectedValue(new Error('bad key'))

    render(<ApiKeysTab />)

    fireEvent.change(screen.getByPlaceholderText('ch_live_…'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/invalid key/i)).toBeInTheDocument()
    expect(screen.queryByText('🗝️ API Keys')).not.toBeInTheDocument()
  })

  it('creates a key and reveals/copies it', async () => {
    localStorage.setItem('crewhub_admin_key', 'stored-admin')
    mockApi.list.mockResolvedValue({ keys: [] })
    mockApi.create.mockResolvedValue({
      id: 'k_2',
      key: 'ch_live_secret',
      name: 'New Key',
      scopes: ['read'],
      agent_id: null,
      created_at: Date.now(),
      expires_at: Date.now() + 86400000,
    })

    render(<ApiKeysTab />)

    await screen.findByText(/No API keys yet/i)
    fireEvent.click(screen.getByRole('button', { name: /new key/i }))

    fireEvent.change(screen.getByLabelText(/key name/i), { target: { value: 'New Key' } })
    fireEvent.click(screen.getByRole('button', { name: /create key/i }))

    expect(await screen.findByText(/Save your API key now/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText as any as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        'ch_live_secret'
      )
    )

    fireEvent.click(screen.getByLabelText(/I have copied and saved this key in a secure location/i))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() =>
      expect(screen.queryByText(/Save your API key now/i)).not.toBeInTheDocument()
    )
  })
})
