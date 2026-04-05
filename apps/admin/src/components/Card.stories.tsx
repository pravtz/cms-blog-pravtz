import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardBody, CardFooter, CardHeader } from './Card'
import { Button } from './Button'

/**
 * @status stable
 *
 * Surface container. Compose with CardHeader, CardBody, CardFooter for
 * structured layouts. Set `interactive` for clickable cards.
 */
const meta = {
  title: 'Base/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card>
      <CardBody>Card content goes here.</CardBody>
    </Card>
  ),
}

export const WithHeader: Story = {
  render: () => (
    <Card>
      <CardHeader title="Card Title" description="Optional description for the card." />
      <CardBody>Main content area.</CardBody>
    </Card>
  ),
}

export const WithHeaderAndFooter: Story = {
  render: () => (
    <Card>
      <CardHeader
        title="Confirm Action"
        description="This cannot be undone."
        actions={<Button variant="ghost" size="sm">Cancel</Button>}
      />
      <CardBody>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Are you sure you want to delete this item? All associated data will be permanently removed.
        </p>
      </CardBody>
      <CardFooter>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Delete</Button>
        </div>
      </CardFooter>
    </Card>
  ),
}

export const Elevated: Story = {
  render: () => (
    <Card elevated>
      <CardBody>Elevated card with extra shadow.</CardBody>
    </Card>
  ),
}

export const Interactive: Story = {
  render: () => (
    <Card interactive onClick={() => alert('Card clicked!')}>
      <CardBody>Click me — I am an interactive card.</CardBody>
    </Card>
  ),
}

export const NoPadding: Story = {
  render: () => (
    <Card padding="none">
      <div
        style={{
          padding: '24px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        Custom padding content.
      </div>
    </Card>
  ),
}

export const AllVariants: Story = {
  name: 'All Variants',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card>
        <CardBody>Default Card</CardBody>
      </Card>
      <Card elevated>
        <CardBody>Elevated Card</CardBody>
      </Card>
      <Card interactive onClick={() => {}}>
        <CardBody>Interactive Card (hoverable, focusable)</CardBody>
      </Card>
    </div>
  ),
}
