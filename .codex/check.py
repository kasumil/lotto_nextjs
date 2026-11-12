"""Validate repository skill and invoke its context-only Codex hook without writes."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
config = json.loads((root / ".codex/hooks.json").read_text())
handlers = config["hooks"]["SessionStart"][0]["hooks"]
assert len(handlers) == 1 and handlers[0]["type"] == "command"
command = handlers[0]["command"]
assert command == 'python3 -B "$(git rev-parse --show-toplevel)/.codex/hooks/session_start.py"'
assert config["hooks"].keys() == {"SessionStart"}
assert handlers[0]["timeout"] == 5
assert handlers[0].get("async", False) is False
assert not any(key in handlers[0] for key in ("prompt", "agent", "mcp_tool"))
for cwd in (root, root / ".codex"):
    result = subprocess.run(["/bin/sh", "-c", command], cwd=cwd, input='{"hook_event_name":"SessionStart"}', text=True, capture_output=True, timeout=10, check=True)
    output = json.loads(result.stdout)["hookSpecificOutput"]
    assert output["hookEventName"] == "SessionStart"
    assert ".agents/skills/verify-lotto/SKILL.md" in output["additionalContext"]
    assert "실행 승인을 뜻하지 않습니다" in output["additionalContext"]
    assert not result.stderr
skills = list((root / ".agents/skills").glob("*/SKILL.md"))
assert skills
for path in skills:
    text = path.read_text()
    assert text.startswith("---\n") and "\nname: " in text and "\ndescription: " in text
subprocess.run(["git", "diff", "--check"], cwd=root, check=True)
print("PASS: skill metadata, hook contract, exact configured command from root/nested cwd, and diff whitespace. Native SessionStart activation and application tests remain separate checks.")
