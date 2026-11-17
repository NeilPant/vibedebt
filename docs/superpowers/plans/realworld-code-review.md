# RealWorld implementation review record

Date: 2026-11-15

## Independent review status

A fresh reviewer was requested with the approved specification, implementation plan, captured-source diff and scoped test reports. The agent service failed before review with a usage-limit error. No independent approval was returned or inferred.

## Controller review and verification

The controller inspected the extraction's symbol/type and shape guards, exact preview/application builder, stale source/destination checks, path canonicalization, snapshot manifest/blob validation, excluded-tree pruning, worker deadlines, browser request assertions and immutable observations, process-tree teardown, cancellation, per-target locks and restoration result handling.

Review-driven adjustments included general syntax inventory, runtime cancellation, a real Vite readiness regression requiring an HTML Accept header, runtime classification of the pinned Playwright dependency, and a cold-process integration-test timeout justified by measured 5.1-second combined CLI startup/AST work.

The unchanged target's first pin could not install its missing rsts dependency. The user explicitly approved the earlier revision and then the checked-in one-line Register import-casing precondition. Neither change is hidden in the authorization extraction metrics.

The actual admitted RealWorld app passed clean extraction and all native/browser gates. A Token-to-Bearer mutation passed native gates, failed actual HTTP anchors, restored bytes, and passed all six restored journeys. Detailed evidence is in outputs/realworld/acceptance.json and acceptance-report.md.

No unresolved material defect was identified in the controller's inspected paths. This assessment is not an independent review. The full engine regression results remain the completion gate and are recorded separately.

## Independent review

Date: 2026-11-15. The independent reviewer subsequently became available and completed this review. The earlier service-failure and controller-review records above are retained as provenance.

Verdict: **Changes required**. No Critical finding identified; three Important findings remain in generic safety/spec-compliance paths. These are separate from the actual RealWorld acceptance runs, which now have valid successful evidence on the explicitly amended baseline.

### Important I1: an incomplete final filesystem inventory can be accepted as success

Locations: `src/generic/transaction.ts:79-84`, `src/generic/runtime/snapshot.ts:37-38`.

`verifySnapshot` catches an inventory error and returns `matches: false` with diagnostics but without `changedFiles`. The transaction converts absent `changedFiles` to an empty array, finds no unexpected paths and sets `success = true`. For example, a passing post-extraction command can create an included junction, hard link, or special file; the inventory rejects that entry, but the transaction accepts the incomplete comparison. This is an actual mismatch between two current result contracts, not a filesystem race assumption. It also means the restoration path is never attempted for this case.

Fix direction: make inventory completeness explicit (or throw on inventory errors), require a complete comparison before evaluating allowed changes, and preserve diagnostics in the failed result. Keep the existing safe refusal to traverse an unsupported link during recovery; failure to restore must remain `rolledBack: false`. Add a focused transaction regression where otherwise-passing verification introduces an owned unsupported entry and assert failure, retained recovery evidence and no false successful rollback.

### Important I2: the generic checkpoint path inherits an unrelated repository and ignores snapshot ownership

Locations: `src/generic/transaction.ts:74`, `src/healer/gitCheckpoint.ts:21-30`.

The new generic path calls the legacy checkpoint implementation without validating that Git's discovered root is the target's owned repository. That implementation accepts any ancestor repository, then writes a commit and recovery ref there. A generic target directory under the inherited user-home repository therefore writes home-repository objects/refs when `--checkpoint` is used, contrary to this task's explicit recovery boundary. The successful RealWorld script avoids this because its runs are clones with their own Git roots; the generic CLI does not enforce that condition.

The same call uses `git add -A` on the entire target rather than the snapshot-owned file set. If `node_modules`, build outputs or caches are not Git-ignored (or are already tracked), the checkpoint traverses/stages them despite their declared exclusion from the recovery boundary. A separate index preserves the real index, but does not enforce the approved ownership boundary.

Fix direction: add a generic checkpoint adapter/preflight that requires an explicitly target-owned repository (reject an inherited ancestor by default), and builds the supplemental checkpoint from the same included path boundary as the snapshot. Preserve the legacy adapter's behavior separately. Add disposable-repository regressions for an ancestor repo and unignored excluded trees; verify no unrelated refs/index/HEAD changes and no excluded checkpoint content. Do not exercise the actual home repository.

### Important I3: the approved declarative project/ownership configuration is missing

Locations: `src/generic/context.ts:10-14`, `src/generic/analysis/project.ts:9-21,36-54`, `src/generic/runtime/snapshot-files.ts:6-7,27-29`.

The approved design requires the manifest to supply source roots, the selected tsconfig path and excluded output paths. `TargetManifest` supplies none of these. Analysis always uses root `tsconfig.json` and walks the full root using a fixed set of directory basenames; snapshots use a separate fixed set. Consequently a standard project selecting `tsconfig.app.json` cannot express that selection, a custom output such as `out/` is included in the rollback boundary, and a legitimate source directory named `src/build/` is silently excluded. The analysis and snapshot sets also differ (`.nuxt`, `.artifacts`, `vibedebt-artifacts`), so exclusion semantics are not one shared declared boundary. Analysis budgets are configurable only through the low-level map API; preparation always uses defaults.

This is a material missing generalization requirement, even though RealWorld fits the hard-coded defaults. It can cause incomplete source inventory to appear complete, unrelated trees to consume resources, and valid verification output to be treated as an unexpected source mutation.

Fix direction: add validated versioned project/ownership settings to the manifest, bind them into the configuration hash, and thread the effective settings through map, preview, extraction, snapshot and recovery. Use canonical relative path boundaries and prune before descent. Retain safe default exclusions and explicit source limits. Add focused coverage for a non-default tsconfig, a restricted source root, a custom generated-output path, and consistent snapshot/map ownership. Ensure the effective configuration dependencies used to authorize a plan participate in stale-plan validation.

### Spec compliance and evidence assessment

- The supported extraction is generic by AST shape and resolved bindings, retains per-call token reads and arrow wrappers, rejects several unsafe shapes, and uses the same in-memory builder for preview/application. Existing source hashes and absent-destination checks are enforced before writes. The exact already-extracted form is handled as a no-op.
- Analysis runs enumeration and semantics in a supervised worker with parent deadlines and a heap limit. Syntax evidence does not invoke the legacy VibeMart detectors. Partial worker results are reported as incomplete. The missing manifest scope controls are covered by I3.
- Browser scenarios are benchmark data outside the generic runner. Fresh contexts, pre-navigation HTTP interception, controlled clock/storage, strict header/body comparisons, required-request counts and hash-bound observations are present. The checked-in tests exercise actual browser behavior, unexpected traffic, cancellation and independent request-order tolerance. No target-module imports appear in the boundary runner.
- On the normal failure path, supervised command/app/browser resources finish cleanup before snapshot restoration; restoration evidence and restored browser evidence are distinct. Snapshot inventories retain dirty/untracked/ignored included files and reject owned links/hard links. I1 concerns the final success decision; I2 concerns the optional supplemental Git path.
- Current `package.json` correctly places pinned Playwright in runtime dependencies, and CI installs Chromium/system dependencies before browser tests. Existing CLI registration changes are additive.
- I inspected `outputs/realworld/acceptance.json` and its report: revision `28e1e43fdfcaa8d10baad6212d34f815dcbb1bba`, documented user-approved import-case admission patch, clean native checks passing and browser 6/6; corrupted native typecheck/build/tests passing, actual Authorization assertions containing `Bearer` on article/favorite/current-user paths, 4 failed journeys, byte restoration matching, and restored browser 6/6. These support the claimed exercised-behavior preservation and type-correct regression detection. Benchmark admission is no longer pending and is not a review blocker.
- The saved engine test report records 118 total, 117 passed, zero failed, one POSIX-mode skip on Windows. The controller reports final root typecheck/build exit 0. The independent reviewer did not rerun tests or installs, consistent with the read-only review instructions; cross-platform execution is not inferred from a configured CI workflow.

Review scope: current generic/benchmark/CLI source, acceptance harness, generic tests, approved design and plan, implementer reports, saved acceptance and engine-test artifacts, package/CI configuration, and captured source diff. Current files took precedence over older diff contents. No application/source edits, installs, test executions, Git mutations or additional agents were performed. Only this requested review section was appended.

## Scoped re-review

Date: 2026-11-15. This review is limited to the I1-I3 fix wave and its regression tests; it does not repeat or expand the whole-change review.

- **I1 addressed:** `verifySnapshot` now throws on an incomplete inventory. The transaction also explicitly rejects an incomplete comparison, checks the wider included boundary, and compares each planned output with its exact preview text before success. The new real hard-link regression checks failure despite passing functional gates, leaves `rolledBack: false` when safe restoration cannot proceed, and exercises explicit recovery after removal of the unsupported entry. The allowed-file post-preview change regression covers the added exact-content audit.
- **I2 addressed:** the generic transaction now uses `createTargetCheckpoint(snapshot)`, not the legacy checkpoint implementation. It requires Git's canonical top-level to equal the target root before any object/ref write, removes inherited `GIT_*` overrides, starts an empty separate index, and inserts only validated captured file blobs and modes. The disposable-repository tests check ancestor rejection without ref/index changes, captured dirty/ignored bytes, exclusion of unignored dependency/custom-output content, and HEAD/index preservation.
- **I3 substantially addressed, with one CLI integration correction still required at this inspection:** shared normalized boundary settings now drive manifest validation, source enumeration, extraction path validation and persisted snapshot exclusions. Selected and owned inherited tsconfigs participate in plan hashes. Legitimate nested build source is covered, custom output is pruned, and old snapshots retain their original any-depth exclusion policy. Snapshot recovery itself does not demand that deleted source roots still exist. However, `target-recover` first calls `readManifest`, whose `normalizeBoundary` invocation still requires configured source roots and an explicitly selected tsconfig to exist. If either was deleted before an abrupt interruption, the CLI refuses before calling the recovery API capable of recreating it. Recovery-mode manifest loading must retain lexical/canonical safety validation without these current-existence requirements, with a regression through the actual CLI for a deleted configured source root and config.

Scoped verdict at this inspection: I1 and I2 closed; I3 awaits the narrow recovery preflight correction. No additional broad-review findings were introduced. Reported fix-wave validation is 28/28 analysis/extraction tests and 27 passed/one platform skip for runtime, with strict checks passing. Controller-level transaction regressions and renewed actual RealWorld acceptance were still running when this section was first written. The reviewer did not rerun tests or mutate source; the earlier successful acceptance remains valid historical evidence, not proof of the subsequent fix wave.

### Final narrow recovery follow-up

The remaining I3 recovery preflight correction has been inspected and is **addressed**. `readManifest(file, { recovery: true })` disables only the boundary's current source-root/config existence preconditions. The `target-recover` action alone selects this mode; ordinary manifest consumers and analysis/snapshot preparation retain strict defaults. Relative-path validation, canonical containment, excluded-path checks, target/artifact separation and target-root checks remain active. Saved snapshot identity, entry and blob validation remain authoritative before restoration.

The new `tests/generic-recovery-cli.test.ts` invokes the emitted production CLI after deleting both the configured source directory and the custom tsconfig directory. It asserts successful restoration and the original source/config bytes. The controller reported the regression failed before the fix and then passed with the manifest integration tests (5/5). Saved transaction review evidence records 9/9 passing tests, including the real incomplete-inventory and exact-preview-content cases. No independent test rerun was performed.

**Final scoped verdict: I1, I2 and I3 are closed. No unresolved Important or Critical finding remains from this review.** Final refreshed whole-suite/typecheck/build and actual RealWorld acceptance results remain the controller's verification gate; this scoped approval does not infer those in-progress results. Earlier findings and intermediate verdicts above are retained as the review history.

## Final verification after scoped approval

Both actual RealWorld runs passed again using the reviewed boundary/checkpoint/final-audit implementation. The complete engine suite passed135 tests with0 failures and1 POSIX-only skip on Windows (136 total). Typecheck/build passed. VibeMart was reset and matched pristine. No Important or Critical review findings remain.
