import { useEffect, useRef } from 'react';
import type { LottoSeller } from '@/lib/seller-cache';
import { sellerKey } from '@/lib/seller-search';

interface SellerPanelProps {
  sellers: LottoSeller[];
  total: number;
  query: string;
  selectedKey: string | null;
  status: 'loading' | 'ready' | 'error';
  mapReady: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (seller: LottoSeller) => void;
  onRetry: () => void;
  onClose: () => void;
}

export function SellerPanel({
  sellers, total, query, selectedKey, status, mapReady,
  onQueryChange, onSelect, onRetry, onClose,
}: SellerPanelProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest' }); }, [selectedKey, sellers]);

  return (
    <aside
      id="seller-panel"
      aria-label="로또 판매점 목록"
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
      className="absolute inset-y-0 right-0 z-40 flex w-full flex-col bg-white text-gray-900 shadow-2xl md:relative md:inset-auto md:w-96"
    >
      <div className="border-b border-gray-200 px-5 pb-4 pt-5 pr-16">
        <h2 className="text-lg font-bold">판매점 찾기</h2>
        <form role="search" onSubmit={(event) => event.preventDefault()} className="mt-4">
          <label htmlFor="seller-search" className="sr-only">매장 이름 또는 주소 검색</label>
          <div className="flex gap-2">
            <input
              ref={searchRef}
              id="seller-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="매장 이름 또는 주소 검색"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
            {query && (
              <button
                type="button"
                onClick={() => { onQueryChange(''); searchRef.current?.focus(); }}
                className="rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="검색 초기화"
              >초기화</button>
            )}
          </div>
        </form>
        {status === 'ready' && (
          <p className="mt-3 text-sm text-gray-600" aria-live="polite">
            {query.trim() ? '검색 결과' : '현재 지도'} {total.toLocaleString('ko-KR')}곳
            {total > sellers.length ? ` · 처음 ${sellers.length}곳 표시` : ''}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {status === 'loading' && <p role="status" className="p-3 text-sm">판매점 목록을 불러오는 중입니다.</p>}
        {status === 'error' && (
          <div role="alert" className="p-3 text-sm">
            <p>판매점 목록을 불러오지 못했습니다.</p>
            <button type="button" onClick={onRetry}
              className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-blue-600">
              다시 시도
            </button>
          </div>
        )}
        {status === 'ready' && total === 0 && (
          <p role="status" className="p-3 text-sm text-gray-600">
            {query.trim() ? '검색 결과가 없습니다. 이름이나 주소를 다시 입력해 주세요.' : '현재 지도에 표시할 판매점이 없습니다.'}
          </p>
        )}
        {status === 'ready' && sellers.length > 0 && (
          <ul className="space-y-1" aria-label="판매점 검색 결과">
            {sellers.map((seller) => {
              const key = sellerKey(seller);
              const selected = key === selectedKey;
              return (
                <li key={key}>
                  <button
                    ref={selected ? selectedRef : undefined}
                    type="button"
                    disabled={!mapReady}
                    onClick={() => onSelect(seller)}
                    aria-pressed={selected}
                    aria-label={`${seller.FIRMNM}, ${seller.BPLCDORODTLADRES}, 지도에서 보기`}
                    className={`w-full rounded-lg border p-3 text-left focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 ${selected ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:bg-gray-100'}`}
                  >
                    <span className="block font-semibold">{seller.FIRMNM}</span>
                    <span className="mt-1 block text-sm text-gray-600">{seller.BPLCDORODTLADRES}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
