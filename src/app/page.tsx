'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';
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
  const { map } = useKakaoMap({ mapRef, location });
  const sellers = useSellers();
  const [currentMarker, setCurrentMarker] = useState<KakaoMarker | null>(null);


  const updateCurrentLocationMarker = useCallback((newLocation: { lat: number; lng: number }) => {
    if (!map) return;
    if (currentMarker) {
      currentMarker.setMap(null);
    }
    const marker = new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(newLocation.lat, newLocation.lng),
      map: map
    });
    setCurrentMarker(marker);
  }, [map, currentMarker]);

  const { handleGetCurrentLocation } = useCurrentLocation({
    map,
    updateCurrentLocationMarker
  });

  const { updateSellerMarkers } = useSellerMarkers({
    map,
    sellers
  });

  // 위치가 변경될 때 마커 업데이트
  useEffect(() => {
    if (map) {
      updateCurrentLocationMarker(location);
    }
  }, [location, map, updateCurrentLocationMarker]);

  // 판매점 마커 업데이트
  useEffect(() => {
    updateSellerMarkers();
  }, [map, sellers, updateSellerMarkers]);

  return (
    <>
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services,clusterer`}
        strategy="lazyOnload"
      />
      <div className='w-screen h-screen relative'>
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
