# Integration validation

Date: 2026-11-12 UTC. Local macOS, Node.js 23.11.0, Playwright 1.65.0 and
existing Chromium. CI uses Node.js 22/Linux and is a separate check.

Application base: `0d3186f6d0f75906e2ba825ef19826ecce658c9a`.
Shared engine identity and revision are retained in ignored private local settings.

## Explicit project commands

- `npm run test:ai:list`: 5 tests discovered in this project's dedicated suite.
- `npm run test:ai`: 5/5 PASS, zero real-model calls. The launcher
  also ignored an inherited `AI_E2E_LIVE_LOCAL=1` as intended.
- Shared runner explicit live mode: 3/3 positive goals PASS with
  8 actual local `qwen3:32b` inference calls. The remaining 2
  negative controls stayed stubbed. Their expected rejection is a test pass.
- Missing wrapper-root configuration fails before test execution.

The common runner was tested without target `node_modules` or a copied
`.ai-e2e-kit` runtime. Installer plan/apply/demo and reviewed rollback also passed
separately; copied runtime files and temporary dependency links were removed.
The project package adapter calls the external, exact-commit shared engine.

## Existing checks

`npm run test:seller-cache`: PASS.
`npm run test:security`: 8/8 PASS.
`bash scripts/test-manual-build.sh`: PASS.
Security/publishing tests use existing mocks; this is not a fresh dependency
audit, image scan or actual publication.

## Observations

No positive goal failed in this run.

JSON telemetry is local under `.ai-e2e-results/` and excluded from Git. Shared
engine code, source helper functions, existing tests, dependency declarations,
lockfile and CI workflows were not changed by this integration. Existing scripts
remain unchanged; only three explicit AI commands were added. Original local
checkouts and their pre-existing edits were preserved using separate worktrees.

This is real source-helper integration through a synthetic browser fixture.
It does not test the full application UI, deployed services, login or real user
sessions. It is one small authored pilot, not a reliability/accuracy benchmark.
No paid API, cloud model, production data, publishing or deployment was used.

The public-safe adapter stores no shared repository URL or private revision in
tracked files. Local settings are required before the documented commands run.
