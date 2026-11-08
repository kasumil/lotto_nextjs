# 로또 판매점 지도

내 주변 로또 판매점을 찾을 수 있는 지도 서비스입니다.

## 주요 기능

- 현재 위치 기반 로또 판매점 검색
- 판매점 클러스터링으로 효율적인 마커 표시
- 판매점 정보 인포윈도우 표시
- 반응형 디자인

## 기술 스택

- Next.js 14
- TypeScript
- Kakao Maps API
- Tailwind CSS
- PM2 (프로덕션 환경)

## 시작하기

### 개발 환경 설정

1. 저장소 클론
```bash
git clone [repository-url]
cd lotto_nextjs
```

2. 의존성 설치
```bash
npm install
```

3. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 내용을 추가합니다:
```
NEXT_PUBLIC_KAKAO_MAP_API_KEY=your_kakao_map_api_key
```

4. 개발 서버 실행
```bash
npm run dev
```

### 프로덕션 환경 설정

1. 빌드
```bash
npm run build
```

2. PM2로 실행
```bash
pm2 start ecosystem.config.js
```

## 배포

1. Vercel 배포
```bash
vercel
```

2. PM2 배포
```bash
pm2 deploy ecosystem.config.js production
```

## 라이선스

MIT License

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


docker buildx build --platform=linux/amd64,linux/arm64 -t ghcr.io/kasumil/lotto-nextjs:1.0.0 .

## 보안 패치 및 GHCR 배포

- Next.js 16.4.1, React 19.2.6과 Node 22 기반 이미지를 사용합니다.
- `npm ci`, `npm run lint`, `npm run build`, `npm audit --omit=dev`로 검증합니다.
- 지도 키는 Docker 실행 시 환경변수로 주입합니다. `NEXT_PUBLIC_KAKAO_MAP_API_KEY`에 지정된 Kakao Maps JavaScript 키만 서버에서 읽습니다. 일반 앱 키 이름이나 REST API·Admin·네이티브 키로 자동 대체하지 않습니다. 기존 다른 이름의 값은 Kakao Maps용 JavaScript 키인지 확인한 뒤 이 지도 전용 변수에 매핑합니다. 빌드할 때 키를 넣거나 GitHub Actions 변수를 새로 만들 필요가 없습니다. 공개 브라우저 키이므로 Kakao에서 서비스 도메인 제한을 설정하고 실제 값을 저장소에 기록하지 않습니다. SDK는 한 번만 로드하고 준비된 뒤 지도를 생성합니다.
- main 반영 후 GHCR에 latest 및 커밋 SHA 태그를 게시합니다. NAS가 이전 고정 태그 `1.0.13`을 사용하면 latest 이미지 게시만으로 갱신되지 않습니다. 검증된 새 SHA/digest로 전환하고 실제 컨테이너 버전을 확인해야 합니다.
- 런타임은 비특권 node 사용자로 4100 포트에서 직접 Next.js를 실행하며 개발 의존성과 전역 PM2를 이미지에 포함하지 않습니다.
- 개발 의존성 minimatch 관련 moderate 경고는 별도로 남을 수 있습니다. 운영 의존성 0개 결과가 NAS 운영체제나 실제 침해 여부까지 보장하지는 않습니다.
