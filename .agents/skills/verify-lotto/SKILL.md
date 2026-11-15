---
name: verify-lotto
description: Lotto 변경 검증과 병렬 작업 분리, 기존 AI E2E 연결 및 배포 경계를 확인한다.
---

# Lotto 작업 및 검증

1. 작업 시작·재개 시 Git 상태와 관련 지침을 읽고 기존 사용자 변경을 보존한다. 독립 조사·검토는 병렬로 나누되 같은 파일 수정, 빌드 산출물, 배포는 직렬화한다. 상태가 불확실하면 반복 실행 전 확인한다.
2. Node 22 및 lockfile 기준 의존성이 준비되면 `npm run test:security`, `npm run lint`, `npm run test:seller-cache`, `bash scripts/test-manual-build.sh`를 실행한다. 의존성 취약점은 `npm run security:audit`로 별도 확인한다. 설치는 공식 레지스트리와 lockfile을 사용한다.
3. `npm run build`는 prebuild에서 판매점 데이터를 생성하므로 동일 작업폴더에서 dev/build를 동시에 돌리지 않는다. 네트워크·로컬 설정 부족은 실패와 구분해 보고한다.
4. AI E2E는 기존 `.agents/skills/ai-e2e/SKILL.md`를 따른다. `--list`도 코드를 import/실행할 수 있다. 검토되지 않은 wrapper를 실행하지 않고, stub 통과를 실제 모델·운영 검증으로 표현하지 않는다. 무거운 로컬 모델 실행은 중복하지 않는다.
5. 브라우저 작업 실패 시 실제 화면의 경고·모달·권한 상태를 확인하고 콘솔/네트워크 결과와 대조한다. 관찰과 경고 우회 승인은 별개다.
6. 실제 실행한 명령·결과·미실행 범위를 기록한다. 문서 변경은 기존 내부 위키 동기화 절차로 반영하되 비밀값을 제외하고 저장을 확인한다.
7. main push 또는 workflow_dispatch는 이미지 게시를 유발할 수 있다. 이 스킬은 자동 승인·배포 권한이 아니다. 별도 feature branch와 draft PR만 준비하며 사용자 지시 없이 병합·게시·신뢰 설정을 변경하지 않는다.
