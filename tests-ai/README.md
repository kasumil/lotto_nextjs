# Lotto shared AI E2E pilot

This project-specific suite imports `runGoal` through `shared-runtime.mjs` and
executes the project's **actual** `src/lib/seller-cache.ts` in a small synthetic
browser page. Node's built-in TypeScript stripping removes types in memory;
there is no copied cache implementation or generated production source.

## Coverage

- Concurrent readers share a pending request and cause one fixture fetch.
- A read at 3,599,999 ms reuses the same data without fetching again.
- A read at exactly 3,600,000 ms starts one shared refresh.
- Rejected responses and malformed non-array responses do not poison retries.
- Negative controls prove a model's premature `done` cannot bypass the oracle,
  and caller authorization can reject a click before the cache is touched.

The independent host-side oracle compares the complete observed event sequence,
call counts, promise/data identity observations, response IDs, and TTL against
fixed expected values. Fixture state or model self-assessment alone cannot pass.
The positive tests attach JSON evidence including the source SHA-256, wrapper
metrics, observed results, and attempted network counts.

## Execution and limits

Use the project's shared-wrapper commands and separate Playwright config. The
explicit `seller-cache.ai.mjs` filename avoids normal `*.spec.*` / `*.test.*`
discovery. No existing test configuration is imported or merged.

Default inference is a deterministic **stub**, not an AI accuracy measurement.
Explicit `npm run test:ai:live` selects only the wrapper's verified local
`qwen3:32b` transport for the three positive synthetic scenarios. The two negative
controls always use deterministic stubs. Nothing downloads or installs a model.
Live runs need the separate config's timeout to allow a 90-second goal budget.

Each test uses a fresh, empty Playwright context, offline mode, HTTP request
abortion, WebSocket interception, blocked service workers, and a restrictive
page CSP. Assertions require zero browser network attempts. The real module's
singleton fetch function is defined but never invoked; injected fixture fetches
use synthetic rows and an in-memory clock. No application server is started.

This validates the real cache helper through the shared wrapper, **not the
production app UI**, Kakao Maps, marker rendering, real geolocation, deployed
HTTP caching, authentication, lottery selection, or purchases. No credentials,
real user data, external services, production sessions, or CI changes are used.
The wrapper is not a general browser or OS security sandbox.
