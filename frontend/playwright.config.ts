import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', use: { channel: process.env.PLAYWRIGHT_CHANNEL, baseURL: 'http://127.0.0.1:12200', viewport: { width: 390, height: 844 } }, webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 12200', url: 'http://127.0.0.1:12200', reuseExistingServer: true } });
