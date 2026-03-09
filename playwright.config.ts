import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for integration / visual-regression tests.
 *
 * Reference screenshots are committed to:
 *   src/test/integration/__screenshots__/
 *
 * On first run (or when updating baselines): npx playwright test --update-snapshots
 * On subsequent runs:                         npm run test:integration
 */
export default defineConfig({
  testDir: './src/test/integration',
  testMatch: '**/*.spec.ts',

  /* Serve project root over HTTP – required so ES module imports work in Chromium */
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:3737',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  /* Run tests in a single worker for deterministic screenshots */
  workers: 1,
  fullyParallel: false,
  retries: 0,

  /* Shared settings for every test project */
  use: {
    /* Base URL → local HTTP server started by webServer above */
    baseURL: 'http://127.0.0.1:3737',

    /* Clip screenshots to a fixed viewport so comparisons are stable */
    viewport: { width: 960, height: 700 },

    /* Disable animations / transitions for pixel-perfect diffs */
    reducedMotion: 'reduce',

    /* Screenshot / snapshot settings */
    screenshot: 'only-on-failure',
  },

  /* Visual snapshot comparison options */
  expect: {
    toHaveScreenshot: {
      /* Real CartoCDN tile screenshots: allow up to 5% pixel diff between runs.
         Tiles are static for given coordinates but may have minor rendering
         differences across OS/GPU/Chromium versions. */
      maxDiffPixelRatio: 0.05,
      /* Per-pixel colour tolerance (0-1): 0.15 handles anti-aliasing at tile borders */
      threshold: 0.15,
    },
  },

  /* Output dirs */
  outputDir: 'test-results/',
  snapshotDir: 'src/test/integration/__screenshots__',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* HTML report – view with: npx playwright show-report */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
