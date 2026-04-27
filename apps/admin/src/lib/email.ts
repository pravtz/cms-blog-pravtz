import nodemailer from 'nodemailer'
import { getSetting } from './db'

export const runtime = 'nodejs'

const LOCAL_SMTP_HOST = 'mailhog'
const LOCAL_SMTP_PORT = 1025
const DEFAULT_FROM_ADDRESS = 'noreply@nexuscms.local'

export interface ResolvedSmtpConfig {
  host: string
  port: number
  secure: boolean
  from: string
  auth?: {
    user: string
    pass: string
  }
}

function readSmtpValue(settingKey: string, envKey: string): string | null {
  const settingValue = getSetting(settingKey)?.trim()
  if (settingValue) {
    return settingValue
  }

  const envValue = process.env[envKey]?.trim()
  return envValue ? envValue : null
}

function parseSmtpPort(value: string | null): number | null {
  if (!value) {
    return null
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null
  }

  return port
}

function isLocalFallbackEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
}

export function resolveSmtpConfig(): ResolvedSmtpConfig | null {
  const configuredHost = readSmtpValue('smtp_host', 'SMTP_HOST')
  const configuredPort = parseSmtpPort(readSmtpValue('smtp_port', 'SMTP_PORT'))
  const user = readSmtpValue('smtp_user', 'SMTP_USER')
  const pass = readSmtpValue('smtp_pass', 'SMTP_PASS')
  const from =
    readSmtpValue('smtp_from', 'SMTP_FROM') ?? DEFAULT_FROM_ADDRESS

  const host =
    configuredHost ?? (isLocalFallbackEnvironment() ? LOCAL_SMTP_HOST : null)
  const port =
    configuredPort ?? (isLocalFallbackEnvironment() ? LOCAL_SMTP_PORT : null)

  if (!host || !port) {
    return null
  }

  return {
    host,
    port,
    secure: port === 465,
    from,
    auth: user && pass ? { user, pass } : undefined,
  }
}

function getEmailClient() {
  const config = resolveSmtpConfig()
  if (!config) {
    return null
  }

  return {
    from: config.from,
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    }),
  }
}

function getBlogUrl(): string {
  return getSetting('blog_url') ?? 'http://localhost:3001'
}

export async function sendEmailConfirmation(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const client = getEmailClient()
  if (!client) {
    console.warn('[email] SMTP not configured — skipping email confirmation send')
    return
  }

  const blogUrl = getBlogUrl()
  const confirmUrl = `${blogUrl}/admin/confirm-email?token=${token}`

  await client.transporter.sendMail({
    from: client.from,
    to,
    subject: 'Confirm your email — Nexus CMS',
    text: `Hi ${name},\n\nPlease confirm your email address by visiting:\n\n${confirmUrl}\n\nThis link expires in 24 hours.\n\nIf you did not register, you can ignore this email.`,
    html: `<p>Hi ${name},</p>
<p>Please confirm your email address by clicking the link below:</p>
<p><a href="${confirmUrl}">Confirm Email Address</a></p>
<p>This link expires in 24 hours.</p>
<p>If you did not register, you can ignore this email.</p>`,
  })
}

export async function sendApprovalNotification(
  to: string,
  name: string
): Promise<void> {
  const client = getEmailClient()
  if (!client) {
    console.warn('[email] SMTP not configured — skipping approval notification')
    return
  }

  const blogUrl = getBlogUrl()

  await client.transporter.sendMail({
    from: client.from,
    to,
    subject: 'Your Nexus CMS account has been approved',
    text: `Hi ${name},\n\nYour account has been approved. You can now sign in at:\n\n${blogUrl}/admin/login\n\nWelcome aboard!`,
    html: `<p>Hi ${name},</p>
<p>Your account has been approved. You can now <a href="${blogUrl}/admin/login">sign in</a>.</p>
<p>Welcome aboard!</p>`,
  })
}

export async function sendRejectionNotification(
  to: string,
  name: string
): Promise<void> {
  const client = getEmailClient()
  if (!client) {
    console.warn('[email] SMTP not configured — skipping rejection notification')
    return
  }

  await client.transporter.sendMail({
    from: client.from,
    to,
    subject: 'Nexus CMS account registration update',
    text: `Hi ${name},\n\nWe regret to inform you that your account registration has not been approved at this time.\n\nIf you believe this is a mistake, please contact the administrator.`,
    html: `<p>Hi ${name},</p>
<p>We regret to inform you that your account registration has not been approved at this time.</p>
<p>If you believe this is a mistake, please contact the administrator.</p>`,
  })
}

export async function sendNewsletterConfirmation(
  to: string,
  token: string,
  blogUrl: string,
  unsubscribeToken?: string
): Promise<void> {
  const client = getEmailClient()
  if (!client) {
    console.warn('[email] SMTP not configured — skipping newsletter confirmation send')
    return
  }

  const confirmUrl = `${blogUrl}/newsletter/confirm?token=${token}`
  const unsubscribeUrl = unsubscribeToken
    ? `${blogUrl}/newsletter/unsubscribe?token=${unsubscribeToken}`
    : null

  const unsubscribeLine = unsubscribeUrl
    ? `\n\nPara cancelar a inscrição: ${unsubscribeUrl}`
    : ''
  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="font-size:12px;color:#888;margin-top:24px;">Não quer mais receber? <a href="${unsubscribeUrl}">Cancelar inscrição</a></p>`
    : ''

  await client.transporter.sendMail({
    from: client.from,
    to,
    subject: 'Confirme sua inscrição na newsletter',
    text: `Obrigado por se inscrever!\n\nClique no link abaixo para confirmar sua inscrição:\n\n${confirmUrl}\n\nEste link expira em 48 horas.\n\nSe você não se inscreveu, pode ignorar este e-mail.${unsubscribeLine}`,
    html: `<p>Obrigado por se inscrever!</p>
<p>Clique no link abaixo para confirmar sua inscrição na nossa newsletter:</p>
<p><a href="${confirmUrl}">Confirmar inscrição</a></p>
<p>Este link expira em 48 horas.</p>
<p>Se você não se inscreveu, pode ignorar este e-mail.</p>${unsubscribeHtml}`,
  })
}

export async function sendOwnerPendingUserNotification(
  ownerEmail: string,
  newUserName: string,
  newUserEmail: string
): Promise<void> {
  const client = getEmailClient()
  if (!client) {
    console.warn('[email] SMTP not configured — skipping owner notification')
    return
  }

  const blogUrl = getBlogUrl()

  await client.transporter.sendMail({
    from: client.from,
    to: ownerEmail,
    subject: `New user pending approval — ${newUserName}`,
    text: `A new user has confirmed their email and is awaiting approval.\n\nName: ${newUserName}\nEmail: ${newUserEmail}\n\nReview and approve at: ${blogUrl}/admin/dashboard`,
    html: `<p>A new user has confirmed their email and is awaiting approval.</p>
<ul>
  <li><strong>Name:</strong> ${newUserName}</li>
  <li><strong>Email:</strong> ${newUserEmail}</li>
</ul>
<p><a href="${blogUrl}/admin/dashboard">Review in admin panel</a></p>`,
  })
}
