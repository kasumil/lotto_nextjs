import assert from 'node:assert/strict';
import test from 'node:test';
import { searchSellers, sellerKey } from '../src/lib/seller-search.ts';

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
