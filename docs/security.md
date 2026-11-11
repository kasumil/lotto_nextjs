# CVE 검사와 이미지 게시

## 검사 기준

- `npm run security:audit`: lockfile의 전체 의존성과 운영 의존성을 각각 검사합니다. Low/Moderate/High/Critical 또는 registry 오류, 비정상 종료, 잘못된 JSON은 실패입니다.
- `npm run test:security`: 검사 오류, 각 심각도, 잘못된 아키텍처, 누락된 OS/앱 검사, 아카이브 변경을 차단하는 회귀 테스트입니다.
- `bash scripts/test-manual-build.sh`: 전체 의존성 검사와 두 아키텍처 검사 및 게시 실패가 버전 파일이나 다음 게시 단계로 넘어가지 않는지 검사합니다.
- Trivy 0.76.2는 공식 릴리스 설치 Action의 고정 commit으로 설치합니다. DB는 기본 자동 업데이트를 사용하며 업데이트 실패를 성공으로 취급하지 않습니다. UNKNOWN/LOW/MEDIUM/HIGH/CRITICAL, 수정 버전 없는 CVE도 모두 보고하고 모두 게시 차단 대상입니다. ignore 파일은 사용하지 않습니다.
- OS 패키지와 /app의 Next 패키지가 실제 검사된 보고서만 인정합니다. 앱 package-lock만 검사해서 전역 npm이나 OS 라이브러리를 놓치는 것을 방지합니다.

## 런타임 수정

공식 Node 22.23.4 Alpine multi-platform digest를 고정했습니다. 빌드 단계의 npm은 유지하고 런타임 npm/npx/yarn은 제거했습니다. 런타임은 Node로 직접 시작하므로 실행 방식은 바뀌지 않습니다. zlib는 공식 Alpine 저장소의 보안 수정으로 업데이트됩니다. TypeScript ESLint 하위 minimatch에만 11.0.1 override를 적용하며 다른 minimatch3 경로는 강제 major-upgrade하지 않습니다.

## CI 게시 순서

1. 앱 빌드/린트/캐시 테스트와 전체·운영 의존성 검사를 수행합니다.
2. linux/amd64와 linux/arm64 이미지를 각각 빌드하여 Docker 아카이브로 저장합니다. 아직 레지스트리에 게시하지 않습니다.
3. 해당 아카이브의 전체 CVE를 검사하고 스캔 보고서, SHA256, config/manifest ID를 기록합니다.
4. main에서만 모든 선행 job 성공 후 아카이브를 내려받습니다. 두 아카이브를 다시 검증하고 로드한 image ID까지 비교합니다. 이미지를 재빌드하지 않습니다.
5. 검사한 아키텍처 이미지를 고유 후보 태그로 게시합니다. 반환된 immutable digest의 raw manifest SHA256과 config digest를 로컬 검사 아카이브와 대조하여 다른 이미지·플랫폼이 승격되지 않게 합니다.
6. 두 개의 서로 다른 플랫폼 digest를 임시 multi-platform index로 만들고, index가 정확히 linux/amd64와 linux/arm64의 검증된 digest만 가리키는지 확인합니다. 검증한 index를 재빌드 없이 커밋 SHA, 실행 번호, latest로 복사하고 각 최종 태그의 digest도 다시 확인합니다.

PR은 이미지를 검사하지만 GHCR 쓰기 권한이 없고 게시 job도 실행하지 않습니다. 전체 JSON 보고서는 실패 시에도 14일 보관합니다. 대용량 아카이브는 게시에 필요한 1일만 보관합니다.

## 수동 게시

`build.sh`는 npm/Node, Python3.11 이상, Docker Buildx, Trivy0.76.2와 GHCR 로그인이 준비된 Mac/Linux에서 실행합니다. 검사한 두 아키텍처의 이미지로 버전 태그만 게시하며 latest를 수정하지 않습니다. 모든 단계가 성공한 뒤에만 version.txt를 올립니다. 동시에 여러 publisher를 실행하지 않습니다. 이미지 레지스트리 인증은 기존 로그인 방법을 사용하며 저장소에 비밀값을 기록하지 않습니다.

## 운영 주의와 한계

현재 운영의 Watchtower가 latest를 감시하는 동안 main/latest 게시가 자동 재시작으로 이어질 수 있습니다. 보안 수정 브랜치 준비와 실제 운영 게시를 구분하고 교체 작업 담당자와 조율해야 합니다.

스캐너 결과는 패키지 버전과 공개 취약성 DB의 일치 여부입니다. 0개는 미공개 취약점이나 NAS DSM·커널·다른 서비스의 안전을 보장하지 않습니다. 고정한 베이스 digest와 Trivy 버전은 정기적으로 갱신해야 하며, 나중에 새 CVE가 공개되면 같은 소스의 빌드도 의도적으로 차단될 수 있습니다.
