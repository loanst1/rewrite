# ReWrite smoke tests

Regression coverage for the stability fixes shipped after the v1.0.27 audit
(storage-failure fallbacks, multi-touch stroke handling, double-finish guards).

## Run

```bash
# 1. Install Playwright (once)
npm install --save-dev @playwright/test
npx playwright install chromium

# 2. Run the smoke tests — the suite serves www/ itself on localhost:8791
npx playwright test tests/smoke.spec.mjs
```

Point the tests at a different origin by setting `REWRITE_URL`:

```bash
REWRITE_URL=https://app.example.com npx playwright test tests/smoke.spec.mjs
```

On machines where Playwright's registry browser build isn't installed, point
`REWRITE_CHROMIUM` at a Chrome binary instead of running `playwright install`:

```bash
REWRITE_CHROMIUM=/path/to/chrome npx playwright test tests/smoke.spec.mjs
```

Runs headless by default. Add `--headed` to watch.

Note the app entry is `/app.html` — `/index.html` is only a splash screen that
redirects. The tests navigate straight to `/app.html`.

## What's covered

| Test | Guards against |
| --- | --- |
| **boot** | app failing to reach home; any of the 17 language buttons missing; page errors on cold start |
| **navigation** | any of the 6 exercise types, My Practice, or the 4 tabs failing to open or return home |
| **drawing** | a mouse stroke not landing on the canvas, Submit staying disabled, the score screen not showing, Next not advancing |
| **IDB unavailable** | a Safari/private-browsing storage refusal freezing boot or the finish-session flow (memStore fallback) |
| **multi-touch** | a second finger (palm) restarting, corrupting, or continuing another finger's stroke |
| **rapid Next double-click** | a tremor double-tap skipping an exercise or double-saving a session |

## Adding a case

When a customer reports a new bug that our code review missed, add a test that
would have caught it. Each test seeds a realistic activated state via
`seedActivatedApp()` (IndexedDB settings + past sessions, English language)
and drives the exact user journey that reproduced it. Keep the assertions on
**behaviour** (ink landed on the canvas, the counter advanced, the summary
appeared) rather than **implementation** (CSS class names, internal stroke
arrays) so they don't rot with refactors.
