import type { LottoSeller } from './seller-cache';
import { decodeSellerText } from './seller-text.ts';

export function sellerKey(seller: LottoSeller): string {
  return seller.RTLRID || `${seller.LATITUDE}:${seller.LONGITUDE}:${seller.FIRMNM}:${seller.BPLCDORODTLADRES}`;
}

export function searchSellers(sellers: LottoSeller[], query: string): LottoSeller[] {
  const terms = decodeSellerText(query).normalize('NFKC').trim().toLocaleLowerCase('ko').split(/\s+/).filter(Boolean);
  if (terms.length === 0) return sellers;

  return sellers.filter((seller) => {
    const text = `${seller.FIRMNM} ${seller.BPLCDORODTLADRES}`.normalize('NFKC').toLocaleLowerCase('ko');
    return terms.every((term) => text.includes(term));
  });
}
