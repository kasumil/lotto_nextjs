import { NextConfig } from 'next';

const config: NextConfig = {
  async headers() {
    return [{
      source: "/lotto-sellers-map.json",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
    }];
  },
  images: {
    domains: ['dapi.kakao.com'],
  },
}

export default config;
