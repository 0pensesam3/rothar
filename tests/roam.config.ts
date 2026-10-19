import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// The weekly free-roam agent writes its own scripts into ux-run/roam/ and runs them
// with this config: the same fake London, fake GPS and phone size as the daily checks.
export default defineConfig({
  ...base,
  testDir: '../ux-run/roam',
  testMatch: /.*\.spec\.ts/,
  outputDir: '../ux-run/roam/output',
  reporter: [['list']],
  projects: [{ name: 'mocked' }],
  webServer: { ...(base.webServer as any), command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory ..' },
});
