# Task 3 browser boundary evidence

Owner: browser characterization worker. Scope is `src/generic/browser/**`, `src/benchmarks/realworld-browser*.ts`, and `tests/generic-browser.test.ts`.

## Implemented contract

`captureBrowser(baseURL, plan)` captures a versioned, recursively frozen serializable `AnchorBundle`; `replayBrowser(baseURL, plan, bundle)` checks configuration and observation SHA-256 integrity before launching Chromium and returns separate pass/fail evidence. Both APIs and their public types are exported from `src/generic/browser/index.ts`.

Both APIs additionally accept a final optional `BrowserRunOptions` argument `{ signal?: AbortSignal }`. Signals are runtime-only and are excluded from configuration and anchor hashes. A pre-aborted signal rejects before launch. Active abort closes Chromium and its contexts, then rejects with `Browser execution canceled`; cleanup has a five-second bound and its failures remain explicit. The abort listener is always removed after execution.

The data-only plan configures API fixtures, declared external assets, fresh-context journeys, DOM actions, storage seeds, checkpoints and required request counts. Relative fixture/API prefixes resolve against the supplied loopback origin. Same-origin observation URLs become `<app>/path`, query parameters sort, and independent requests sort before comparison; header values, request bodies, UI text and storage values are not normalized. Selected outgoing headers are recorded with absent values represented as null. JSON bodies are canonicalized without changing values.

Every context installs interception before app navigation, disables service workers, and sets a fixed browser clock. Only the supplied loopback origin's page/assets pass through. Unknown fetch/XHR, configured API and external requests receive a synthetic 401 and explicit evidence. Header/body/count mismatches are recorded before fulfilling the fixture's deterministic response, allowing the UI to complete and retaining the actual mismatch independently of UI error handling. Storage seeding uses a harness-only empty document and runs once, preserving application removal across reload.

Plans and bundle hashes bind logical benchmark ID, pinned revision and environment/scenario configuration; physical loopback paths and ports are execution inputs. Per-action timeouts are at most 10 seconds, journey execution at most 30 seconds and suite admission at most 180 seconds. Chromium launch has a 15-second limit. Context/browser teardown runs in finally blocks.

## Test-first evidence

1. Initial owned test invocation failed because the browser module did not exist.
2. Added typed API stubs throwing `Browser capture not implemented`; all four initial behavioral tests failed for that expected missing implementation.
3. Implemented the browser runner. Initial execution then reached Playwright launch and reported the not-yet-downloaded headless-shell executable.
4. Used Playwright's documented `channel: 'chromium'` new headless mode with the installed full Chromium binary.
5. `npx vitest run tests/generic-browser.test.ts`: **8 tests passed**, 17.79 seconds on 2026-11-15. Added focused storage and required-request regressions while implementing their boundaries. Self-review regressions first demonstrated duplicate journey-failure counting for punctuation in IDs and an undeclared same-origin form POST passing through; the respective identity accounting and read-only asset allowance fixes passed those tests and the full owned file.
6. Scoped strict TypeScript check of browser index, RealWorld plan and owned test: passed with no diagnostics. No full build/suite or legacy fixture reset was run by this worker.
7. Cancellation follow-up: two focused regressions first failed with a journey deadline and an unsafe-port navigation result instead of cancellation. After adding runtime abort handling, `npx vitest run tests/generic-browser.test.ts -t 'cancel'` passed **2/2 selected tests** (8 skipped), 5.95 seconds. One aborts only after the real HTTP app has received browser navigation, verifies listener removal, then runs a fresh successful capture/replay. The other rejects an already-canceled replay and preserves the frozen bundle bytes. Scoped strict TypeScript check passed again.
8. Independent-request ordering follow-up: inspected `runJourney`, which already sorts complete request records by canonical JSON before returning either capture or replay observations. Added two real HTTP-served app variants initiating the same two POST requests in opposite order; the frozen bundle replays successfully with exact distinct request JSON bodies and authorization. A third app repeats one request while fixture max=2 permits the repeat and UI output remains identical; replay still fails on frozen observation multiplicity. The focused ordering regression passed; subsequent complete owned browser suite passed **11/11 tests**, 25.23 seconds, and scoped strict TypeScript check passed. No generic engine behavior needed alteration.

The real tiny HTTP application tests cover frozen observations and cross-port replay; Token-to-Bearer mismatch with actual values and no timeout failure; unexpected outbound API traffic; changed plan and changed serialized observation rejection before navigation; storage removal surviving reload and fresh-context isolation; a frontend that never emits a required request; exact journey failure counting; and unknown same-origin form POST denial. There are no application module imports or reset helpers in these boundary anchors.

## RealWorld scenario inspection

Initial read-only inspection used `f9b47563e68cdd9d647ed8fc617f3c7d98858fee`. After the user explicitly approved the earlier installable benchmark revision, scenario data was updated from `git show 28e1e43fdfcaa8d10baad6212d34f815dcbb1bba` in `C:/Users/tamil/Downloads/VibeDebt-benchmarks/realworld-baseline`: router, login, settings, navbar, home article previews, favorite hook, SessionService and both API services. The active logical identity/revision is now `28e1e43fdfcaa8d10baad6212d34f815dcbb1bba`. This frontend uses HashRouter, `skip=0` on list requests and direct favorite-button numeric text. The original API remains `https://conduit.productionready.io/api` and all calls are intercepted. Synthetic unsigned JWT-shaped values have fixed future/expired expiry claims; there are no real credentials.

Prepared six journeys: UI login then reload/favorite/settings, rejected UI login, authenticated settings then logout, logged-out article/user requests, malformed token, and expired token. Both UserService `/user` and ArticleService list/favorite paths have exact authorization assertions. Third-party stylesheets declared by original index.html receive deterministic empty CSS. Fixture images use data URIs.

Live original-frontend capture and replay remain pending controller baseline dependency admission. Expected frontend observations have not been guessed or frozen from replacement application code. Acceptance across both independent original-derived copies is controller-owned.

## Source checks and documentation

Every owned source file has fewer than 100 lines (limit: under 250). Scoped source uses strict types and no explicit `any`. No package, protected fixture, application baseline source/config, or unrelated home Git state was modified.

Official Playwright references consulted through the read-docs skill: [BrowserContext](https://playwright.dev/docs/api/class-browsercontext), [Clock.setFixedTime](https://playwright.dev/docs/api/class-clock#clock-set-fixed-time), and [Chromium new headless mode](https://playwright.dev/docs/browsers).
