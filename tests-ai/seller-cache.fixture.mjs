// Authored synthetic UI only. The cache implementation is read from the project.
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';

const helperUrl = new URL('../src/lib/seller-cache.ts', import.meta.url);
const source = await readFile(helperUrl, 'utf8');
export const helperSha256 = createHash('sha256').update(source).digest('hex');
const helperJavaScript = stripTypeScriptTypes(source, { mode: 'strip' });

export const lifecycleLabels = [
  'Load concurrent readers',
  'Resolve first public fixture',
  'Read at one-hour boundary',
  'Resolve refreshed public fixture',
];
export const recoveryLabels = ['Read unavailable fixture', 'Retry public fixture'];

function mountFixture({ createSellerCache, ttlMs, scenario }) {
  const output = document.querySelector('#cache-observations');
  const control = document.querySelector('#cache-action');
  const phase = document.querySelector('#cache-phase');
  let clock = 0;
  let settle;
  let current;
  const report = { scenario, phase: 'idle', ttlMs, fetchCalls: 0, events: [] };
  const rows = id => [{
    RTLRID: id,
    FIRMNM: 'Synthetic cache fixture',
    BPLCDORODTLADRES: 'Synthetic fixture address',
    LATITUDE: 0,
    LONGITUDE: 0,
    RTLRSTRTELNO: '',
  }];
  const ids = data => data.map(row => row.RTLRID);
  const render = (nextPhase, label, handler) => {
    report.phase = nextPhase;
    phase.textContent = nextPhase;
    output.textContent = JSON.stringify(report);
    control.hidden = !handler;
    control.disabled = !handler;
    control.textContent = label || 'Scenario complete';
    control.onclick = handler ? async () => {
      control.disabled = true;
      try { await handler(); }
      catch (error) {
        report.events.push({ kind: 'unexpected-exception', message: String(error) });
        render('incomplete', '', null);
      }
    } : null;
  };

  if (scenario === 'lifecycle') {
    const cache = createSellerCache(() => {
      report.fetchCalls += 1;
      return new Promise(resolve => { settle = resolve; });
    }, () => clock);
    const resolveRefresh = async () => {
      settle(rows('fixture-refreshed'));
      const data = await current;
      report.events.push({ kind: 'refreshed-result', ids: ids(data), fetchCalls: report.fetchCalls });
      render('complete', '', null);
    };
    const expire = () => {
      // Explicit specification values, not boundaries derived from the implementation.
      clock = 3_600_000;
      current = cache.load();
      const concurrent = cache.load();
      report.events.push({ kind: 'boundary-read', atMs: clock, samePromise: current === concurrent, fetchCalls: report.fetchCalls });
      render('refresh-pending', 'Resolve refreshed public fixture', resolveRefresh);
    };
    const resolveFirst = async () => {
      settle(rows('fixture-first'));
      const data = await current;
      report.events.push({ kind: 'first-result', ids: ids(data), fetchCalls: report.fetchCalls });
      clock = 3_599_999;
      const fresh = await cache.load();
      report.events.push({ kind: 'fresh-read', atMs: clock, sameData: fresh === data, ids: ids(fresh), fetchCalls: report.fetchCalls });
      render('fresh', 'Read at one-hour boundary', expire);
    };
    render('idle', 'Load concurrent readers', () => {
      current = cache.load();
      const concurrent = cache.load();
      report.events.push({ kind: 'concurrent-read', samePromise: current === concurrent, fetchCalls: report.fetchCalls });
      render('first-pending', 'Resolve first public fixture', resolveFirst);
    });
  } else if (scenario === 'rejected-response' || scenario === 'malformed-response') {
    const cache = createSellerCache(async () => {
      report.fetchCalls += 1;
      if (report.fetchCalls === 1) {
        if (scenario === 'rejected-response') throw new Error('Synthetic upstream unavailable');
        return { unexpected: 'not an array' };
      }
      return rows('fixture-recovered');
    }, () => clock);
    const retry = async () => {
      const data = await cache.load();
      report.events.push({ kind: 'retry-result', ids: ids(data), fetchCalls: report.fetchCalls });
      render('complete', '', null);
    };
    render('idle', 'Read unavailable fixture', async () => {
      try {
        const data = await cache.load();
        report.events.push({ kind: 'first-outcome', outcome: 'resolved', value: data, fetchCalls: report.fetchCalls });
      } catch (error) {
        report.events.push({ kind: 'first-outcome', outcome: 'rejected', message: error.message, fetchCalls: report.fetchCalls });
      }
      render('retry-available', 'Retry public fixture', retry);
    });
  } else {
    throw new Error('Unknown synthetic cache scenario');
  }
}

export async function installSellerCacheFixture(page, scenario) {
  await page.setContent(`<!doctype html><html lang="en"><head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'">
    <title>Synthetic public seller cache test</title>
    </head><body><main>
    <h1>Synthetic public seller cache test</h1>
    <p>Isolated helper fixture. No map, location, account, or transaction.</p>
    <p id="cache-phase" role="status" aria-live="polite">Preparing fixture</p>
    <button id="cache-action" type="button" disabled>Preparing fixture</button>
    <pre id="cache-observations"></pre>
    </main></body></html>`);
  await page.addScriptTag({ type: 'module', content: `${helperJavaScript}\n(${mountFixture.toString()})({ createSellerCache, ttlMs: SELLER_CACHE_TTL_MS, scenario: ${JSON.stringify(scenario)} });` });
  await page.locator('#cache-action').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#cache-action')?.disabled === false);
}

export async function readCacheObservations(page) {
  return JSON.parse(await page.locator('#cache-observations').textContent());
}
