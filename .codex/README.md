# Lotto Codex 안내 훅과 스킬

`$verify-lotto`는 `.agents/skills/verify-lotto/SKILL.md`를 호출합니다. 기존 AI E2E 스킬은 그대로 유지합니다.

`.codex/hooks.json`은 Codex lifecycle **SessionStart**에 Python 3로 고정 안내만 출력합니다. Git hook이 아니며 자동 테스트·커밋·푸시·배포·승인·네트워크 접근을 하지 않습니다. Git과 Python 3가 필요합니다. 모든 작업을 강제로 병렬 실행하는 보안 장치도 아닙니다.

검사: `python3 -B .codex/check.py`. 설정된 셸 명령 자체를 루트와 하위 폴더에서 실행해 JSON 계약 및 스킬 메타데이터를 검사합니다. 앱 테스트와 실제 SessionStart 활성화는 별도입니다.

로컬 Codex는 프로젝트와 정확한 hook 정의를 신뢰한 경우에 실행합니다. `/hooks` 또는 Settings → Hooks에서 검토하며 신뢰 설정을 자동 변경하지 않습니다. 신규 세션·resume에서 실제 추가 컨텍스트를 확인해야 발동 검증이 완료됩니다. 이 변경에서는 실제 활성화를 검증하지 않았습니다. 클라우드 dot의 모든 작업 시작에 로컬 command hook이 실행되는 것은 아닙니다.

현재 CI는 main push에서 이미지 게시를 수행하므로 이 설정은 feature draft PR까지만 준비합니다. main merge, workflow_dispatch, GHCR publish는 수행하지 않습니다.

참고: https://learn.chatgpt.com/docs/hooks 및 https://learn.chatgpt.com/docs/build-skills
