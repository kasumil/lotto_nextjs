# 로또 판매점 지도

내 주변 로또 판매점을 찾을 수 있는 지도 서비스입니다.

## 주요 기능

- 현재 위치 기반 로또 판매점 검색
- 판매점 클러스터링으로 효율적인 마커 표시
- 판매점 정보 인포윈도우 표시
- 반응형 디자인

## 기술 스택

- Next.js 16.4.1
- TypeScript
- Kakao Maps API
- Tailwind CSS
- Node.js 직접 실행 (Docker 프로덕션 런타임)

## 시작하기

### 개발 환경 설정

1. 저장소 클론
```bash
git clone [repository-url]
cd lotto_nextjs
```

2. 의존성 설치
```bash
npm ci
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

### 로컬 프로덕션 확인

```bash
npm run build
npm run start -- --port 4100
```

Docker 이미지는 비특권 Node 사용자로 Next.js를 직접 실행합니다. 전역 PM2 설치나 PM2 배포 명령은 현재 이미지 경로에 필요하지 않습니다.

## 배포

- PR은 앱·의존성·두 아키텍처 이미지 검사를 실행하며 이미지를 게시하지 않습니다.
- `main`은 모든 검사를 통과한 **동일 이미지 아카이브**를 GHCR에 커밋 SHA, 실행 번호, `latest`로 게시합니다. 다시 빌드한 미검사 이미지를 게시하지 않습니다.
- 수동 `bash build.sh`는 검사한 이미지의 새 버전 태그만 게시합니다. `latest`는 변경하지 않으며 게시 성공 뒤에만 버전 파일을 갱신합니다. publisher는 동시에 실행하지 않습니다.
- 지도용 JavaScript 키는 실행 시 `NEXT_PUBLIC_KAKAO_MAP_API_KEY`로 전달합니다. 빌드용 Actions 변수를 요구하지 않습니다.
- 실제 설치·전환 전에는 [배포 및 Compose 전환 검토](docs/deployment.md)와 [보안 검사](docs/security.md)를 확인하세요. `latest` 감시가 활성화된 환경에서는 main 게시가 운영 재시작으로 이어질 수 있습니다.

## 라이선스

MIT License

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## 보안 패치 및 GHCR 배포

- Next.js 16.4.1, React 19.2.6과 Node 22 기반 이미지를 사용합니다.
- `npm ci`, `npm run lint`, `npm run build`, `npm audit --omit=dev`로 검증합니다.
- 지도 키는 Docker 실행 시 환경변수로 주입합니다. `NEXT_PUBLIC_KAKAO_MAP_API_KEY`에 지정된 Kakao Maps JavaScript 키만 서버에서 읽습니다. 일반 앱 키 이름이나 REST API·Admin·네이티브 키로 자동 대체하지 않습니다. 기존 다른 이름의 값은 Kakao Maps용 JavaScript 키인지 확인한 뒤 이 지도 전용 변수에 매핑합니다. 빌드할 때 키를 넣거나 GitHub Actions 변수를 새로 만들 필요가 없습니다. 공개 브라우저 키이므로 Kakao에서 서비스 도메인 제한을 설정하고 실제 값을 저장소에 기록하지 않습니다. SDK는 한 번만 로드하고 준비된 뒤 지도를 생성합니다.
- main 반영 후 GHCR에 latest 및 커밋 SHA 태그를 게시합니다. NAS가 이전 고정 태그 `1.0.13`을 사용하면 latest 이미지 게시만으로 갱신되지 않습니다. 검증된 새 SHA/digest로 전환하고 실제 컨테이너 버전을 확인해야 합니다.
- 런타임은 비특권 node 사용자로 4100 포트에서 직접 Next.js를 실행하며 개발 의존성과 전역 PM2를 이미지에 포함하지 않습니다.
- 개발용 TypeScript ESLint 경로의 minimatch는 보안 패치 11.0.1로 제한 교체했습니다. `npm run security:audit`가 전체/운영 lockfile을 모두 검사하고 Low 이상 또는 검사 오류가 있으면 실패합니다.
- Docker 런타임은 npm/npx/yarn을 제거하고 zlib 보안 패치를 적용합니다. CI와 수동 `build.sh`는 amd64/arm64의 실제 이미지 아카이브를 Trivy로 검사하고, 모든 심각도의 CVE가 0개일 때만 동일 아카이브를 게시합니다. 자세한 절차와 한계는 [보안 검사](docs/security.md)를 참고하세요.


## 공개 판매점 데이터 캐시

- 원본 `public/lotto_sellers.json`이 유일한 관리 데이터입니다. 빌드/개발 시작 시 지도에 필요한 필드만 가진 `public/lotto-sellers-map.json`을 자동 생성합니다. 생성 파일은 커밋하지 않습니다.
- 데이터는 배포에 포함되는 공개 정적 목록이므로 HTTP 캐시와 브라우저 메모리 캐시에 1시간 TTL을 적용합니다. 같은 탭에서 동시에 읽으면 진행 중인 요청을 공유하고, TTL 이후 다음 읽기에서 다시 요청하며 HTTP 캐시도 재검증해 두 캐시의 유효기간이 누적되지 않게 합니다. 데이터 변경 배포 직후에도 브라우저에서 최대 1시간 이전 목록이 보일 수 있습니다.
- 실패 응답은 캐시하지 않습니다. 로그인·토큰·개인 위치는 이 캐시에 저장하지 않습니다.
- 지도 이동/줌이 끝나는 `idle` 이벤트에서 마커를 갱신합니다. 클러스터 인스턴스와 이미 생성된 마커를 재사용하며 같은 판매점 집합이면 다시 그리지 않습니다. 팝업은 마커 클릭 시 생성합니다.
- `npm run test:seller-cache`는 동시 요청 중복 방지, TTL 경계, 실패/잘못된 응답 후 복구를 확인합니다.
