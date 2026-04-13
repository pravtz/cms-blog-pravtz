import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './Input'

/**
 * @status stable
 *
 * Form input with label, hint, error, and optional prefix/suffix slots.
 * Uses `forwardRef` so refs work for focus management.
 */
const meta = {
  title: 'Base/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  args: {
    label: 'Label',
    placeholder: 'Placeholder…',
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithHint: Story = {
  args: {
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    hint: 'We will never share your email.',
  },
}

export const WithError: Story = {
  args: {
    label: 'Username',
    value: 'bad user!',
    error: 'Only letters, numbers, and underscores are allowed.',
    readOnly: true,
  },
}

export const Required: Story = {
  args: {
    label: 'Full name',
    required: true,
    placeholder: 'Jane Doe',
  },
}

export const WithPrefix: Story = {
  args: {
    label: 'Website',
    prefix: 'https://',
    placeholder: 'example.com',
  },
}

export const WithSuffix: Story = {
  args: {
    label: 'Price',
    type: 'number',
    suffix: 'USD',
    placeholder: '0.00',
  },
}

export const Password: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: '••••••••',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Disabled field',
    value: 'Cannot edit',
    disabled: true,
  },
}

export const AllStates: Story = {
  name: 'All States',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
      <Input label="Default" placeholder="Placeholder…" />
      <Input label="With hint" hint="Helpful hint text" placeholder="Placeholder…" />
      <Input label="With error" error="This field is required" placeholder="Placeholder…" />
      <Input label="Required" required placeholder="Placeholder…" />
      <Input label="With prefix" prefix="@" placeholder="username" />
      <Input label="With suffix" suffix=".com" placeholder="domain" />
      <Input label="Disabled" disabled value="Disabled value" />
    </div>
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

export const AllThemes: Story = {
  name: 'All Themes',
  parameters: { controls: { disable: true }, backgrounds: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {THEMES.map(({ id, label, bg }) => (
        <div
          key={id}
          data-theme={id === 'onyx' ? undefined : id}
          style={{ background: bg, padding: '16px 24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}
        >
          <span style={{ color: '#f2f2f2', fontSize: '0.75rem', width: '56px', flexShrink: 0, paddingTop: '28px' }}>{label}</span>
          <Input label="Default" placeholder="Placeholder…" style={{ width: '180px' }} />
          <Input label="With error" error="Required" placeholder="Placeholder…" style={{ width: '180px' }} />
        </div>
      ))}
    </div>
  ),
}
