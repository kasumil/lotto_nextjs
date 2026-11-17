import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { searchSellers, sellerKey } from '../src/lib/seller-search.ts';
import { decodeSellerText, normalizeSellerText } from '../src/lib/seller-text.ts';
import { sellerCache } from '../src/lib/seller-cache.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const sellers = [
  { RTLRID: '1', FIRMNM: '행운복권', BPLCDORODTLADRES: '서울 중구 세종대로 1', LATITUDE: 37.5, LONGITUDE: 127, RTLRSTRTELNO: '' },
  { RTLRID: '2', FIRMNM: 'Lucky Lotto', BPLCDORODTLADRES: '부산 해운대구 센텀로 2', LATITUDE: 35.1, LONGITUDE: 129, RTLRSTRTELNO: '' },
];

test('store search matches name and address across normalized terms', () => {
  assert.deepEqual(searchSellers(sellers, '행운'), [sellers[0]]);
  assert.deepEqual(searchSellers(sellers, '서울 세종대로'), [sellers[0]]);
  assert.deepEqual(searchSellers(sellers, 'lucky  부산'), [sellers[1]]);
  assert.deepEqual(searchSellers(sellers, 'ＬＵＣＫＹ'), [sellers[1]]);
  assert.deepEqual(searchSellers(sellers, '없는 매장'), []);
});

test('empty query resets to the supplied list and keys remain stable', () => {
  assert.equal(searchSellers(sellers, '  '), sellers);
  assert.equal(sellerKey(sellers[0]), '1');
  assert.equal(sellerKey({ ...sellers[0], RTLRID: '' }), '37.5:127:행운복권:서울 중구 세종대로 1');
});

test('nested, named, decimal and hex entities decode as plain seller text', () => {
  assert.equal(decodeSellerText('가로가판대제57호&&#35;40;구&&#35;41;'), '가로가판대제57호(구)');
  assert.equal(decodeSellerText('학창&amp;배팅샵 &apos;행운&apos; &quot;로또&quot;'), '학창&배팅샵 \'행운\' "로또"');
  assert.equal(decodeSellerText('A&#40;B&#x29; &#X26; C &lt;명당&gt;'), 'A(B) & C <명당>');
  assert.equal(decodeSellerText('한글 · 로또/토토 + 1등'), '한글 · 로또/토토 + 1등');
  assert.equal(decodeSellerText('A & B &amp; C'), 'A & B & C');
});

test('invalid and unknown entities remain literal and encoded tags stay inert text', () => {
  const attack = '&amp;lt;img src=x onerror=alert(1)&amp;gt;';
  assert.equal(decodeSellerText(attack), '<img src=x onerror=alert(1)>');
  const markup = renderToStaticMarkup(createElement('span', null, decodeSellerText(attack)));
  assert.equal(markup, '<span>&lt;img src=x onerror=alert(1)&gt;</span>');
  assert.equal(decodeSellerText('&unknown; &#0; &#xD800; &#x110000; &#xyz; &broken'),
    '&unknown; &#0; &#xD800; &#x110000; &#xyz; &broken');
  assert.equal(decodeSellerText('&#60;script&#62;alert(1)&#60;/script&#62;'), '<script>alert(1)</script>');
});

test('map popup keeps decoded values in text nodes, never raw HTML', async () => {
  const marker = await readFile(new URL('../src/hooks/useSellerMarkers.ts', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../src/components/SellerPanel.tsx', import.meta.url), 'utf8');
  assert.match(marker, /line\.textContent = text/);
  assert.doesNotMatch(marker, /\binnerHTML\b|dangerouslySetInnerHTML/);
  assert.doesNotMatch(panel, /\binnerHTML\b|dangerouslySetInnerHTML/);
});

test('normalized source keeps raw data intact and search matches displayed name and address', () => {
  const raw = {
    ...sellers[0],
    FIRMNM: '가로가판대제57호&&#35;40;구&&#35;41;',
    BPLCDORODTLADRES: '서울&amp;경기 세종대로&#40;서쪽&#41; 1',
    RTLRSTRTELNO: '02-1234-5678',
  };
  const shown = normalizeSellerText(raw);
  assert.equal(raw.FIRMNM, '가로가판대제57호&&#35;40;구&&#35;41;');
  assert.equal(shown.FIRMNM, '가로가판대제57호(구)');
  assert.equal(shown.BPLCDORODTLADRES, '서울&경기 세종대로(서쪽) 1');
  assert.deepEqual(searchSellers([shown], '가로가판대제57호(구)'), [shown]);
  assert.deepEqual(searchSellers([shown], '서울&경기 서쪽'), [shown]);
  assert.deepEqual(searchSellers([shown], '세종대로&#40;서쪽&#41;'), [shown]);
});

test('public data sample and cache ingestion use the same decoded text without rewriting source', async () => {
  const raw = await readFile(new URL('../public/lotto_sellers.json', import.meta.url), 'utf8');
  const rows = JSON.parse(raw);
  const sample = rows.find((row) => row.FIRMNM === '가로가판대제57호&&#35;40;구&&#35;41;');
  assert.ok(sample);
  assert.equal(normalizeSellerText(sample).FIRMNM, '가로가판대제57호(구)');
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => [sample] });
    const [shown] = await sellerCache.load();
    assert.equal(shown.FIRMNM, '가로가판대제57호(구)');
    assert.deepEqual(searchSellers([shown], '가로가판대제57호(구)'), [shown]);
    assert.equal(sample.FIRMNM, '가로가판대제57호&&#35;40;구&&#35;41;');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
