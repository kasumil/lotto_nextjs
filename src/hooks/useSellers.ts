import { useEffect, useState } from 'react';

export interface LottoSeller {
  BPLCDORODTLADRES: string;
  FIRMNM: string;
  LATITUDE: number;
  LONGITUDE: number;
  RTLRSTRTELNO: string;
}

export const useSellers = () => {
  const [sellers, setSellers] = useState<LottoSeller[]>([]);

  useEffect(() => {
    fetch('/lotto_sellers.json')
      .then(res => res.json())
      .then(data => setSellers(data))
      .catch(error => console.error('판매점 데이터 로드 실패:', error));
  }, []);

  return sellers;
}; 