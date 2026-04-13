import type { Preview } from '@storybook/react'
import '../src/app/globals.css'

const THEME_IDS = ['onyx', 'emerald', 'crimson', 'slate', 'amber', 'rose', 'violet'] as const

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      defaultValue: 'onyx',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: THEME_IDS.map((id) => ({
          value: id,
          title: id.charAt(0).toUpperCase() + id.slice(1),
        })),
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as string
      // Apply data-theme to the story container
      const el = document.documentElement
      if (theme && theme !== 'onyx') {
        el.setAttribute('data-theme', theme)
      } else {
        el.removeAttribute('data-theme')
      }
      return Story()
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'var(--bg-primary, #0f0f0f)' },
        { name: 'elevated', value: 'var(--bg-elevated, #1e1e1e)' },
      ],
    },
    a11y: {
      config: {},
      options: {},
    },
  },
}

export default preview
