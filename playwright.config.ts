import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}/marche-register/`,
    trace: 'retain-on-failure',
  },
  // iPhone と Android の画面を再現する（05-実装計画 4 章）
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  // 公開用のファイルで確かめる（Service Worker も動かすため）
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/marche-register/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
