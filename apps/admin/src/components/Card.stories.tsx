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
  parameters: { controls: { disable: true }, backgrounds: { disable: true }, layout: 'padded' },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {THEMES.map(({ id, label, bg }) => (
        <div
          key={id}
          data-theme={id === 'onyx' ? undefined : id}
          style={{ background: bg, padding: '16px 24px' }}
        >
          <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '8px' }}>{label}</p>
          <Card>
            <CardHeader title="Card Title" description="Theme preview" />
            <CardBody>Content area</CardBody>
            <CardFooter>
              <Button variant="primary" size="sm">Action</Button>
            </CardFooter>
          </Card>
        </div>
      ))}
    </div>
  ),
}
