import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSetting, mockCreateTransport } = vi.hoisted(() => ({
  mockGetSetting: vi.fn<(key: string) => string | null>(),
  mockCreateTransport: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getSetting: mockGetSetting,
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}))

const { resolveSmtpConfig } = await import('@/lib/email')

function setSettings(values: Record<string, string | undefined>) {
  mockGetSetting.mockImplementation((key: string) => values[key] ?? null)
}

describe('resolveSmtpConfig', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    delete process.env.SMTP_FROM
    setSettings({})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses MailHog fallback in test when settings and env are absent', () => {
    process.env.NODE_ENV = 'test'

    const config = resolveSmtpConfig()

    expect(config).toEqual({
      host: 'mailhog',
      port: 1025,
      secure: false,
      from: 'noreply@nexuscms.local',
    })
    expect(mockCreateTransport).not.toHaveBeenCalled()
  })

  it('does not apply implicit fallback in production', () => {
    process.env.NODE_ENV = 'production'

    expect(resolveSmtpConfig()).toBeNull()
  })

  it('respects settings over env and preserves secure/auth behavior', () => {
    process.env.NODE_ENV = 'development'
    process.env.SMTP_HOST = 'env-host'
    process.env.SMTP_PORT = '2525'
    process.env.SMTP_USER = 'env-user'
    process.env.SMTP_PASS = 'env-pass'
    process.env.SMTP_FROM = 'env@example.com'

    setSettings({
      smtp_host: 'settings-host',
      smtp_port: '465',
      smtp_user: 'settings-user',
      smtp_pass: 'settings-pass',
      smtp_from: 'settings@example.com',
    })

    expect(resolveSmtpConfig()).toEqual({
      host: 'settings-host',
      port: 465,
      secure: true,
      from: 'settings@example.com',
      auth: {
        user: 'settings-user',
        pass: 'settings-pass',
      },
    })
  })
})
