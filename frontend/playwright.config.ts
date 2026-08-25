import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } }, webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true } });
