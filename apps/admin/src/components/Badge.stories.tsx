import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge'

/**
 * @status stable
 *
 * Inline label for status, category, or count. Six semantic variants.
 * Use `dot` to show a status indicator alongside the label.
 */
const meta = {
  title: 'Base/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    children: 'Badge',
    variant: 'default',
    size: 'md',
    dot: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'error', 'info'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

// --- Variants ---

export const Default: Story = {
  args: { variant: 'default', children: 'Default' },
}

export const Primary: Story = {
  args: { variant: 'primary', children: 'Primary' },
}

export const Success: Story = {
  args: { variant: 'success', children: 'Active' },
}

export const Warning: Story = {
  args: { variant: 'warning', children: 'Pending' },
}

export const Error: Story = {
  args: { variant: 'error', children: 'Error' },
}

export const Info: Story = {
  args: { variant: 'info', children: 'Info' },
}

// --- Sizes ---

export const Small: Story = {
  args: { size: 'sm', children: 'Small' },
}

export const Medium: Story = {
  args: { size: 'md', children: 'Medium' },
}

export const Large: Story = {
  args: { size: 'lg', children: 'Large' },
}

// --- With Dot ---

export const WithDot: Story = {
  args: { dot: true, variant: 'success', children: 'Online' },
}

// --- All Variants Grid ---

export const AllVariants: Story = {
  name: 'All Variants',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
}

export const AllVariantsWithDot: Story = {
  name: 'All Variants — With Dot',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge variant="default" dot>Default</Badge>
      <Badge variant="primary" dot>Primary</Badge>
      <Badge variant="success" dot>Active</Badge>
      <Badge variant="warning" dot>Pending</Badge>
      <Badge variant="error" dot>Suspended</Badge>
      <Badge variant="info" dot>Info</Badge>
    </div>
  ),
}

export const AllSizes: Story = {
  name: 'All Sizes',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Badge size="sm" variant="primary">Small</Badge>
      <Badge size="md" variant="primary">Medium</Badge>
      <Badge size="lg" variant="primary">Large</Badge>
    </div>
  ),
}
