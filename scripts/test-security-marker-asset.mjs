import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('seller marker is a same-origin self-contained asset, not a retired external CDN', () => {
  const config = readFileSync(new URL('../src/types/marker.ts', import.meta.url), 'utf8');
  assert.match(config, /src: "\/images\/seller-marker\.svg"/);
  assert.doesNotMatch(config, /daumcdn|kakaocdn/);
  const svg = readFileSync(new URL('../public/images/seller-marker.svg', import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 24 35"/);
  assert.doesNotMatch(svg, /<script|<foreignObject|(?:href|onload)=/i);
});
