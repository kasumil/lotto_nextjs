import { useCallback, useEffect, useRef } from 'react';
import type { KakaoMarker, KakaoInfoWindow, KakaoMap } from '@/types/kakao';
import { MARKER_IMAGE, MARKER_STYLES } from '@/types/marker';
import type { LottoSeller } from '@/hooks/useSellers';
import { sellerKey } from '@/lib/seller-search';

interface UseSellerMarkersProps {
  map: KakaoMap | null;
  sellers: LottoSeller[];
  onSelectSeller: (seller: LottoSeller) => void;
  onVisibleSellersChange: (sellers: LottoSeller[]) => void;
}

export const useSellerMarkers = ({
  map, sellers, onSelectSeller, onVisibleSellersChange,
}: UseSellerMarkersProps) => {
  const onSelectRef = useRef(onSelectSeller);
  const onVisibleRef = useRef(onVisibleSellersChange);
  const focusRef = useRef<(seller: LottoSeller) => void>(() => {});
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    onSelectRef.current = onSelectSeller;
    onVisibleRef.current = onVisibleSellersChange;
  }, [onSelectSeller, onVisibleSellersChange]);

  useEffect(() => {
    if (!map || sellers.length === 0) return;
    const api = window.kakao.maps;
    const markers = new Map<string, { marker: KakaoMarker; onClick: () => void }>();
    let infoWindow: KakaoInfoWindow | null = null;
    let visibleIds = '';
    let pendingSeller: LottoSeller | null = null;
    const markerImage = new api.MarkerImage(MARKER_IMAGE.src,
      new api.Size(MARKER_IMAGE.size.width, MARKER_IMAGE.size.height));
    const clusterer = new api.MarkerClusterer({
      map, averageCenter: true, minLevel: 3, gridSize: 80,
      calculator: [20, 50, 100], styles: MARKER_STYLES,
      disableClickZoom: true, hoverable: false, zIndex: 1, maxZoom: 10,
    });

    const openInfoWindow = (seller: LottoSeller, marker: KakaoMarker) => {
      infoWindow?.close();
      // Seller text is assigned as text before Kakao receives the popup HTML.
      const content = document.createElement('div');
      content.style.cssText = 'padding:5px;font-size:12px;color:#000';
      for (const text of [seller.FIRMNM, seller.BPLCDORODTLADRES, seller.RTLRSTRTELNO]) {
        const line = document.createElement('div');
        line.textContent = text;
        content.appendChild(line);
      }
      infoWindow = new api.InfoWindow({ content: content.outerHTML });
      infoWindow.open(map, marker);
    };

    const updateMarkers = () => {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const south = sw.getLat(), north = ne.getLat(), west = sw.getLng(), east = ne.getLng();
      const visible = sellers.filter((seller) => seller.LATITUDE >= south && seller.LATITUDE <= north &&
        seller.LONGITUDE >= west && seller.LONGITUDE <= east);
      const ids = visible.map(sellerKey);
      const nextIds = JSON.stringify(ids);
      if (visibleIds !== nextIds) {
        visibleIds = nextIds;
        const nextMarkers = visible.map((seller, index) => {
          const id = ids[index];
          const existing = markers.get(id);
          if (existing) return existing.marker;
          const marker = new api.Marker({
            position: new api.LatLng(seller.LATITUDE, seller.LONGITUDE),
            title: seller.FIRMNM, image: markerImage,
          });
          const onClick = () => {
            openInfoWindow(seller, marker);
            onSelectRef.current(seller);
          };
          api.event.addListener(marker, 'click', onClick);
          markers.set(id, { marker, onClick });
          return marker;
        });
        clusterer.clear();
        clusterer.addMarkers(nextMarkers);
        onVisibleRef.current(visible);
      }
      if (pendingSeller && ids.includes(sellerKey(pendingSeller))) {
        const entry = markers.get(sellerKey(pendingSeller));
        if (entry) {
          openInfoWindow(pendingSeller, entry.marker);
          pendingSeller = null;
        }
      }
    };
    focusRef.current = (seller) => {
      pendingSeller = seller;
      map.setCenter(new api.LatLng(seller.LATITUDE, seller.LONGITUDE));
      if (map.getLevel() > 2) map.setLevel(2);
      // idle handles the settled viewport; this also covers repeated selection
      // when the center does not change and idle is not emitted.
      requestAnimationFrame(updateMarkers);
    };
    refreshRef.current = updateMarkers;
    const closeInfoWindow = () => infoWindow?.close();
    updateMarkers();
    // Kakao's idle fires after movement/zoom settles, rather than for every animation frame.
    api.event.addListener(map, 'idle', updateMarkers);
    api.event.addListener(map, 'click', closeInfoWindow);
    return () => {
      focusRef.current = () => {};
      refreshRef.current = () => {};
      api.event.removeListener(map, 'idle', updateMarkers);
      api.event.removeListener(map, 'click', closeInfoWindow);
      infoWindow?.close();
      clusterer.clear();
      for (const { marker, onClick } of markers.values()) {
        api.event.removeListener(marker, 'click', onClick);
        marker.setMap(null);
      }
      markers.clear();
    };
  }, [map, sellers]);

  const focusSeller = useCallback((seller: LottoSeller) => focusRef.current(seller), []);
  const refreshVisible = useCallback(() => refreshRef.current(), []);
  return { focusSeller, refreshVisible };
};
