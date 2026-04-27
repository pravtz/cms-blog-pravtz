import { defineConfig, devices } from '@playwright/test'

const ADMIN_PORT = 3901
const BLOG_PORT = 3900
const ADMIN_URL = `http://localhost:${ADMIN_PORT}`
const BLOG_URL = `http://localhost:${BLOG_PORT}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // state-dependent tests must run sequentially
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,

  use: {
    baseURL: ADMIN_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: `E2E_TESTING=true DATA_DIR=/tmp/nexus-e2e JWT_SECRET=e2e-test-jwt-secret-at-least-32chars JWT_REFRESH_SECRET=e2e-test-refresh-secret-32chars NEXT_DIST_DIR=.next-e2e npx next dev -p ${ADMIN_PORT}`,
      cwd: '../admin',
      url: `${ADMIN_URL}/api/setup/status`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        E2E_TESTING: 'true',
        DATA_DIR: '/tmp/nexus-e2e',
        JWT_SECRET: 'e2e-test-jwt-secret-at-least-32chars',
        JWT_REFRESH_SECRET: 'e2e-test-refresh-secret-32chars',
        NEXT_PUBLIC_BLOG_URL: BLOG_URL,
      },
    },
    {
      command: `ADMIN_URL=${ADMIN_URL} NEXT_PUBLIC_ADMIN_URL=${ADMIN_URL} NEXT_PUBLIC_BLOG_URL=${BLOG_URL} NEXT_DIST_DIR=.next-e2e npx next dev -p ${BLOG_PORT}`,
      cwd: '../blog',
      url: BLOG_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ADMIN_URL: ADMIN_URL,
        NEXT_PUBLIC_ADMIN_URL: ADMIN_URL,
        NEXT_PUBLIC_BLOG_URL: BLOG_URL,
      },
    },
  ],
})

export { ADMIN_URL, BLOG_URL }
