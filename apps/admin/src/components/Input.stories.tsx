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
