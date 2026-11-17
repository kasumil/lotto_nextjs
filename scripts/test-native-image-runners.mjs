import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
const workflow = readFileSync(new URL('../.github/workflows/build-publish-ghcr.yml', import.meta.url), 'utf8');
const job = workflow.split('  image-security:')[1].split('  publish:')[0];
test('both native runners are explicit and bounded, without emulation', () => {
  assert.match(job, /runs-on: \$\{\{ matrix.runner \}\}/);
  assert.match(job, /timeout-minutes: 20/);
  assert.match(job, /arch: amd64\n +runner: ubuntu-24.04\n/);
  assert.match(job, /arch: arm64\n +runner: ubuntu-24.04-arm\n/);
  assert.doesNotMatch(job, /uses: docker\/setup-qemu-action/);
});
test('native guard accepts matching hosts and rejects cross-architecture hosts', () => {
  const guard = job.match(/          case "\$ARCH:\$\(uname -m\)" in[\s\S]*?          esac/)[0];
  for (const [arch, host, status] of [['amd64','x86_64',0],['arm64','aarch64',0],['arm64','x86_64',1],['amd64','aarch64',1]]) {
    const script = `uname() { printf '%s' '${host}'; };\n${guard}`;
    assert.equal(spawnSync('bash', ['-c', script], {env:{...process.env, ARCH:arch}}).status, status);
  }
});
test('both platforms retain full CVE scan, artifact transfer and publication gates', () => {
  assert.match(job, /bash scripts\/build-scan-image.sh/);
  assert.match(job, /image-security-\$\{\{ matrix.arch \}\}/);
  assert.match(job, /scanned-release-\$\{\{ matrix.arch \}\}/);
  assert.match(workflow, /needs: \[scope, verify, image-security\]/);
  assert.match(workflow, /github.event_name != 'pull_request'/);
});
