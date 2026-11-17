# Task 2: snapshot and process runtime evidence

Implemented only `src/generic/runtime/**` and `tests/generic-runtime.test.ts`; this report is the requested task-specific evidence artifact. No common contracts, package files, legacy implementation, fixtures, home-repository Git state, or other workers' files were modified.

## Public contracts

- `snapshotWorkspace(root, artifactDir)` creates an external content-addressed `blobs/` directory and writes `snapshot.json` only after recapturing and comparing the target. Artifact storage cannot overlap the target in either direction and cannot reuse an existing `blobs/` recovery point.
- `WorkspaceSnapshot` is JSON-serializable: `version: 1`, canonical `root`, canonical `artifactDir`, absolute `snapshotFile`, `rootIdentity: {dev, ino}`, and `entries: {path, type, mode, hash?}[]`. Paths use forward slashes relative to the target. Directories are recorded explicitly, including empty ones. `hash` is a SHA-256 content address for files.
- `restoreWorkspace(snapshot)` validates canonical roots, root filesystem identity, manifest paths/types/duplicates/parentage, all current owned paths, and every backup blob before beginning restoration. It restores bytes, recreates missing original directories and files, removes created included entries, handles file/directory type changes, restores applicable POSIX modes, then performs a new real inventory comparison.
- `verifySnapshot(snapshot)` returns `{matches, differences}` and, on a normal mismatch, `changedFiles` containing changed/deleted/new included relative files and directories. Unsupported owned paths or other inventory failures throw with explicit diagnostics; an incomplete inventory is never a complete mismatch result. Invalid target identity or artifact boundaries reject.
- `recoverSnapshot(file)` reads and validates the on-disk manifest, verifies its location, and uses the same restoration path.
- `runCommand({command,args,cwd,timeoutMs?})` returns `{code,output,timedOut}`. Commands default to 120 seconds, retain bounded combined stdout/stderr (last 8 MiB), and reject invalid/nonfinite deadlines. Windows npm/npx/batch executables are resolved to absolute paths and launched with explicit interpreter quoting; unsafe shell metacharacters in batch command strings are rejected.
- `startServer(command, readyUrl)` defaults to 60-second readiness, requires loopback HTTP, rejects an already ready server at that address, probes readiness with bounded HTTP requests, and exposes idempotent `stop()`. Failed readiness cleans up before rejecting.

## Safety boundaries

Traversal prunes node_modules, dist, build, coverage, .git, .vite, cache/caches/.cache, .turbo, .next, .vibedebt, and artifacts before even inspecting the excluded entry. Excluded junctions therefore neither trigger owned-link rejection nor cause traversal. Included symlinks/junctions, special files, and hard links reject. Hard-link rejection prevents writing an external inode through an included ordinary-looking path. Dirty, ignored, untracked, binary, and configuration files all participate without consulting Git ignore rules.

Git metadata is outside the owned boundary. The snapshot/restore implementation issues no Git commands and imports no legacy reset/checkpoint code; the later generic optional checkpoint module uses its own snapshot-owned Git path. The test initializes an isolated disposable Git repository, makes a real commit, stages one version, leaves different dirty bytes, and asserts both HEAD and the real index bytes remain unchanged after restoration.

Windows process teardown enumerates the actual Win32 process parent graph with a bounded PowerShell query, invokes bounded `taskkill /T /F`, and confirms every observed PID is gone. Descendants are cleaned even when a wrapper exits normally before its child. POSIX children launch in a separate process group and teardown kills that group. Utility, enumeration, or termination-confirmation errors reject rather than manufacture successful cleanup evidence.

## Test-first evidence

1. Initial `npx vitest run tests/generic-runtime.test.ts`: **9 failed, 1 skipped**. The missing-runtime assertions identified absent snapshot/process modules.
2. After initial implementation: **9 passed, 1 skipped**.
3. Added concrete regressions: **3 failed, 12 passed, 1 skipped**. Failures identified missing recovery manifest/changed-path fields, an external-inode hard-link overwrite risk, and Windows batch argument quoting.
4. The Windows batch regression first showed escaped quotes reaching cmd.exe. After verbatim interpreter arguments, the next diagnostic exposed npm's relative `%~dp0` resolution. Resolving the batch executable to its full PATH location fixed the actual npm invocation.
5. Final command and pass count are recorded below after the final run. Additional regressions exercise root replacement, file/directory type changes, nonfinite timeouts, normal-wrapper descendant cleanup, and an occupied readiness address.

Scoped strict TypeScript verification (exit 0):

`npx tsc --noEmit --strict --target ES2022 --module ES2022 --moduleResolution bundler --esModuleInterop --skipLibCheck src/generic/runtime/types.ts src/generic/runtime/snapshot-files.ts src/generic/runtime/snapshot.ts src/generic/runtime/process-tree.ts src/generic/runtime/process.ts tests/generic-runtime.test.ts`

Source sizes at inspection: types.ts 15 lines; snapshot-files.ts 94; snapshot.ts 101; process-tree.ts 65; process.ts 92. No explicit `any` types, fixture reset calls, Git-reset calls, or legacy imports were introduced.

## Limits and concerns for integration

- The POSIX executable-mode test is skipped on this Windows host. Windows junction handling, actual process descendants, server teardown, and npm.cmd were exercised here. The POSIX group-kill implementation and mode restoration still need execution on a POSIX host for platform-specific assurance.
- Recovery assumes exclusive workspace control as the approved design states. Preflight rejects dangerous paths; it does not provide race-proof protection against arbitrary external filesystem edits during restoration.
- Restoration never recursively deletes a directory. If a newly created included directory contains excluded output/dependency trees, it fails explicitly instead of deleting excluded bytes to force a clean report. Retain artifacts and report failed restoration in that case.
- Crash-atomic multi-file restoration and automatic crash recovery are outside the approved scope. The external manifest supports explicit recovery after a process interruption.
- The readiness HTTP probe assumes the orchestrator reserves a dedicated port. An already responding unrelated server is rejected, but the helper cannot authenticate which process owns a socket against arbitrary external races.
- Windows batch arguments containing shell metacharacters are deliberately unsupported and fail before launch; normal npm script arguments and paths with spaces are supported. Prefer a direct executable plus an argument array for unrestricted strings.
- The owned-test command emits a harmless Git LF/CRLF advisory during construction of its isolated repository. It does not touch project or home-repository Git state.
- Per controller instruction, no full engine build, full suite, reset script, staging, or commit was run by this worker. The controller owns integrated verification.

## Final verification

2026-11-15, final owned test execution: `npx vitest run tests/generic-runtime.test.ts` exited 0; **17 passed, 1 skipped**, 18 total; 8.13-second total duration. The skip is the explicitly platform-specific POSIX executable-mode test. All six real Windows command/server/tree scenarios passed, including retained exit output, descendant timeout, ready server stop, failed-readiness cleanup, npm.cmd, and wrapper-before-child exit.

## Handled-cancellation follow-up

`Command` now accepts optional `signal?: AbortSignal`. `runCommand` rejects pre-aborted requests before launch and rejects an in-flight abort only after the same bounded real process-tree cleanup. `startServer` handles abort both during readiness and after readiness, invokes idempotent stop, and unregisters its abort listener on every stop path. Background abort cleanup rejection remains observable by the returned `stop()` promise.

Test-first evidence: three initial cancellation regressions failed (running command waited until timeout, ready server remained alive, pre-aborted command launched). After implementation they passed. A fourth real-process readiness-abort regression additionally verifies teardown before rejection; listener removal is checked using the actual Node event-listener inventory.

Full owned runtime run after the cancellation implementation: `npx vitest run tests/generic-runtime.test.ts` exited0, **21 passed, 1 skipped** (22 total), 9.90 seconds. After correcting test-only Node event import typing, complete engine `npx tsc --noEmit` exited0. Source implementation remains under250 lines (process.ts now112).


## Independent review fixes: I1, I2, I3

New API: `snapshotWorkspace(root, artifactDir, options?: BoundaryOptions)` imports the shared boundary normalizer. Every new snapshot persists optional `boundary: {sourceRoots, tsconfig, excludedPaths}` with normalized values. Snapshot capture still covers the wider included root (configuration/untracked files outside sourceRoots remain owned); sourceRoots do not narrow recovery. Verification, restoration, and explicit recovery retain custom exclusions from the saved manifest. Earlier JSON without `boundary` defaults to empty custom exclusions.

All exclusion decisions now use shared `excludedPath`. This includes manifest validation, so legitimate nested `src/build` source is included while the root build output is excluded. Dependency/metadata special names remain excluded at every depth as declared by the shared boundary helper. Custom paths are pruned before lstat/descent; a custom generated directory containing an escaping junction is safely ignored. Saved boundary validation is lexical and does not require an original source directory to still exist before recovery recreates it.

I1: `verifySnapshot` now throws when inventory is incomplete/unsupported instead of returning an ambiguous false result without changedFiles. Normal complete mismatches still return concrete changedFiles. The owned link regression verifies the throw. The controller owns final transaction admission and restoration-failure regressions.

I2: new `src/generic/runtime/checkpoint.ts` exports asynchronous `createTargetCheckpoint(snapshot): Promise<{ref,commit}>`. It validates snapshot/artifact identity and requires Git's canonical top-level to equal snapshot.root exactly before creating any Git object/ref. Inherited Git environment overrides are cleared. A fresh external temporary index starts from an empty tree; each captured FILE blob is hash-validated and written as a Git blob, then inserted with its captured applicable mode and literal relative path. No directory traversal, ignore-driven staging, live source reads, `git add -A`, or legacy checkpoint import occurs. Each Git subprocess has a15-second timeout and bounded output. The resulting commit/ref covers only snapshot-owned files; HEAD and real index remain unchanged. Ref creation and temporary-index cleanup do not reset or stage the working tree.

Review-test red evidence: custom-output poison initially failed because it was traversed; both checkpoint tests initially failed because the generic module did not exist (3 expected failures,1 backward-JSON recovery pass). After implementation, all4 focused tests passed. A further nested src/build regression then failed against old per-segment manifest validation, and passed once manifest validation delegated to shared full-path exclusions.

Owned proofs include an ancestor Git repository whose refs and index bytes remain unchanged after rejection; unignored node_modules/custom output absent from the checkpoint tree; included ignored source present; captured dirty/ignored blob bytes retained even after the live source changes; path spaces handled; target HEAD/real index unchanged. No actual home-repository checkpoint was created. A deleted declared source root is recreated by recovery, and wider root config bytes restore while excluded generated content survives.

Source file sizes after the review changes: checkpoint.ts47, snapshot-files.ts107, snapshot.ts101, process.ts112, process-tree.ts65, types.ts18. All remain under250 lines and strictly typed with zero explicit any. Scoped strict TypeScript check including checkpoint and owned tests exited0. Final owned test execution is recorded below.

### Legacy boundary migration safeguard

Snapshots with no boundary field retain the **original any-depth default-name exclusions**, using the shared defaultExcludedNames list in legacy mode during manifest validation and every verification/restoration inventory. New snapshots always have a normalized boundary field and use current shared root-relative output exclusions. This cleanly distinguishes old v1 recovery artifacts from new v1 captures without changing the serialized schema version.

A further regression first failed when an old snapshot encountered a subsequently-created src/build/poison junction. It now verifies that only the actual included source mismatch is reported, explicit on-disk recovery restores source bytes, and the old excluded nested output/link remains untouched. The separate new-snapshot regression proves legitimate src/build source bytes are included and restored. Six review-focused tests passed after this migration change. Final scoped strict TypeScript check exited0, including new checkpoint.ts and all owned runtime tests.

Final review-wave owned verification: `npx vitest run tests/generic-runtime.test.ts` exited0 with **27 passed,1 skipped** (28 total;11.31seconds). The only skip remains the POSIX executable-mode test on Windows. Scoped strict TypeScript exited0. Final snapshot-files.ts is111 lines; all runtime source files remain47–112 lines except types.ts18. No full suite/build, legacy checkpoint edits, staging, commits, or changes to benchmark source were performed in this review wave.
