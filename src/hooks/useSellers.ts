import { useEffect, useState } from 'react';
import { sellerCache, type LottoSeller } from '@/lib/seller-cache';
export type { LottoSeller } from '@/lib/seller-cache';

export const useSellers = () => {
  const [sellers, setSellers] = useState<LottoSeller[]>([]);

  useEffect(() => {
    let active = true;
    sellerCache.load()
      .then((data) => { if (active) setSellers(data); })
      .catch(() => console.error('판매점 데이터를 불러오지 못했습니다.'));
    return () => { active = false; };
  }, []);

  return sellers;
};
