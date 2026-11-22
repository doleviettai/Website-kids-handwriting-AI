import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  reporter: 'list',
  use: {
    actionTimeout: 10000,
    navigationTimeout: 15000,
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1365, height: 920 },
    trace: 'off',
    video: 'off',
  },
})
