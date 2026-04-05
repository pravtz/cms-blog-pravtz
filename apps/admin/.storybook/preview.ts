import type { Preview } from '@storybook/react'
import '../src/app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'onyx',
      values: [
        { name: 'onyx', value: '#0f0f0f' },
        { name: 'elevated', value: '#1e1e1e' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    a11y: {
      // axe-core options
      config: {},
      options: {},
    },
  },
}

export default preview
