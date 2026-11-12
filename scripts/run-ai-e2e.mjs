// Thin project adapter; the engine and Playwright remain in a separate checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = fileURLToPath(new URL('../', import.meta.url));
const flags = process.argv.slice(2);
if (flags.some(flag => !['--live-local', '--list'].includes(flag)) || new Set(flags).size !== flags.length) {
  throw new Error('Usage: npm run test:ai [-- --list|--live-local]');
}
const local = JSON.parse(await fs.readFile(new URL('../.ai-e2e.local.json', import.meta.url), 'utf8').catch(() => { throw new Error('Create ignored .ai-e2e.local.json using separately supplied reviewed settings. See tests-ai/SETUP.md.'); }));
if (!local || typeof local.packageName !== 'string' || !/^[0-9a-f]{40}$/.test(local.revision)) throw new Error('Local packageName and exact reviewed revision are required.');
const configured = process.env.AI_E2E_WRAPPER_ROOT || local.wrapperRoot;
if (!configured || !path.isAbsolute(configured)) {
  throw new Error('Set a trusted absolute wrapperRoot in .ai-e2e.local.json or AI_E2E_WRAPPER_ROOT. See tests-ai/SETUP.md.');
}
const root = await fs.realpath(configured);
const lock = local;
const packageInfo = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
if (packageInfo.name !== local.packageName) throw new Error('Unexpected shared wrapper package');
const revision = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
if (revision.status !== 0 || revision.stdout.trim() !== lock.revision) {
  throw new Error(`Wrapper revision mismatch. Review and check out ${lock.revision}; do not auto-update the engine.`);
}
const clean = spawnSync('git', ['-C', root, 'diff', '--exit-code', 'HEAD', '--', 'bin', 'runtime', 'installer', 'templates', 'package.json', 'package-lock.json'], { stdio: 'ignore' });
if (clean.status !== 0) throw new Error('Shared wrapper tracked executable files were edited; review them before use.');
const result = spawnSync(process.execPath, [path.join(root, 'bin/run-project.mjs'), '--project', project, ...flags], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
