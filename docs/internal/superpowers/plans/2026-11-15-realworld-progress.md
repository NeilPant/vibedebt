# SDD ledger — plan: docs/superpowers/plans/2026-11-15-realworld-generalization.md

Design approved by user; parallel execution explicitly requested.
Ruling: work in existing engine directory; inherited home Git repository has no HEAD and is not the project repository. Do not create home-level commits/worktrees.
Ruling: independent implementers own separate directories/tests; controller owns integration, package files and benchmark admission.
Baseline: engine verification running; upstream cloned into Downloads/VibeDebt-benchmarks/realworld-baseline.
Tasks 1-3: pending dispatch.
Tasks 4-6: pending integration/acceptance/review.
Tasks 1-3 implemented: analysis/extraction19 tests; runtime17 passed1POSIX skipped; browser8 tests; strict scoped checks green. Reports beside plan.
Task4 implemented target context/transaction/CLI. Real tiny Vite integration3 tests passes clean extraction and real type-correct auth-mutation rollback; context3 tests green.
User explicitly amended benchmark pin to28e1e43fdfcaa8d10baad6212d34f815dcbb1bba after original f9 failed missing rsts1.0.0. Original checkout retained untouched.
Earlier revision .npmrc disables package-lock, no committed lock. Runtime agent installs with package-lock=false/ignore-scripts then rebuilds esbuild, native checks pending. No tracked app changes authorized.
Playwright and Chromium installed. Added npm benchmark:realworld script; acceptance runner prepared but not yet run on RealWorld.
Initial full engine baseline overlapped in-progress new modules:56/58, CLI saw temporary missing imports/time budget; final integrated full suite required after edits settle.
Current extra work: runtime/browser agents add AbortSignal support; controller handles SIGINT/SIGTERM then restoration. Root imports may temporarily not typecheck until their optional args land.

FINAL: All six tasks complete. User approved one-line Register admission correction; archived patch SHA in spec. Both actual acceptance runs passed again after review fixes: clean6/6; native-passing Bearer mutation4fail; exact byte restore; restored6/6. Final full engine136 total135pass0fail1POSIXskip; tsc/build0; source max130 lines/AnyKeyword0; VibeMart reset and matched pristine. Independent review completed after initial quota failure; all3Important findings closed. CI browser installation configured, not dispatched remotely. External final run: C:/Users/tamil/Downloads/VibeDebt-benchmarks/acceptance-WvCxg8; user report outputs/realworld/acceptance-report.md.
