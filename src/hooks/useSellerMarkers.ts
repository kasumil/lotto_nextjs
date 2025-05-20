import { useState, useRef, useCallback, useEffect } from 'react';
import { KakaoMarker, KakaoInfoWindow, KakaoMarkerClusterer, KakaoMap } from '@/types/kakao';
import { MARKER_IMAGE, MARKER_STYLES } from '@/types/marker';
import { LottoSeller } from '@/hooks/useSellers';

interface UseSellerMarkersProps {
  map: KakaoMap | null;
  sellers: LottoSeller[];
}

export const useSellerMarkers = ({ map, sellers }: UseSellerMarkersProps) => {
  const [sellerMarkers, setSellerMarkers] = useState<KakaoMarker[]>([]);
  const infoWindowRef = useRef<KakaoInfoWindow | null>(null);
  const clustererRef = useRef<KakaoMarkerClusterer | null>(null);
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map());

  const updateSellerMarkers = useCallback(() => {
    if (!map) return;

    // 기존 클러스터러 제거
    if (clustererRef.current) {
      clustererRef.current.clear();
    }

    // 현재 보이는 영역 가져오기
    const bounds = map.getBounds();
    const swLatLng = bounds.getSouthWest();
    const neLatLng = bounds.getNorthEast();

    // 현재 영역에 있는 판매점만 필터링
    const visibleSellers = sellers.filter(seller => {
      const lat = seller.LATITUDE;
      const lng = seller.LONGITUDE;
      return lat >= swLatLng.getLat() && lat <= neLatLng.getLat() &&
             lng >= swLatLng.getLng() && lng <= neLatLng.getLng();
    });

    const newMarkers: KakaoMarker[] = [];

    // 판매점 마커 이미지 설정
    const imageSize = new window.kakao.maps.Size(MARKER_IMAGE.size.width, MARKER_IMAGE.size.height);
    const markerImage = new window.kakao.maps.MarkerImage(MARKER_IMAGE.src, imageSize);

    // 새로운 마커 생성
    visibleSellers.forEach(seller => {
      const markerId = `${seller.LATITUDE}-${seller.LONGITUDE}`;
      
      // 이미 존재하는 마커는 재사용
      if (markersRef.current.has(markerId)) {
        newMarkers.push(markersRef.current.get(markerId)!);
        return;
      }

      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(seller.LATITUDE, seller.LONGITUDE),
        title: seller.FIRMNM,
        image: markerImage
      });

      // 인포윈도우 생성
      const infowindow = new window.kakao.maps.InfoWindow({
        content: `
          <div style="padding:5px;font-size:12px;color:#000;">
            <div style="font-weight:bold;">${seller.FIRMNM}</div>
            <div>${seller.BPLCDORODTLADRES}</div>
            <div>${seller.RTLRSTRTELNO}</div>
          </div>
        `
      });

      // 마커 클릭 이벤트
      window.kakao.maps.event.addListener(marker, 'click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
        }
        infowindow.open(map, marker);
        infoWindowRef.current = infowindow;
      });

      markersRef.current.set(markerId, marker);
      newMarkers.push(marker);
    });

    // 클러스터러 생성 (성능 최적화)
    const clusterer = new window.kakao.maps.MarkerClusterer({
      map: map,
      averageCenter: true,
      minLevel: 3,
      gridSize: 80,
      calculator: [20, 50, 100],
      styles: MARKER_STYLES,
      disableClickZoom: true,
      hoverable: false,
      zIndex: 1,
      maxZoom: 10
    });

    // 클러스터러에 마커 추가
    clusterer.addMarkers(newMarkers);
    clustererRef.current = clusterer;
    setSellerMarkers(newMarkers);
  }, [map, sellers]);

  // 지도 이동/줌 이벤트에 따른 마커 업데이트
  useEffect(() => {
    if (!map) return;

    const updateMarkersOnMapChange = () => {
      updateSellerMarkers();
    };

    window.kakao.maps.event.addListener(map, 'bounds_changed', updateMarkersOnMapChange);
    window.kakao.maps.event.addListener(map, 'zoom_changed', updateMarkersOnMapChange);

    return () => {
      window.kakao.maps.event.removeListener(map, 'bounds_changed', updateMarkersOnMapChange);
      window.kakao.maps.event.removeListener(map, 'zoom_changed', updateMarkersOnMapChange);
    };
  }, [map, updateSellerMarkers]);

  return {
    sellerMarkers,
    updateSellerMarkers
  };
}; 