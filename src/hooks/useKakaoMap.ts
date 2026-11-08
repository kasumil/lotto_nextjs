import { useEffect, useState, RefObject, useRef } from 'react';
import { KakaoMap } from '@/types/kakao';
import { useKakaoSdk } from '@/components/KakaoSdkProvider';

interface UseKakaoMapProps {
  mapRef: RefObject<HTMLDivElement | null>;
  location: {
    lat: number;
    lng: number;
  };
}

export const useKakaoMap = ({ mapRef, location }: UseKakaoMapProps) => {
  const { ready } = useKakaoSdk();
  const [map, setMap] = useState<KakaoMap | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const isInitialLoad = useRef(true);
  const initialLocation = useRef(location);

  useEffect(() => {
    if (!ready || !mapRef?.current) return;

    const loadKakaoMap = () => {
      window.kakao.maps.load(() => {
        const options = {
          center: new window.kakao.maps.LatLng(initialLocation.current.lat, initialLocation.current.lng),
          level: 3,
          draggable: true,
          scrollwheel: true,
          disableDoubleClickZoom: false,
          disableDoubleTapZoom: false,
          keyboardShortcuts: true,
          zoomable: true,
          mapTypeId: window.kakao.maps.MapTypeId.ROADMAP,
          mapTypeControl: true,
          zoomControl: true,
          scaleControl: true
        };

        const newMap = new window.kakao.maps.Map(mapRef.current!, options);
        
        // 지도 컨트롤 추가
        const zoomControl = new window.kakao.maps.ZoomControl();
        newMap.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
        
        setMap(newMap);
        setIsMapLoaded(true);
      });
    };

    loadKakaoMap();
  }, [mapRef, ready]);

  // 초기 위치 설정 (첫 로드시에만)
  useEffect(() => {
    if (!map || !isInitialLoad.current) return;
    
    map.setCenter(new window.kakao.maps.LatLng(location?.lat, location?.lng));
    isInitialLoad.current = false;
  }, [map, location]);

  return { map, isMapLoaded };
}; 