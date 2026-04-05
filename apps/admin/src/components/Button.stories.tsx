import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

/**
 * @status stable
 *
 * Primary action component. Supports four variants and three sizes.
 * Loading state shows a spinner and disables pointer events.
 */
const meta = {
  title: 'Base/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'md',
    fullWidth: false,
    loading: false,
    disabled: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

// --- Variants ---

export const Primary: Story = {
  args: { variant: 'primary', children: 'Primary' },
}

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondary' },
}

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Ghost' },
}

export const Danger: Story = {
  args: { variant: 'danger', children: 'Danger' },
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

// --- States ---

export const Loading: Story = {
  args: { loading: true, children: 'Loading…' },
}

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' },
}

export const FullWidth: Story = {
  args: { fullWidth: true, children: 'Full Width' },
  parameters: { layout: 'padded' },
}

// --- All Variants Grid ---

export const AllVariants: Story = {
  name: 'All Variants',
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  name: 'All Sizes',
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}
