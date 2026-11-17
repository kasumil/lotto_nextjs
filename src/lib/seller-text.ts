import type { LottoSeller } from './seller-cache';

const named: Record<string, string> = {
  amp: '&', apos: "'", quot: '"', lt: '<', gt: '>',
  nbsp: '\u00a0', copy: '©', reg: '®', trade: '™',
  ndash: '–', mdash: '—',
};

const entity = /&(#(?:[xX][0-9a-fA-F]+|[0-9]+)|[A-Za-z][A-Za-z0-9]+);/g;

// Only decode text entities. Never parse the result as HTML.
export function decodeSellerText(value: string): string {
  let result = value;
  // The public source contains nested forms such as &&#35;40; -> &#40; -> (.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = result.replace(entity, (match, code: string) => {
      if (!code.startsWith('#')) return named[code] ?? match;
      const hex = code[1] === 'x' || code[1] === 'X';
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isInteger(point) || point === 0 || point > 0x10ffff ||
          (point >= 0xd800 && point <= 0xdfff) ||
          (point < 0x20 && point !== 0x09 && point !== 0x0a && point !== 0x0d)) return match;
      return String.fromCodePoint(point);
    });
    if (next === result) break;
    result = next;
  }
  return result;
}

export function normalizeSellerText(seller: LottoSeller): LottoSeller {
  return {
    ...seller,
    FIRMNM: decodeSellerText(seller.FIRMNM),
    BPLCDORODTLADRES: decodeSellerText(seller.BPLCDORODTLADRES),
    RTLRSTRTELNO: decodeSellerText(seller.RTLRSTRTELNO),
  };
}
