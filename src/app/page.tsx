'use client';

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useKakaoSdk } from '@/components/KakaoSdkProvider';
import { useKakaoMap } from '@/hooks/useKakaoMap';
import { useLocation } from '@/hooks/useLocation';
import { useSellers } from '@/hooks/useSellers';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useSellerMarkers } from '@/hooks/useSellerMarkers';
import { MapControls } from '@/components/MapControls';
import { SellerPanel } from '@/components/SellerPanel';
import { searchSellers, sellerKey } from '@/lib/seller-search';
import type { LottoSeller } from '@/lib/seller-cache';
import { KakaoMarker } from '@/types/kakao';

const MapComponent = dynamic(() => Promise.resolve(MapPage), {
  ssr: false,
  loading: () => <div>지도를 불러오는 중...</div>
});

function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { ready, error } = useKakaoSdk();
  const { map } = useKakaoMap({ mapRef, location });
  const { sellers, status, retry } = useSellers();
  const [visibleSellers, setVisibleSellers] = useState<LottoSeller[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<LottoSeller | null>(null);
  const [panelOpen, setPanelOpen] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const currentMarker = useRef<KakaoMarker | null>(null);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  }, []);

  const updateCurrentLocationMarker = useCallback((newLocation: { lat: number; lng: number }) => {
    if (!map) return;
    if (currentMarker.current) {
      currentMarker.current.setMap(null);
    }
    const marker = new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(newLocation.lat, newLocation.lng),
      map: map
    });
    currentMarker.current = marker;
  }, [map]);

  const { handleGetCurrentLocation } = useCurrentLocation({
    map,
    updateCurrentLocationMarker
  });

  const handleMarkerSelect = useCallback((seller: LottoSeller) => {
    setSelectedSeller(seller);
    setQuery('');
    setPanelOpen(true);
  }, []);
  const { focusSeller, refreshVisible } = useSellerMarkers({
    map, sellers,
    onSelectSeller: handleMarkerSelect,
    onVisibleSellersChange: setVisibleSellers,
  });
  const results = useMemo(
    () => query.trim() ? searchSellers(sellers, query) : visibleSellers,
    [sellers, query, visibleSellers],
  );
  const shownSellers = useMemo(() => results.slice(0, 100), [results]);

  const handleListSelect = useCallback((seller: LottoSeller) => {
    if (!map) return;
    setSelectedSeller(seller);
    focusSeller(seller);
    if (window.matchMedia('(max-width: 767px)').matches) closePanel();
  }, [map, focusSeller, closePanel]);

  useEffect(() => {
    if (!map) return;
    const frame = requestAnimationFrame(() => {
      map.relayout();
      refreshVisible();
    });
    return () => cancelAnimationFrame(frame);
  }, [map, panelOpen, refreshVisible]);

  // 위치가 변경될 때 마커 업데이트
  useEffect(() => {
    if (map) {
      updateCurrentLocationMarker(location);
    }
  }, [location, map, updateCurrentLocationMarker]);

  return (
      <div className="relative flex h-screen w-screen overflow-hidden">
        <div className="relative z-0 min-w-0 flex-1">
        {!ready && <div role={error ? 'alert' : 'status'} className='absolute inset-0 z-10 flex items-center justify-center bg-white'>{error || '지도를 불러오는 중입니다.'}</div>}
          <div 
            ref={mapRef}
            className='w-full h-full bg-white'
          />
          <MapControls 
            onGetCurrentLocation={handleGetCurrentLocation}
          />
        </div>
        {panelOpen && (
          <SellerPanel
            sellers={shownSellers}
            total={results.length}
            query={query}
            selectedKey={selectedSeller ? sellerKey(selectedSeller) : null}
            status={status}
            mapReady={Boolean(map)}
            onQueryChange={setQuery}
            onSelect={handleListSelect}
            onRetry={retry}
            onClose={closePanel}
          />
        )}
        <button
          ref={toggleRef}
          type="button"
          aria-label={panelOpen ? '판매점 목록 닫기' : '판매점 목록 열기'}
          aria-expanded={panelOpen}
          aria-controls={panelOpen ? 'seller-panel' : undefined}
          onClick={() => panelOpen ? closePanel() : setPanelOpen(true)}
          className="absolute right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-gray-900 shadow-lg hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            {panelOpen
              ? <path d="M5 5l14 14M19 5L5 19" />
              : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>
  );
}

export default MapComponent;
