# VibeDebt Implementation Plan

Goal: deliver a working map -> anchor -> heal pipeline and CLI for VibeMart.
Architecture: typed AST inventory, evidence-based smell detection, public-export
characterization tests, conservative AST extraction behind snapshot/test rollback.
Stack: Node ESM, strict TypeScript 5.8, ts-morph, Commander, Vitest, React 19.

- [x] Milestone 1: Architecture scaffolding and shared contracts
  Create module tree and strict contracts; retain existing map compatibility.
- [x] Milestone 2: AST Cartographer
  Split scanner/detector, include hooks and tax/shipping evidence; verify real reads.
- [x] Milestone 3: Behavioral Test Synthesizer
  Discover public exports, capture deterministic observations, emit black-box tests.
- [x] Milestone 4: Architectural Healer and Auto-Rollback
  Extract domain/API boundaries, remove proven dead writes, verify baseline and
  post-change typecheck/invariants/anchors; restore exact snapshot on any failure.
- [x] Milestone 5: Markdown PR Reporter and Full CLI
  Wire optional-target commands, output options, built executable and package scripts.
- [x] Milestone 6: Final verification and clean state
  Review once, reset fixture, run typecheck/build/full suite, verify protected files.

Verification: `npx tsc --noEmit` and `npx vitest run` after each milestone.
E2E: `node scripts/reset-fixture.js` before and after fixture mutations.
No new dependencies. All engine source files below 250 lines, with zero `any`.
Review focus: unsupported targets fail before writes; exact rollback including new
file removal; route aliases/query strings; live UI inputs retained; repeatable healing.
Scope: healing supports the discovered VibeMart profile and fails closed on
unrecognized business bodies; mapping remains general purpose. No commits requested.

## Verification ledger

- Baseline: typecheck passed; 2 suites / 20 tests passed.

- Milestone 1: typecheck passed; 2 suites / 20 tests passed.

- Milestone 2: hook/rule regression failed first, then typecheck and 21 tests passed.

- Milestone 3: typecheck passed; CLI generated/replayed 109 anchors; 3 suites / 23 tests passed.

- Milestone 4: typecheck and 4 suites / 27 tests passed; healed fixture passes 122 checks; real post-mutation regression rolled back exactly.

- Final review: one read-only reviewer found protected-path, anchor identity,
  unsupported private-shape and parameter-default gaps. Regression tests reproduced
  each behavior before the fix pass; canonical path checks, target-bound anchors,
  exact AST guards and parameter checks now cover them. Additional rollback tests
  reproduced new-link restoration and empty-file deletion reporting defects.
- A verification run during a TypeScript diagnostic fix failed its child baseline
  typecheck. Source edits are now finished before the fresh complete gate.
- Milestone 5: compiled CLI full pipeline passed all 122 invariant/anchor checks;
  typecheck passed and the fresh full run passed 7 suites / 39 tests. Report records
  37 -> 12 AST clusters, 6 -> 0 orphan items and 2 -> 0 API inconsistencies.
- Final review fixes: protected artifacts/targets, wrong-target and unrelated
  anchors, manual-test overwrite, live UI changes, parameter defaults and extra
  REST aliases are covered. Both rollback minor findings were fixed with failing
  regression tests first; no review findings are deferred.
- Milestone 6: final reset, `npx tsc --noEmit` and `npx vitest run` passed
  (7 suites / 39 tests, zero failures). Reset again after the suite; all 8 fixture
  files match pristine byte-for-byte, invariant/reset-script SHA256 hashes are
  unchanged, all 19 engine files stay below 250 lines, and no heal lock remains.
- Retained generated anchor suite replayed against the restored pristine fixture:
  109 passed / 0 failed. No dependencies added; no source contains an `any` keyword.

## Open-source expansion

- [x] Milestone 7: Interactive HTML topology and debt visualizer
  Add a self-contained dark dashboard, pinned embedded Mermaid runtime and license,
  import graph, heatmap, source evidence cards, filtering and measured comparisons.
  Wire optional --html paths into map/run; test escaping, graph edges and CLI output.
- [x] Milestone 8: Optional AI intent enrichment with deterministic fallback
  Inspect domain function ASTs; attach evidence-based summaries to topology/PR reports.
  Opt-in --ai uses configured OpenRouter/Gemini/compatible endpoints with bounded
  requests and validated responses; absent keys/errors always retain heuristic output.
- [x] Milestone 9: Safe checkpointing and exact dry-run previews
  Share one in-memory transformation builder between planning and mutation. Preview
  creates/imports/source changes and line counts without anchors, locks or artifacts.
  Optional Git checkpoint uses a separate index/ref, preserving HEAD and user index.
- [x] Milestone 10: Flagship README, CI and final verification
  Document measured benchmark, offline/AI scope, architecture and exact quickstart;
  add push/PR CI, request one final review, reset fixture and run required gates.

Validation: failing feature tests first; typecheck and full Vitest after each milestone.
No package dependencies added. Mermaid is a licensed, pinned browser asset in assets/.
Review focus: HTML injection/offline rendering, AI timeouts and partial responses,
zero-write dry runs, exact planned-versus-applied changes, Git index/HEAD preservation.
Expansion baseline: typecheck and 7 suites / 39 tests passed before changes.
Milestone 7 gate: typecheck and 8 suites / 42 tests passed. Offline Edge rendering,
file filter and expansion controls verified with no browser errors.
Milestone 8 gate: typecheck and 9 suites / 51 tests passed. Provider tests use
mocked transports; no real API credits used. Heuristic summaries require no keys.
Milestone 9 gate: typecheck and 10 suites / 54 tests passed. Preview bytes match
actual edits, preview creates no files, and checkpoint leaves HEAD/index unchanged.
Final expansion review: one read-only review identified missing JS/index graph
edges, overconfident intent wording and root .git rollback interference. Each was
reproduced by a failing regression test and fixed; ambient declarations are now
skipped and recovery refs appear in success/failure outputs and both reports.
The README quickstart ran successfully with 122 passing invariant/anchor checks;
the fixture was reset afterward. CI uses official checkout/setup-node v7 on Node24.
Milestone 10 final gate: `npx tsc --noEmit` and `npx vitest run` passed with
10 suites / 58 tests, zero failures. Retained anchors replayed 109/109 on the reset
fixture. All 8 fixture files match pristine byte-for-byte; protected file hashes
are unchanged, all 25 engine modules are below250 lines with zero any keywords,
and no heal lock remains. Latest HTML rendered offline with working controls and
zero browser errors; README screenshot refreshed. CI was configured and inspected,
not dispatched remotely. No review findings remain deferred.

## RealWorld generalization

- [x] Milestone 11: Scoped syntax inventory and guarded authorization extraction
  Declarative source roots/config/exclusions; worker source/heap/time limits;
  symbol/type/template guards; exact preview, stale-config checks and bounded writes.
- [x] Milestone 12: Generic recovery and supervised runtime
  External snapshots, shared exclusions, dirty/untracked/binary restoration,
  target-owned source-only Git refs, process-tree teardown and handled cancellation.
- [x] Milestone 13: Browser/API behavioral anchors
  Engine-owned Playwright, controlled responses, immutable portable bundles,
  actual HTTP assertions and six original-frontend journeys without reset helpers.
- [x] Milestone 14: Manifest-based orchestration and CLI
  Explicit target context, per-target locks, native checks, final source/preview
  audits and recovery of deleted configured source/config paths.
- [x] Milestone 15: Two actual RealWorld acceptance runs
  User-approved revision 28e1e43 plus documented import-casing precondition.
  Clean extraction: native gates and 6/6 anchors. Token-to-Bearer mutation:
  native gates pass, 4 behavioral journeys fail, source bytes restore, 6/6 replay.
- [x] Milestone 16: Independent review and final verification
  All three Important findings fixed and closed by scoped re-review.
  Typecheck/build pass; full engine suite 135 passed, zero failed, one POSIX-mode
  test skipped on Windows. Source modules max130 lines, zero AnyKeyword nodes.
  Fixture reset after suite and matched pristine. Chromium CI setup configured;
  remote workflow not dispatched.

Evidence: docs/benchmark-artifacts/realworld/acceptance-report.md, acceptance.json, engine-tests.json.
The baseline includes exactly the approved register-import-case.patch before
capture; it is not counted as an authorization extraction change. Results establish
exercised frontend behavior preservation, not semantic equivalence or backend security.

## Cancellation follow-up (2026-11-16)

- [x] Reproduce cancellation during the final source audit, prevent acceptance
  and anchor publication after cancellation, verify source restoration and listener cleanup, then run
  independent review and the required typecheck/full regression gates.

Late cancellation reproduced in both the heal/capture final audit and the anchor
publication write. Acceptance now checks the signal after asynchronous audits;
anchor publication stages the JSON and removes staged/published output on failure.
Four focused regressions pass, covering final-audit rollback and cancellation
during anchor writing/renaming, with listener cleanup. Scoped independent review
closed the publication finding with no remaining Critical/Important findings.
Typecheck/build pass. Full regression: 18 suites, 139 passed, zero failed,
one POSIX-only test skipped on Windows (140 total). Fixture reset before/after;
all eight fixture files match pristine by SHA-256. All 58 source modules remain
under 250 lines with zero AnyKeyword nodes. Evidence:
docs/benchmark-artifacts/realworld/cancellation-engine-tests.json and cancellation-review.diff.
The previously completed actual RealWorld acceptance report was not rerun or
rewritten for this focused engine fix.
