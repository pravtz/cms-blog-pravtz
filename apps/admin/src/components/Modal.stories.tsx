'use client'

import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

/**
 * @status stable
 *
 * Dialog overlay with focus-trap, Escape-to-close, and body scroll-lock.
 * Always provide a `title` for accessible labelling via `aria-labelledby`.
 */
const meta = {
  title: 'Base/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Modal is a `use client` component. In stories it is wrapped in a toggle button to demonstrate open/close behaviour.',
      },
    },
  },
  // Required props satisfied for Storybook controls; stories use render() to manage open state.
  args: {
    open: false,
    onClose: () => {},
    children: null,
  },
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

function ModalDemo({
  title,
  description,
  size,
  disableOverlayClose,
  footer,
  children,
}: {
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  disableOverlayClose?: boolean
  footer?: React.ReactNode
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size={size}
        disableOverlayClose={disableOverlayClose}
        footer={footer}
      >
        {children ?? <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Modal content goes here.</p>}
      </Modal>
    </>
  )
}

export const Default: Story = {
  render: () => <ModalDemo title="Modal Title" description="Supporting description text." />,
}

export const Small: Story = {
  render: () => <ModalDemo title="Small Modal" size="sm" />,
}

export const Large: Story = {
  render: () => <ModalDemo title="Large Modal" size="lg" />,
}

export const WithFooter: Story = {
  render: () => (
    <ModalDemo
      title="Confirm Delete"
      description="This action cannot be undone."
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Delete</Button>
        </div>
      }
    />
  ),
}

export const DisableOverlayClose: Story = {
  name: 'Overlay Click Disabled',
  render: () => (
    <ModalDemo
      title="Cannot Close by Clicking Overlay"
      disableOverlayClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button>OK</Button>
        </div>
      }
    />
  ),
}

export const WithForm: Story = {
  render: () => (
    <ModalDemo
      title="Edit Profile"
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary">Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input
          placeholder="Full name"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            padding: '8px 12px',
            fontSize: '14px',
          }}
        />
        <input
          placeholder="Email"
          type="email"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            padding: '8px 12px',
            fontSize: '14px',
          }}
        />
      </div>
    </ModalDemo>
  ),
}

// --- All Themes ---

const THEMES = [
  { id: 'onyx',    label: 'Onyx',    bg: '#0f0f0f' },
  { id: 'emerald', label: 'Emerald', bg: '#0a0f0c' },
  { id: 'crimson', label: 'Crimson', bg: '#0f0a0a' },
  { id: 'slate',   label: 'Slate',   bg: '#0d0f14' },
  { id: 'amber',   label: 'Amber',   bg: '#0f0d08' },
  { id: 'rose',    label: 'Rose',    bg: '#0f090d' },
  { id: 'violet',  label: 'Violet',  bg: '#0c0a10' },
] as const

function ThemedModalButton({ themeId, label, bg }: { themeId: string; label: string; bg: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      data-theme={themeId === 'onyx' ? undefined : themeId}
      style={{ background: bg, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}
    >
      <span style={{ color: '#f2f2f2', fontSize: '0.75rem', width: '56px', flexShrink: 0 }}>{label}</span>
      <Button size="sm" onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${label} Theme Modal`}
        description="Theme preview modal."
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => setOpen(false)}>Confirm</Button>
          </div>
        }
      >
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          This modal is rendered with the <strong style={{ color: 'var(--text-primary)' }}>{label}</strong> theme tokens applied.
        </p>
      </Modal>
    </div>
  )
}

export const AllThemes: Story = {
  name: 'All Themes',
  parameters: { controls: { disable: true }, backgrounds: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {THEMES.map(({ id, label, bg }) => (
        <ThemedModalButton key={id} themeId={id} label={label} bg={bg} />
      ))}
    </div>
  ),
}
