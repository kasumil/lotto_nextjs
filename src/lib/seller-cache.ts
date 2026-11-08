export interface LottoSeller {
  RTLRID?: string;
  BPLCDORODTLADRES: string;
  FIRMNM: string;
  LATITUDE: number;
  LONGITUDE: number;
  RTLRSTRTELNO: string;
}

// This file contains public, deployment-bundled seller data only.
export const SELLER_CACHE_TTL_MS = 60 * 60 * 1000;

export function createSellerCache(
  fetchData: () => Promise<LottoSeller[]>,
  now: () => number = Date.now,
  ttlMs = SELLER_CACHE_TTL_MS,
) {
  let cached: { data: LottoSeller[]; expiresAt: number } | undefined;
  let pending: Promise<LottoSeller[]> | undefined;

  return {
    load(): Promise<LottoSeller[]> {
      if (cached && now() < cached.expiresAt) return Promise.resolve(cached.data);
      if (pending) return pending;
      pending = fetchData().then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid public seller data');
        cached = { data, expiresAt: now() + ttlMs };
        return data;
      }).finally(() => { pending = undefined; });
      return pending;
    },
  };
}

export const sellerCache = createSellerCache(async () => {
  const response = await fetch('/lotto-sellers-map.json', { credentials: 'omit', cache: 'no-cache' });
  if (!response.ok) throw new Error('Public seller data request failed');
  return response.json();
});
