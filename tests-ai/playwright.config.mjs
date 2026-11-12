// Explicit opt-in suite: no project config, webServer or production session.
const config = {
  testDir: '.', testMatch: '**/*.ai.mjs',
  timeout: process.env.AI_E2E_LIVE_LOCAL === '1' ? 100_000 : 30_000,
  workers: 1, retries: 0, fullyParallel: false, reporter: [['list'], ['json', { outputFile: '../.ai-e2e-results/results.json' }]],
  outputDir: '../.ai-e2e-results',
  use: { browserName: 'chromium', headless: true, offline: true, acceptDownloads: false, permissions: [],
    storageState: { cookies: [], origins: [] }, serviceWorkers: 'block',
    trace: 'off', screenshot: 'off', video: 'off' },
};

export default config;
