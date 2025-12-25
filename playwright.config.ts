import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run start -- --host 0.0.0.0 --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
