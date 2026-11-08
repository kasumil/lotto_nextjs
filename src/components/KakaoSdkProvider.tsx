"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Script from "next/script";

const KakaoSdkContext = createContext({ ready: false, error: "" });

export function useKakaoSdk() {
  return useContext(KakaoSdkContext);
}

export function KakaoSdkProvider({ appKey, children }: { appKey?: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const error = appKey ? loadError : "지도 설정을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.";

  return (
    <KakaoSdkContext.Provider value={{ ready, error }}>
      {appKey && (
        <Script
          id="kakao-maps-sdk"
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services,clusterer`}
          strategy="afterInteractive"
          onReady={() => {
            if (!window.kakao?.maps?.load) {
              setLoadError("지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
              return;
            }
            window.kakao.maps.load(() => setReady(true));
          }}
          onError={() => setLoadError("지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")}
        />
      )}
      {children}
    </KakaoSdkContext.Provider>
  );
}
