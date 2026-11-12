# Shared AI E2E integration

This public project contains its own adapter, goals and independent assertions.
The shared engine is obtained separately by an authorized user. Its repository
location, package identity and reviewed revision are intentionally not stored in
this public repository. Never add internal repository URLs, access tokens,
private revisions or machine paths to committed files or PR descriptions.

## Local setup

1. Use Node.js 22.13+ (Node 22.23.4 recommended), Git, and an authorized shared
   engine checkout containing bin/run-project.mjs and its installed Playwright.
2. Obtain the engine package name and reviewed 40-character Git revision through
   the approved private channel. Check out and verify that revision separately.
3. Follow that engine's reviewed instructions to install its dependencies and
   Chromium when needed. This project never downloads or installs anything.
4. Create the ignored project-root `.ai-e2e.local.json` file with those values:

```json
{
  "wrapperRoot": "/absolute/path/to/reviewed-engine",
  "packageName": "<privately supplied package name>",
  "revision": "<privately supplied 40-character Git revision>"
}
```

Do not commit this local file. The adapter requires all values and rejects a
different engine revision or edited tracked executable files. Setting
AI_E2E_WRAPPER_ROOT overrides only wrapperRoot, not the identity/revision checks.

```sh
npm run test:ai:list
npm run test:ai
```

These dedicated tests need no additional project dependencies. Default inference
is a deterministic stub; it validates actual seller-cache source with synthetic
data in an offline browser, not production UI or model accuracy. See README.md.

`npm run test:ai:live` explicitly uses an already installed local `qwen3:32b`.
It can require roughly 20 GiB for weights plus working memory. It does not start
a server, download a model, accept cloud aliases, or fall back to a paid API.
Only synthetic DOM goes to literal loopback. Negative controls remain stubbed.

Keep results in ignored `.ai-e2e-results/`. Do not upload arbitrary real pages,
credentials, production sessions or raw local reports. Existing release checks
remain mandatory:

```sh
npm run test:seller-cache
npm run test:security
bash scripts/test-manual-build.sh
```

No CI workflow is added or changed. The engine must be reviewed and tested before
updating the private local pin. This is reproducibility protection, not a sandbox
for hostile local code. The optional copied installer runtime is not used.
