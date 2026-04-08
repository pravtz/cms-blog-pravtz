import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      // Exclude files that require external deps (filesystem, Redis, MDX pipeline)
      // or that are purely infrastructure — they are tested indirectly via integration tests.
      exclude: [
        'src/lib/email.ts',
        'src/lib/redis.ts',
        'src/lib/db.ts',
        'src/lib/mdx.ts',
        'src/lib/rate-limit.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
