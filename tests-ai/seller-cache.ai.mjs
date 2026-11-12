import { isDeepStrictEqual } from 'node:util';
import { test, expect, runGoal } from './shared-runtime.mjs';
import {
  helperSha256,
  installSellerCacheFixture,
  lifecycleLabels,
  readCacheObservations,
  recoveryLabels,
} from './seller-cache.fixture.mjs';

// Standard Playwright test contexts are fresh per test. No profile or app login.
test.use({
  browserName: 'chromium',
  headless: true,
  offline: true,
  serviceWorkers: 'block',
  storageState: { cookies: [], origins: [] },
  permissions: [],
  acceptDownloads: false,
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});

const networkCounts = new WeakMap();
test.beforeEach(async ({ context, page }) => {
  const counts = { requests: 0, websockets: 0, pageErrors: [] };
  networkCounts.set(page, counts);
  context.on('request', () => { counts.requests += 1; });
  await context.route('**/*', route => route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*', socket => { counts.websockets += 1; socket.close(); });
  page.on('pageerror', error => counts.pageErrors.push(error.message));
});
test.afterEach(async ({ context, page }) => {
  expect(networkCounts.get(page)).toEqual({ requests: 0, websockets: 0, pageErrors: [] });
  expect(context.pages()).toHaveLength(1);
  expect(page.url()).toBe('about:blank');
});

const lifecycleExpected = {
  scenario: 'lifecycle', phase: 'complete', ttlMs: 3_600_000, fetchCalls: 2,
  events: [
    { kind: 'concurrent-read', samePromise: true, fetchCalls: 1 },
    { kind: 'first-result', ids: ['fixture-first'], fetchCalls: 1 },
    { kind: 'fresh-read', atMs: 3_599_999, sameData: true, ids: ['fixture-first'], fetchCalls: 1 },
    { kind: 'boundary-read', atMs: 3_600_000, samePromise: true, fetchCalls: 2 },
    { kind: 'refreshed-result', ids: ['fixture-refreshed'], fetchCalls: 2 },
  ],
};
const recoveryExpected = (scenario, message) => ({
  scenario, phase: 'complete', ttlMs: 3_600_000, fetchCalls: 2,
  events: [
    { kind: 'first-outcome', outcome: 'rejected', message, fetchCalls: 1 },
    { kind: 'retry-result', ids: ['fixture-recovered'], fetchCalls: 2 },
  ],
});

function options(page, { goal, labels, expected }) {
  const live = process.env.AI_E2E_LIVE_LOCAL === '1';
  return {
    goal,
    // Compares observed helper behavior against host-authored fixed expectations.
    // Neither a model completion claim nor a fixture success flag can pass it.
    hasReached: async () => isDeepStrictEqual(await readCacheObservations(page), expected),
    trust: { origins: [], paths: [], allowAboutBlank: true },
    allowedDialogs: [],
    authorizeAction: ({ action, control }) => action.action === 'click'
      && control.tag === 'button' && !control.form && labels.includes(control.label),
    model: live
      ? { mode: 'local', live: true, name: 'qwen3:32b' }
      : { mode: 'stub', decide: ({ snapshot }) => {
        const target = snapshot.controls.find(control => !control.disabled && labels.includes(control.label));
        return target ? { action: 'click', target: target.id } : { action: 'stop', target: -1 };
      } },
    budgets: { maxSteps: 6, totalMs: live ? 90_000 : 15_000, requestMs: live ? 35_000 : 2_000, domWaitMs: 2_000, loadingWaitMs: 2_000 },
  };
}

async function recordAndCheck(page, testInfo, result, expected, actions) {
  const live = process.env.AI_E2E_LIVE_LOCAL === '1';
  await testInfo.attach('seller-cache-wrapper-evidence', {
    body: JSON.stringify({
      scope: 'synthetic-browser-real-project-helper',
      helper: 'src/lib/seller-cache.ts', helperSha256,
      observations: await readCacheObservations(page),
      network: networkCounts.get(page), result,
    }, null, 2),
    contentType: 'application/json',
  });
  expect(result.success, JSON.stringify(result)).toBe(true);
  expect(result.completedBy).toBe('oracle');
  expect(result.actions).toBe(actions);
  expect(result.inference).toBe(live ? 'local-model' : 'stubbed-test');
  if (!live) expect(result.realAttemptedCalls).toBe(0);
  expect(result.requiresPageDisposal).toBe(false);
  expect(await readCacheObservations(page)).toEqual(expected);
}

test('real seller cache: concurrent loads, TTL-1 reuse, exact TTL refresh', async ({ page }, testInfo) => {
  await installSellerCacheFixture(page, 'lifecycle');
  const result = await runGoal(page, options(page, {
    goal: 'Exercise the synthetic public seller cache. Click Load concurrent readers, Resolve first public fixture, Read at one-hour boundary, then Resolve refreshed public fixture. Finish only when the observation phase is complete.',
    labels: lifecycleLabels,
    expected: lifecycleExpected,
  }));
  await recordAndCheck(page, testInfo, result, lifecycleExpected, 4);
});

for (const [scenario, message] of [
  ['rejected-response', 'Synthetic upstream unavailable'],
  ['malformed-response', 'Invalid public seller data'],
]) {
  test(`real seller cache: ${scenario} is not cached and retry recovers`, async ({ page }, testInfo) => {
    await installSellerCacheFixture(page, scenario);
    const expected = recoveryExpected(scenario, message);
    const result = await runGoal(page, options(page, {
      goal: 'Exercise synthetic cache recovery. Click Read unavailable fixture, then Retry public fixture. The first synthetic response must be rejected and the second load must return fixture-recovered. Finish only when the observation phase is complete.',
      labels: recoveryLabels,
      expected,
    }));
    await recordAndCheck(page, testInfo, result, expected, 2);
  });
}

test('oracle control: a stub completion claim cannot pass an untouched cache', async ({ page }) => {
  await installSellerCacheFixture(page, 'lifecycle');
  const result = await runGoal(page, {
    ...options(page, { goal: 'Complete the synthetic cache lifecycle.', labels: lifecycleLabels, expected: lifecycleExpected }),
    model: { mode: 'stub', decide: () => ({ action: 'done', target: -1 }) },
  });
  expect(result).toMatchObject({ success: false, completedBy: 'failure', actions: 0, realAttemptedCalls: 0, inference: 'stubbed-test' });
  expect(result.errors.join('\n')).toContain('independent oracle failed');
  expect(await readCacheObservations(page)).toEqual({ scenario: 'lifecycle', phase: 'idle', ttlMs: 3_600_000, fetchCalls: 0, events: [] });
});

test('policy control: denying the proposed click leaves the real cache untouched', async ({ page }) => {
  await installSellerCacheFixture(page, 'lifecycle');
  const result = await runGoal(page, {
    ...options(page, { goal: 'Complete the synthetic cache lifecycle.', labels: lifecycleLabels, expected: lifecycleExpected }),
    model: { mode: 'stub', decide: ({ snapshot }) => ({ action: 'click', target: snapshot.controls.find(control => control.label === lifecycleLabels[0]).id }) },
    authorizeAction: () => false,
  });
  expect(result).toMatchObject({ success: false, completedBy: 'policy-stopped', actions: 0, realAttemptedCalls: 0, inference: 'stubbed-test' });
  expect(result.stopReason).toBe('Caller authorization denied the model-selected action');
  expect(await readCacheObservations(page)).toEqual({ scenario: 'lifecycle', phase: 'idle', ttlMs: 3_600_000, fetchCalls: 0, events: [] });
});
