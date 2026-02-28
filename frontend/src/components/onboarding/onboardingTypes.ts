// ─── Types shared across onboarding wizard ─────────────────────

export type ConnectionMode = 'openclaw' | 'claude_code' | 'both'

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export interface ConnectionConfig {
  id: string
  name: string
  type: string
  url: string
  token: string
  enabled: boolean
  testStatus: 'idle' | 'testing' | 'success' | 'error'
  testError?: string
  sessions?: number
}

export interface OnboardingWizardProps {
  readonly onComplete: () => void
  readonly onSkip: () => void
}
