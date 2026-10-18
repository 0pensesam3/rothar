import { defineConfig } from '@playwright/test';

// Two runs:
//   mocked: fake London (fixed stations, routes and search), fake GPS and compass. Same result every day.
//   live:   the real TfL, routing and search services. Catches outside changes; results vary.
export default defineConfig({
  testDir: 'tests',
  outputDir: 'ux-run/test-output',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'ux-run/results.json' }], ['html', { outputFolder: 'ux-run/html', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },          // iPhone 13/14 size
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'mocked', testIgnore: /live\.spec\.ts/ },
    { name: 'live', testMatch: /live\.spec\.ts/ },
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
  },
});
