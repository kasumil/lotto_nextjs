interface LatLng {
  getLat: () => number;
  getLng: () => number;
}

interface MapOptions {
  center: LatLng;
  level: number;
}

interface MarkerOptions {
  position: LatLng;
  title?: string;
  image?: MarkerImage;
  map?: KakaoMap;
}

interface MarkerImageOptions {
  src: string;
  size: Size;
}

interface Size {
  width: number;
  height: number;
}

interface InfoWindowOptions {
  content: string;
}

interface MarkerClustererOptions {
  map: KakaoMap;
  averageCenter: boolean;
  minLevel: number;
  gridSize: number;
  calculator: number[];
  styles: MarkerStyle[];
  disableClickZoom: boolean;
  hoverable: boolean;
  zIndex: number;
  maxZoom: number;
}

interface MarkerStyle {
  width: string;
  height: string;
  background: string;
  borderRadius: string;
  color: string;
  textAlign: string;
  fontWeight: string;
  lineHeight: string;
}

declare global {
  interface Window {
    kakao: {
      maps: {
        Map: new (container: HTMLElement, options: MapOptions) => KakaoMap;
        Marker: new (options: MarkerOptions) => KakaoMarker;
        MarkerImage: new (src: string, size: Size) => MarkerImage;
        LatLng: new (lat: number, lng: number) => LatLng;
        InfoWindow: new (options: InfoWindowOptions) => KakaoInfoWindow;
        MarkerClusterer: new (options: MarkerClustererOptions) => KakaoMarkerClusterer;
        Size: new (width: number, height: number) => Size;
        event: {
          addListener: (target: unknown, type: string, handler: () => void) => void;
          removeListener: (target: unknown, type: string, handler: () => void) => void;
        };
        load: (callback: () => void) => void;
      };
    };
  }
}

export interface KakaoMap {
  setCenter: (latlng: LatLng) => void;
  getBounds: () => {
    getSouthWest: () => LatLng;
    getNorthEast: () => LatLng;
  };
  getLevel: () => number;
  setLevel: (level: number) => void;
}

export interface KakaoMarker {
  setMap: (map: KakaoMap | null) => void;
  getPosition: () => LatLng;
}

export interface KakaoInfoWindow {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  close: () => void;
}

export interface KakaoMarkerClusterer {
  addMarkers: (markers: KakaoMarker[]) => void;
  clear: () => void;
}

export interface MarkerImage {
  src: string;
  size: Size;
} 