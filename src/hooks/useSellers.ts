import { useEffect, useState } from 'react';
import { sellerCache, type LottoSeller } from '@/lib/seller-cache';
export type { LottoSeller } from '@/lib/seller-cache';

export const useSellers = () => {
  const [sellers, setSellers] = useState<LottoSeller[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    sellerCache.load()
      .then((data) => {
        if (!active) return;
        setSellers(data);
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [attempt]);

  return {
    sellers,
    status,
    retry: () => {
      setStatus('loading');
      setAttempt((value) => value + 1);
    },
  };
};
