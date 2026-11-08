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

### GitHub Actions / GHCR

- `main`을 대상으로 한 Pull Request는 앱 빌드를 검증합니다.
- `main`에 반영되면 Linux amd64/arm64 이미지를 빌드해 GHCR에 `latest`, 커밋 SHA, Actions 실행 번호 태그를 게시합니다.
- GitHub 저장소의 **Settings → Secrets and variables → Actions → Variables**에 `NEXT_PUBLIC_KAKAO_MAP_API_KEY`를 등록해야 합니다. 이 값은 브라우저에 전달되는 공개 지도 키이므로 비밀 키로 취급하지 않습니다.
- NAS의 기존 컨테이너를 새 이미지로 전환할 때는 `deploy/lotto.compose.fragment.yaml`을 기존 `kasumil-platform` Compose 프로젝트에 포함합니다. 이 서비스는 기존 프로젝트 브리지에 연결되고 NAS의 4100 포트를 유지합니다. 기존 Lotto 컨테이너가 4100 포트를 사용 중이면 Compose 전환 시 기존 컨테이너를 먼저 중단해야 합니다.

### 수동 GHCR 빌드

`./build.sh`는 버전을 1씩 올리고 멀티 플랫폼 이미지를 버전 태그와 `latest` 태그로 함께 게시합니다. 실행 전에 GHCR에 로그인하고 Docker Buildx를 사용할 수 있어야 합니다.

### 기타 배포 방법

Vercel 배포:
```bash
vercel
```

PM2 배포:
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
