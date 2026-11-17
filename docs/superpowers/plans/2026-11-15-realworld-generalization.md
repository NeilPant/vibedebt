# RealWorld Generalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Demonstrate a clean generic authorization extraction and a type-correct behavioral mutation with byte-verified rollback on the pinned RealWorld frontend.

**Architecture:** Independent scoped analyzer/extractor, snapshot/process runtime, and browser boundary runner feed one target-context orchestrator. Retain legacy VibeMart entry points. Benchmark configuration selects symbols and protocol data; generic code contains no application-specific names.

**Tech Stack:** Existing strict TypeScript, ts-morph, Vitest, Node; engine-owned Playwright with Chromium. RealWorld uses its own installed TypeScript/Vite/Vitest.

**Spec:** docs/superpowers/specs/2026-11-15-realworld-generalization-design.md

## Global Constraints

- Pin user-approved28e1e43fdfcaa8d10baad6212d34f815dcbb1bba plus the approved register-import-case.patch; benchmark outside the engine and VibeMart.
- Never modify fixtures/vibe-mart-pristine, tests/fixture-invariants.test.ts or scripts/reset-fixture.js.
- No new engine source file reaches 250 lines; strict types, zero explicit any.
- 2,000 source files; 2 MiB/file; 32 MiB total; inventory 30 seconds, semantic phase 60 seconds, 512 MiB worker heap.
- Exclude node_modules, dist, build, coverage, .git, .vite, caches and run artifacts before traversal.
- Snapshot restores included dirty/untracked source/config bytes; preserve Git HEAD/index.
- Unchanged anchors cover both service request paths; Token -> Bearer mutation must pass actual target tscheck and fail an authorization assertion.
- Existing legacy tests may reset VibeMart; the generic path may not call its reset helpers/invariants.

## Review Focus

- Ignored/untracked source survives rollback and created files disappear: runtime tests.
- Symlink/junction escapes and existing destinations fail before writes: runtime and extraction tests.
- Missing/stale anchors or plans cannot silently capture new expectations: integration tests.
- Browser request mismatches must produce assertion evidence rather than timeout-only failure: browser tests and mutation acceptance.
- Tiny source/time limits terminate work without mutation, and path aliases remain usable: analysis tests.

## Execution and ownership

The user approved the design and explicitly requested parallel implementation. The independent tasks below run concurrently with disjoint ownership; this user preference overrides the subagent skill's sequential-implementer default. Each implementer uses test-first work and self-review; the controller integrates and commissions one fresh whole-change review. No worker spawns agents.

The project has no project-level Git history and inherits an unrelated unborn home Git branch. Do not initialize, stage, commit or reset that home repository. Save an engine source/config baseline outside it for scope comparison; do not manufacture a worktree from an absent HEAD. Dedicated benchmark clones have their own Git roots.

Progress ledger: docs/superpowers/plans/2026-11-15-realworld-progress.md. Shared interfaces below are fixed for integration; request a controller ruling before changing them.

## Task 1: Scoped map and bounded structural extraction (parallel owner A)

**Files:** Create src/generic/analysis/*.ts, src/generic/extraction/*.ts; tests/generic-analysis.test.ts and tests/generic-extraction.test.ts.

**Interfaces:**
- mapTarget(root: string, options?: AnalysisOptions): Promise<AnalysisReport>, exported from src/generic/analysis/index.ts.
- AnalysisOptions contains optional maxFiles, maxFileBytes, maxTotalBytes, timeoutMs, semanticTimeoutMs, heapMb; defaults match spec.
- AnalysisReport contains complete: boolean, files: array of {path: string}, candidates: array, diagnostics: string[]; additional evidence fields allowed.
- prepareExtraction(root: string, selection: ExtractionSelection): Promise<ExtractionPlan>, exported from src/generic/extraction/index.ts.
- ExtractionSelection: {sources: {file: string; className: string; memberName: string}[]; destination: string; helperName: string}.
- ExtractionPlan: {root: string; changes: {file: string; before: string | null; after: string}[]; sourceHashes: Record<string,string>; noop: boolean}.
- applyExtraction(plan: ExtractionPlan): Promise<void> rejects stale sources/destinations and path escapes.

- [x] Write tests for excluded poison files, aliases, file budgets, worker timeout, generic class/member names, token construction extraction, effectful mismatch rejection, destination collision and stale/no-op application.
- [x] Run only owned tests, observe expected failures.
- [x] Implement syntax-first supervised analysis and focused extraction. Retain original wrappers/getToken evaluation; preserve undefined object property and prefix. Generic shape checking must resolve selected declarations/types, reject extra effects/getters and avoid naming special cases.
- [x] Re-run owned tests and record pass counts, red evidence and caveats in the ledger/report.

## Task 2: Generic snapshot and supervised process runtime (parallel owner B)

**Files:** Create src/generic/runtime/*.ts; tests/generic-runtime.test.ts.

**Interfaces:**
- snapshotWorkspace(root: string, artifactDir: string): Promise<WorkspaceSnapshot>, exported from src/generic/runtime/snapshot.ts.
- restoreWorkspace(snapshot: WorkspaceSnapshot): Promise<RestorationEvidence>; verifySnapshot(snapshot): Promise<RestorationEvidence>.
- RestorationEvidence: {matches: boolean; differences: string[]}. WorkspaceSnapshot serializable to an external artifact, includes root.
- runCommand(command: {command: string; args: string[]; cwd: string; timeoutMs?: number}): Promise<CommandResult>, from src/generic/runtime/process.ts.
- CommandResult: {code: number; output: string; timedOut: boolean}.
- startServer(command: same command record, readyUrl: string): Promise<{stop(): Promise<void>}> with readiness/termination bounds.
- An explicit recoverSnapshot(file: string) entry may be provided with the above snapshot API.

- [x] Write tests for dirty/binary/untracked/ignored files, created/deleted directories, excluded links, owned symlink rejection, snapshot outside target, Git HEAD/index preservation, real child timeout and server stop.
- [x] Observe owned tests fail, then implement on-disk snapshots, exclusions before descent, safe canonical restoration, process-tree termination and readiness.
- [x] Verify exact paths/types/bytes and executable modes when meaningful; restoration errors are explicit.
- [x] Run owned tests and record evidence. Do not modify legacy rollback/checkpoint or common contracts.

## Task 3: Browser boundary runner and RealWorld scenario data (parallel owner C)

**Files:** Create src/generic/browser/*.ts, src/benchmarks/realworld-browser.ts; tests/generic-browser.test.ts. Controller owns package/dependency installation and CLI.

**Interfaces:**
- BrowserPlan exported from src/generic/browser/types.ts, data-only versioned configuration for API fixtures and journeys.
- AnchorBundle exported there, immutable serializable baseline observations/config fingerprint/logical benchmark ID.
- captureBrowser(baseURL: string, plan: BrowserPlan): Promise<AnchorBundle>; replayBrowser(baseURL: string, plan: BrowserPlan, bundle: AnchorBundle): Promise<BrowserVerification>, exported from src/generic/browser/index.ts.
- BrowserVerification: {success: boolean; passed: number; failed: number; failures: string[]}; retain actual auth mismatches.
- realworldBrowserPlan exported from src/benchmarks/realworld-browser.ts. Logical identity tied to the pinned revision; physical baseURL may differ.

- [x] Write a real tiny HTTP-app test for capture/replay, wrong auth failure (not timeout), unexpected traffic and config-tampering rejection; observe failure.
- [x] Implement fresh contexts, API interception before navigation, controlled clock, strict HTTP observations, immutable hashes, no imports of target modules.
- [x] Inspect external pinned RealWorld UI to choose real locators and scenario data. Include login success/failure, both services, reload, logout, logged-out and invalid/expired token behavior.
- [x] Run owned tests after controller installs Playwright/Chromium; ensure unchanged bundle replays across ports and both app copies. Keep files under 250 lines; split scenario data as needed.

## Task 4: Target orchestration, configuration and CLI (controller, after contracts exist)

**Files:** Create src/generic/target.ts, src/generic/transaction.ts, src/benchmarks/realworld.ts and small supporting files; modify src/cli/index.ts and package.json/package-lock.json; tests/generic-integration.test.ts.

**Interfaces:**
- TargetContext contains root/artifactDir/logical ID, exact commands and browser plan.
- runTarget(context, selection, options) runs map, frozen anchors, baseline gates, snapshot, extraction, verification and restore. Optional test-only afterApply injection; never exposed by CLI.
- Existing map uses a new explicit generic mode; add target-run/target-preview/target-recover commands without changing existing VibeMart behavior.

- [x] Write failing integration tests for stale bundles/plans, baseline failure/no mutation and actual rollback, using isolated temp applications.
- [x] Implement target-root commands, per-target locks, snapshot identity revalidation, start/stop lifecycle, explicit recovery and separate result evidence.
- [x] Ensure failed restoration is never successful rollback; compare wider snapshot for unplanned source writes.
- [x] Extend CLI with explicit manifest input and meaningful nonzero failure status; keep existing CLI tests green.

## Task 5: Real benchmark admission and two acceptance runs (controller)

**Files:** Create scripts/realworld-acceptance.ts and reusable benchmark preparation helpers as needed; output outside mutable targets. Update README.md and PLAN.md with measured evidence only.

- [x] Clone pinned upstream into the external benchmark root; use independent clean runnable copies for each run.
- [x] Establish target-native baseline with the documented historical no-lock compatibility setup, admission patch, tscheck/build/test:r. If environmental incompatibility occurs, diagnose without upstream source/lockfile edits.
- [x] Capture one frozen bundle; replay three times as stability evidence, retaining hashes.
- [x] Run clean extraction and verify preview/output, unchanged anchors, native gates and write allowlist.
- [x] Run Token -> Bearer mutation in second original copy; prove actual target tscheck succeeds, unchanged browser suite fails on actual Authorization value, restore original hashes/helper absence and replay baseline.
- [x] Save a concise JSON evidence report with command output paths and hashes. Do not claim success from simulated callbacks.

## Task 6: Integrated verification and review

- [x] Run engine typecheck/build, complete Vitest and required before/after legacy fixture reset. Verify protected hashes and engine module size/type rules.
- [x] Request one fresh review of the approved spec, implementation diff and actual two-run evidence.
- [x] Fix material review findings with focused regressions and re-run affected checks.
- [x] Mark milestone and plan checkboxes only when evidence is complete; report limitations honestly.

## Self-review

All approved spec sections map to Tasks 1-6. Separate ownership avoids simultaneous edits to common source files. Public signatures agree across tasks. Benchmark admission, auth failure evidence, parser watchdog, source/Git recovery and existing-fixture compatibility each have an explicit verification gate. No permission pause is added: the user has already approved the scope and requested execution.
