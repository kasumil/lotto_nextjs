'use client';

import { useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useKakaoSdk } from '@/components/KakaoSdkProvider';
import { useKakaoMap } from '@/hooks/useKakaoMap';
import { useLocation } from '@/hooks/useLocation';
import { useSellers } from '@/hooks/useSellers';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useSellerMarkers } from '@/hooks/useSellerMarkers';
import { MapControls } from '@/components/MapControls';
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
  const sellers = useSellers();
  const currentMarker = useRef<KakaoMarker | null>(null);


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

  useSellerMarkers({
    map,
    sellers
  });

  // 위치가 변경될 때 마커 업데이트
  useEffect(() => {
    if (map) {
      updateCurrentLocationMarker(location);
    }
  }, [location, map, updateCurrentLocationMarker]);

  return (
    <>
      <div className='w-screen h-screen relative'>
        {!ready && <div role={error ? 'alert' : 'status'} className='absolute inset-0 z-10 flex items-center justify-center bg-white'>{error || '지도를 불러오는 중입니다.'}</div>}
        <>
          <div 
            ref={mapRef}
            className='w-full h-full bg-white'
          />
          <MapControls 
            onGetCurrentLocation={handleGetCurrentLocation}
          />
        </>
      </div>
    </>
  );
}

export default MapComponent;
