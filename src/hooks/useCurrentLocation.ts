import { useState, useCallback } from 'react';
import { KakaoMarker, KakaoMap } from '@/types/kakao';

interface UseCurrentLocationProps {
  map: KakaoMap | null;
  updateCurrentLocationMarker: (location: { lat: number; lng: number }) => void;
}

export const useCurrentLocation = ({ map, updateCurrentLocationMarker }: UseCurrentLocationProps) => {
  const [currentMarker, setCurrentMarker] = useState<KakaoMarker | null>(null);

  const handleGetCurrentLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      alert('이 브라우저에서는 위치 정보를 사용할 수 없습니다.');
      return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
      if (permissionStatus.state === 'denied') {
        alert('위치 정보 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        return;
      }

      if (permissionStatus.state === 'prompt') {
        alert('위치 정보 접근 권한이 필요합니다. 권한 요청 창이 표시됩니다.');
      }

      navigator.geolocation.getCurrentPosition(
        async(position) => {
          const newLocation = { 
            lat: position.coords.latitude, 
            lng: position.coords.longitude
          };
          updateCurrentLocationMarker(newLocation);
          if (map) {
            map.setCenter(new window.kakao.maps.LatLng(newLocation.lat, newLocation.lng));
          }
        },
        (error) => {
          if (permissionStatus.state === 'granted') return;

          switch(error.code) {
            case error.PERMISSION_DENIED:
              alert('위치 정보 접근 권한이 거부되었습니다.');
              break;
            case error.POSITION_UNAVAILABLE:
              alert('위치 정보를 사용할 수 없습니다.');
              break;
            case error.TIMEOUT:
              alert('위치 정보 요청 시간이 초과되었습니다.');
              break;
            default:
              alert('위치 정보를 가져오는 중 오류가 발생했습니다.');
              break;
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });
  }, [map, updateCurrentLocationMarker]);

  return {
    currentMarker,
    setCurrentMarker,
    handleGetCurrentLocation
  };
}; 