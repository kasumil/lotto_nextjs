import { useEffect, useState, RefObject } from 'react';
import { KakaoMap } from '@/types/kakao';

interface UseKakaoMapProps {
  mapRef: RefObject<HTMLDivElement | null>;
  location: {
    lat: number;
    lng: number;
  };
}

export const useKakaoMap = ({ mapRef, location }: UseKakaoMapProps) => {
  const [map, setMap] = useState<KakaoMap | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    const loadKakaoMap = () => {
      window.kakao.maps.load(() => {
        const options = {
          center: new window.kakao.maps.LatLng(location.lat, location.lng),
          level: 3
        };

        const newMap = new window.kakao.maps.Map(mapRef.current!, options);
        setMap(newMap);
        setIsMapLoaded(true);
      });
    };

    loadKakaoMap();
  }, [mapRef, location]);

  return { map, isMapLoaded };
}; 