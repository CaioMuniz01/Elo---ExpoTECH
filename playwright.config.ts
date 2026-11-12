import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 45000,
  use: { baseURL: 'http://localhost:8082', viewport: { width: 390, height: 844 }, browserName: 'chromium', channel: process.env.CI ? undefined : 'msedge', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node server/test-server.mjs', url: 'http://127.0.0.1:3002/health', reuseExistingServer: false },
    { command: 'npx expo start --web --port 8082', url: 'http://localhost:8082', reuseExistingServer: false, timeout: 120000, env: { EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3002', BROWSER: 'none' } },
  ],
});
