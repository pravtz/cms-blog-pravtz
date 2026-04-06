import nodemailer from 'nodemailer'
import { getSetting } from './db'

export const runtime = 'nodejs'

function getTransporter() {
  const host = getSetting('smtp_host')
  const portStr = getSetting('smtp_port')
  const user = getSetting('smtp_user')
  const pass = getSetting('smtp_pass')

  if (!host || !portStr) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port: Number(portStr),
    secure: Number(portStr) === 465,
    auth: user && pass ? { user, pass } : undefined,
  })
}

function getFromAddress(): string {
  return getSetting('smtp_from') ?? 'noreply@nexuscms.local'
}

function getBlogUrl(): string {
  return getSetting('blog_url') ?? 'http://localhost:3001'
}

export async function sendEmailConfirmation(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping email confirmation send')
    return
  }

  const blogUrl = getBlogUrl()
  const confirmUrl = `${blogUrl}/admin/confirm-email?token=${token}`

  await transporter.sendMail({
    from: getFromAddress(),
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
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping approval notification')
    return
  }

  const blogUrl = getBlogUrl()

  await transporter.sendMail({
    from: getFromAddress(),
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
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping rejection notification')
    return
  }

  await transporter.sendMail({
    from: getFromAddress(),
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
  blogUrl: string
): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping newsletter confirmation send')
    return
  }

  const confirmUrl = `${blogUrl}/newsletter/confirm?token=${token}`

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject: 'Confirme sua inscrição na newsletter',
    text: `Obrigado por se inscrever!\n\nClique no link abaixo para confirmar sua inscrição:\n\n${confirmUrl}\n\nEste link expira em 48 horas.\n\nSe você não se inscreveu, pode ignorar este e-mail.`,
    html: `<p>Obrigado por se inscrever!</p>
<p>Clique no link abaixo para confirmar sua inscrição na nossa newsletter:</p>
<p><a href="${confirmUrl}">Confirmar inscrição</a></p>
<p>Este link expira em 48 horas.</p>
<p>Se você não se inscreveu, pode ignorar este e-mail.</p>`,
  })
}

export async function sendOwnerPendingUserNotification(
  ownerEmail: string,
  newUserName: string,
  newUserEmail: string
): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping owner notification')
    return
  }

  const blogUrl = getBlogUrl()

  await transporter.sendMail({
    from: getFromAddress(),
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
