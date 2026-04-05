'use client'

import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { ToastProvider, useToast } from './Toast'
import { Button } from './Button'

/**
 * @status stable
 *
 * Notification system. Wrap the component tree with `<ToastProvider>` and
 * use the `useToast()` hook to fire notifications.
 * Toasts are announced via `aria-live="polite"` for screen-reader support.
 */
const meta = {
  title: 'Base/Toast',
  component: ToastProvider,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Toast is a `use client` component. The stories demonstrate all variants via interactive trigger buttons.',
      },
    },
  },
  // Required `children` satisfied for the controls panel; stories use render() instead.
  args: {
    children: null,
  },
} satisfies Meta<typeof ToastProvider>

export default meta
type Story = StoryObj<typeof meta>

// Trigger component that lives inside the provider
function ToastTriggers({ variant }: { variant?: 'success' | 'error' | 'warning' | 'info' }) {
  const { toast } = useToast()

  const fire = (v: 'success' | 'error' | 'warning' | 'info') => {
    const labels: Record<string, { title: string; message?: string }> = {
      success: { title: 'Changes saved', message: 'Your profile has been updated successfully.' },
      error:   { title: 'Request failed', message: 'Something went wrong. Please try again.' },
      warning: { title: 'Session expiring', message: 'Your session will expire in 5 minutes.' },
      info:    { title: 'Update available', message: 'Nexus CMS v0.2 is ready to install.' },
    }
    toast({ variant: v, ...labels[v] })
  }

  if (variant) {
    return <Button onClick={() => fire(variant)}>Show {variant} toast</Button>
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <Button variant="primary"   onClick={() => fire('success')}>Success</Button>
      <Button variant="danger"    onClick={() => fire('error')}>Error</Button>
      <Button variant="secondary" onClick={() => fire('warning')}>Warning</Button>
      <Button variant="ghost"     onClick={() => fire('info')}>Info</Button>
    </div>
  )
}

export const AllVariants: Story = {
  name: 'All Variants (Interactive)',
  parameters: { controls: { disable: true } },
  render: () => (
    <ToastProvider>
      <ToastTriggers />
    </ToastProvider>
  ),
}

export const Success: Story = {
  render: () => (
    <ToastProvider>
      <ToastTriggers variant="success" />
    </ToastProvider>
  ),
}

export const Error: Story = {
  render: () => (
    <ToastProvider>
      <ToastTriggers variant="error" />
    </ToastProvider>
  ),
}

export const Warning: Story = {
  render: () => (
    <ToastProvider>
      <ToastTriggers variant="warning" />
    </ToastProvider>
  ),
}

export const Info: Story = {
  render: () => (
    <ToastProvider>
      <ToastTriggers variant="info" />
    </ToastProvider>
  ),
}

function PersistentTrigger() {
  const { toast } = useToast()
  return (
    <Button
      onClick={() =>
        toast({
          variant: 'warning',
          title: 'Action required',
          message: 'This toast will not auto-dismiss.',
          duration: 0,
        })
      }
    >
      Persistent toast (duration: 0)
    </Button>
  )
}

export const Persistent: Story = {
  name: 'Persistent (no auto-dismiss)',
  render: () => (
    <ToastProvider>
      <PersistentTrigger />
    </ToastProvider>
  ),
}
