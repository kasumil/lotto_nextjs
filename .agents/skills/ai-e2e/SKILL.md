---
name: project-ai-e2e
description: 판매점 캐시 동시 요청, TTL 경계, 실패/잘못된 응답 후 재시도 변경 후 공통 AI E2E runner를 이 프로젝트의 명시적 테스트 명령으로 실행하고 결과를 구분해 보고한다.
---

# 프로젝트 공통 AI E2E 호출

1. `tests-ai/SETUP.md`, `tests-ai/README.md`, Git에서 제외된 `.ai-e2e.local.json`을 읽는다.
2. `.ai-e2e.local.json`의 packageName, revision, wrapperRoot가 별도로 전달된 검토 결과와 일치하는지 확인한다. `AI_E2E_WRAPPER_ROOT`로 경로만 재지정할 수 있다. 설치나 버전 변경은 자동으로 하지 않는다. 경로/의존성/브라우저가 없으면 정확한 준비 명령을 안내한다.
3. `npm run test:ai:list`로 이 프로젝트의 테스트 목록을 확인하고 `npm run test:ai`로 기본 stub 통합 검증을 실행한다. 프로젝트 helper 또는 goal/assertion 수정 뒤 기존 결정론적 테스트도 함께 실행한다. 독립적인 검사는 안전한 범위에서 병렬로 진행한다.
4. 사용자가 로컬 AI 추론을 요청한 경우에만 `npm run test:ai:live`를 실행한다. 이미 설치된 로컬 `qwen3:32b`와 합성 데이터만 사용한다. live 실행을 병렬로 중복 시작하지 않는다. 비밀값, 로그인 세션, 운영 페이지는 전달하지 않는다.
5. `.ai-e2e-results/results.json`과 goal evidence를 확인한다. 실제 프로젝트 소스를 썼는지, 합성 fixture인지, stub/local-model인지, pass/fail/skipped와 실제 모델 호출 수를 구분한다. 모델이 완료를 선언해도 독립 oracle이 실패하면 성공이라고 보고하지 않는다.
6. 기존 앱 소스, CI, 운영 데이터, 로그인/배포 흐름은 이 스킬이 변경할 권한을 주지 않는다. 기존 E2E를 AI 테스트로 자동 변환하거나 대체하지 않는다.

기본 테스트 대상: 판매점 캐시 동시 요청, TTL 경계, 실패/잘못된 응답 후 재시도.
각 helper를 합성 브라우저에서 검증하며 운영 UI 전체를 검증한 것이 아니다.
공통 엔진 수정은 wrapper 저장소에서 하고 프로젝트에는 goal/assertion과 호출 설정만 유지한다.
