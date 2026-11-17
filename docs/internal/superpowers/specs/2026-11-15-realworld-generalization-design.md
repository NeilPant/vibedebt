# VibeDebt: second-application generalization

Date: 2026-11-15
Status: Implemented and verified; independent review findings closed. Benchmark revision and admission amendments below are explicitly user approved.
Selected approach: Capability-based core with declarative benchmark configuration.

## Intent and evidence boundaries

Prove that the existing map -> anchor -> heal pipeline can support an independently structured React/TypeScript application without VibeMart-specific assumptions. The second benchmark is unlight/react-typescript-realworld-example-app, now pinned to user-approved revision 28e1e43fdfcaa8d10baad6212d34f815dcbb1bba (see revision amendment).

Revision amendment (2026-11-15): installation of the original pin failed because rsts@1.0.0 is unavailable from npm (the tarball returns 404). After initially retaining that pin, the user explicitly approved trying upstream revision 28e1e43fdfcaa8d10baad6212d34f815dcbb1bba. This earlier revision retains both authorization helpers under src/api and uses React 17, Vite 2, Jest and published @hqoss/monads. This revision is the accepted upstream base; the admitted test baseline additionally includes the approved casing correction below. The original checkout/diagnostics remain for provenance. Paths and target-native commands below referring to the inspected original are historical context; the current benchmark manifest supplies the earlier revision's actual paths and commands. Both acceptance criteria remain unchanged.

Approved admission precondition (2026-11-15): the user subsequently approved exactly one source correction before baseline capture: src/app/App.tsx changes its Register import from './register' to './Register' to match the Git directory casing. The checked-in patch is benchmarks/patches/register-import-case.patch, SHA256 cdfa4bec26fc18a92da10127f7377002df750f87bed6ad866b3fd7b2e9cd649e. Validate that hash and git apply --check, then apply the patch independently to each run copy before native gates and anchor capture. Never include it in the measured three-file authorization extraction diff. Rollback restores this admitted pre-extraction baseline, including the casing correction; it does not remove the approved precondition. Report the upstream revision AND patch hash; do not describe acceptance as testing byte-identical upstream source.

This revision's .npmrc explicitly disables package-lock and no lock is committed. Installation therefore uses npm 8.19.2 install --package-lock=false --ignore-scripts, then an explicit esbuild rebuild. Match the historical compatible installed versions typescript 4.5.4, react-hook-form 7.22.5, @types/node 16.11.26 and @types/babel__traverse 7.17.1 using no-save, no-lock installation; retain the installed dependency graph externally. This avoids obsolete unused watcher installers and modern declaration syntax without changing the application's package.json or creating an upstream lockfile. Native tscheck, build and test:r must all pass afterward. The supplied acceptance runner copies the admitted installed dependency tree independently into each run workspace without sharing mutable directories.

The milestone has two required runs from the same original baseline:

1. Clean extraction: apply one bounded authorization-header extraction and pass the unchanged behavioral anchors and target-native verification.
2. Fault injection: apply the same extraction, introduce a type-correct authorization defect, demonstrate that the behavioral anchors fail, and restore the original source/configuration state with byte verification.

These are exercised-behavior preservation and regression-detection results. They are not semantic-equivalence, complete coverage, zero-flakiness, backend-security or arbitrary-application guarantees. Multiple successful replays provide stability evidence only. Intent similarity can nominate duplicate candidates; it cannot authorize a merge. External research statistics and citations remain outside product claims until separately audited. Differential fuzzing is a later, separately designed layer.

## Goals, non-goals and failure conditions

Goals:

- Reuse analysis, boundary characterization, a conservative AST operation, and transaction orchestration across targets.
- Keep benchmark-specific filenames, scenarios and protocol data in configuration/test assets, outside reusable engine logic.
- Exercise the actual RealWorld frontend, router, session storage and services through browser/HTTP boundaries.
- Produce an exact preview from the same transformation builder used for execution.
- Demonstrate restoration after an actual behavioral failure that passes target typechecking.
- Preserve VibeMart compatibility and its existing protected files.
- Bound parsing and verification resource use and report incomplete work honestly.

Non-goals:

- Automatic journey discovery, autonomous domain decomposition, generalized loading-hook extraction, polyglot support, graph databases, embeddings, eBPF or LLM-directed edits.
- Fixing existing RealWorld behavior, upgrading its framework/toolchain, implementing missing features, or certifying backend authentication.
- Replacing the application's API/session implementation with test-only application code.
- Restoring arbitrary server data, excluded dependency trees or generated outputs through a source snapshot.
- Making this milestone a publishing, deployment or automatic PR-creation workflow.

Failure conditions include: hard-coded RealWorld names in the generic transformation, recaptured expectations after editing, verification against the wrong workspace, a mutation rejected only by typecheck, claiming rollback without checking bytes, silent fallback to a live public API, or an incomplete scan reported as clean.

## Current implementation and required seams

- src/cartographer/astScanner.ts excludes node_modules but scans broadly beneath the target, omits the target's tsconfig, and has no worker watchdog or source budget.
- src/cartographer/smellDetector.ts mixes reusable AST normalization/reference analysis with VibeMart pricing/coupon/tax/shipping filters.
- src/contracts/types.ts restricts duplicate categories to VibeMart domains and models anchors as one public entry/test file.
- src/anchor/index.ts requires named VibeMart exports and src/index.ts. Its synthesizer imports the application facade and invokes reset helpers.
- src/anchor/anchorIdentity.ts validates that facade import rather than a browser scenario bundle.
- src/healer/prepareHealing.ts and domainExtractor.ts select named VibeMart files/functions.
- src/healer/index.ts unconditionally runs the VibeMart invariant suite.
- src/verification/vitestRunner.ts captures process.cwd() as a global workspace and resolves VibeDebt's tools.
- src/healer/rollbackGuard.ts already snapshots original bytes but recursively includes dependencies and rejects links across that entire tree.
- src/healer/gitCheckpoint.ts already provides a separate-index checkpoint ref; it is a recovery artifact, not the automatic restoration implementation.

Retain these existing behaviors behind an explicit legacy VibeMart capability. The RealWorld execution path must not import VibeMart scenarios, domain recipes, invariants or reset scripts. Existing protected files remain untouched.

## Approaches considered

1. Application adapters: each application supplies analysis rules, scenarios and bespoke transformations. Lowest migration effort, but risks two independently hard-coded implementations. Retain only the legacy compatibility adapter from this approach.
2. Independent capabilities plus declarative configuration: separate project discovery, behavioral runner, supported AST operation and rollback. Configuration selects and parameterizes them. This is the user's selected approach because it demonstrates reusable behavior without requiring autonomous planning.
3. Graph-driven planning and automated exploration: infer journeys and decomposition obligations over a richer dependency/effect graph. Closer to the research blueprint, but combines several unproven systems and makes this acceptance gate harder to diagnose. Defer.

## Architecture and contracts

A target context carries the canonical target root, logical benchmark ID, upstream revision, effective project configuration, source manifest, artifact root and explicit executable/argument/cwd records. Avoid global process.cwd() assumptions.

Independent capabilities:

- Project analyzer: discovers scoped files and reports topology, evidence, candidate locations, completeness and rejected/unsupported cases.
- Boundary runner: starts/stops the target and controlled API environment, captures a frozen scenario bundle, and verifies it without application imports.
- Structural operation: evaluates explicit candidate preconditions and builds a file-change plan in memory.
- Target verifier: executes configured target-native commands and the selected boundary bundle, retaining separate results for every gate.
- Transaction manager: locks the canonical target, snapshots its owned file boundary, applies allowed changes, verifies, and restores on failure.

Version the new contracts. Keep legacy API/report consumers working through additive fields or adapters rather than silently changing existing field meanings. Represent unsupported and incomplete analysis explicitly. A missing runner/test result is a failure, never a zero-failure success.

The declarative benchmark manifest supplies source roots, tsconfig path, excluded outputs, command records, API matching rules, journeys, candidate selectors and destination. It contains data and supported operations rather than arbitrary JavaScript callbacks. The exact JSON schema, capability names and internal module partition are left to the builder.

For this benchmark the candidate selectors name the two authorization properties in src/api/user.service.ts and src/api/article.service.ts, and the destination is src/api/authorization-options.ts. These names belong in benchmark configuration, not engine conditions.

## Benchmark isolation and baseline admission

Use an external benchmark root, defaulting to a VibeDebt-benchmarks sibling directory outside the VibeDebt project. Make its absolute location configurable. Reject roots overlapping the engine, VibeMart fixtures, protected paths, or artifact storage.

Retain a pristine checkout of the pinned upstream revision. Create independent run-1 and run-2 working copies with their own browser contexts, target identities, ports and artifact directories. Each run begins from the pinned original state, not from the other run's output. Dependencies may be prepared before baseline admission; the transformation never installs packages.

Do not copy or link node_modules through the mutation snapshot. Prefer independent dependency installation per runnable workspace; a cache may accelerate installation without making mutable dependency trees shared. The benchmark is disposable, but the transaction still preserves any pre-existing included untracked files.

Before recording anchors:

1. Verify the pinned revision and configuration hashes.
2. Resolve the target's installed tools and run npm run tscheck, npm run build, and npm run test:r from that target root, with finite timeouts.
3. Start the actual frontend and establish passing boundary journeys.
4. Record source/configuration manifests and baseline evidence.

Do not assume this upstream revision is currently green; it has only been inspected, not installed or executed in this design stage. If baseline commands fail because of environment/toolchain compatibility, diagnose using an appropriate runtime first. Changes to upstream source, lockfile or framework versions require a documented decision; do not quietly alter the benchmark until it passes. Existing application bugs unrelated to the extraction are recorded and preserved.

A disposable clone supplies its own Git root; never use the inherited user-home Git repository as the benchmark recovery boundary.

## Scoped and bounded ts-morph analysis

Parse the target's effective tsconfig, preserving baseUrl, paths, JSX and decorator options. Determine candidate source files from its includes, then intersect them with declared source roots and canonical target boundaries.

Prune node_modules, dist, build, coverage, .git, .vite, caches, generated outputs and VibeDebt artifacts before recursively enumerating directories. Ignore symlinks/junctions for source discovery; report an unresolved source dependency if it matters to the selected transformation. Exclude test files from production smell/mutation candidates, while allowing target-native test execution and read-only project context.

Use two stages:

1. Syntax inventory over admitted source files: declarations, imports, exports, hooks, HTTP-call evidence and candidate AST shapes.
2. Candidate-focused semantic analysis: resolve bindings/types/references needed for the selected operation and its relevant local dependency closure.

Do not perform repository-wide findReferencesAsNodes for every variable during the first pass. Keep legacy expensive detectors out of the default generic inventory. Reuse a project within an operation rather than reparsing per candidate.

Dependency declaration files and TypeScript libraries may be read as semantic context; they are not inventoried, scored or mutated. Excluding dependency implementations does not mean disabling all type information. Missing or ambiguous semantic evidence rejects the operation.

Agent-selected initial limits, exposed as explicit settings:

- 2,000 application source files; 2 MiB per source file; 32 MiB total application source.
- 30 seconds for enumeration/inventory; 60 seconds for candidate semantics.
- 512 MiB worker V8 heap limit; parent watchdog terminates a worker that exceeds a deadline.

Run enumeration and analysis inside the supervised worker so a blocked event loop cannot defeat a timer in that same worker. Return a structured timeout/resource-limit/incomplete result with useful diagnostics. Source budgets bound admitted application input; the heap limit also covers semantic context. No completeness or mutation authorization follows from a partial result. The requirement is bounded failure and responsive orchestration, not an absolute promise that every repository completes analysis.

## Boundary characterization and controlled API responses

Use an engine-owned Playwright runner outside the target source tree. Application interaction occurs through browser navigation, DOM actions, browser storage and observed HTTP traffic. Generated anchors must not import application modules, instantiate application services, call reset helpers, or invoke private functions through injected browser code.

The frontend currently points at an external API. Intercept its configured API requests at the browser network boundary and fulfill them using deterministic, scenario-owned responses; keep the application's API configuration and service code unchanged. Install interception before navigation and handle page reloads. Never contact the live public backend during acceptance.

This milestone uses controlled responses, not a claim of recorded production traffic. Response fixtures describe the test environment; expected frontend observations are captured from the original application. Synthetic tokens contain suitable JWT-shaped payloads and no real credentials. Use a controlled browser clock for token-expiry cases.

For each journey, configure supported actions, checkpoints and observation fields. Observe relevant UI text/state, URL, storage outcomes and outgoing request method, URL, selected headers and JSON payload. Match requests strictly enough to distinguish the injected authorization defect, while tolerating semantically irrelevant ordering of independent requests. Unknown requests, unconsumed required interactions and failed request assertions fail verification. Return synthetic denial responses as needed so the UI completes and the mismatch is visible in the report.

Allow loopback application assets. Fulfill any necessary external styles/fonts from declared harness assets or eliminate that dependency at the harness boundary; do not introduce live-network passthrough. Use fresh contexts per journey and fresh API fixture state. Browser isolation resets browser state; the controlled API harness independently resets its state. Neither relies on a source reset script.

Required journey evidence:

- Successful login through the UI, expected request body, session persistence across reload, and authenticated navigation.
- Rejected login with the original application's observed error presentation.
- Authenticated settings load exercising UserService authorization.
- An authenticated article operation, such as favorite/unfavorite, exercising ArticleService authorization.
- Logout removes the session and restores the original observed unauthenticated behavior.
- A logged-out API request preserves the original absent-authorization behavior.
- Token-expiry or malformed-token behavior is characterized as observed, without changing policy.

Use request matching for both services so a helper invoked by only one caller cannot satisfy the gate. Where a backend denial is not surfaced by the UI, the request assertion still fails the behavioral suite.

Capture a baseline, then verify the frozen bundle on three fresh executions as admission/stability evidence. No expected output may be silently updated, masked or recaptured after extraction. Declare any normalization in advance; do not normalize authorization values, request bodies or relevant error outcomes.

Store the versioned scenario bundle, controlled-response fixtures, observations and hashes outside the mutable target. Bind them to logical benchmark ID, upstream revision, scenario/environment configuration and baseline provenance. Bind each execution separately to its canonical run root. This permits the same immutable anchor bundle to be replayed in both pristine-derived working copies without treating a changed physical path as a different behavior specification.

## Bounded authorization extraction

The selected operation extracts the equivalent token-to-header object construction into a pure function, retaining small existing service wrappers.

Semantic requirements:

- Each wrapper reads its own existing session provider at the same invocation point and the same number of times.
- The helper accepts the obtained token as an argument; it performs no storage access, injection, HTTP calls, clock reads or caching.
- Preserve the Authorization key, original Token prefix, conditional handling of empty/undefined tokens and object structure, including an undefined property value where present.
- Preserve arrow-property wrappers, this binding, initialization order and existing callers.
- Do not merge service objects, rewrite all ky clients, alter error handling or move auth policy.
- Use syntax compatible with the target's TypeScript version and existing import conventions.

Before constructing a plan, resolve the selected symbols and property-access bindings and verify the supported AST template, relevant types, free-variable boundary and caller references. Text similarity and the existing alpha-normalized signature alone are insufficient. The operation can support an explicitly parameterized simple construction; it must fail closed on getters, extra effects, decorators on the selected member, async bodies, unresolved aliases, name collisions or unsupported shapes. No claim of general purity inference is required.

The initial destination exports a named helper returning the original options shape. Verify that the destination is absent. Do not overwrite an existing file. A repeat invocation recognizes the exact supported already-extracted form and returns a documented no-op; an ambiguous partial extraction is rejected.

Use the same in-memory builder for preview and execution. A preview reports exact affected files and before/after text, preconditions and candidate evidence; it does not start the app, capture anchors, acquire mutation locks or create checkpoints. A previously produced plan must be revalidated against current source hashes before application.

The initial write allowlist is the two service files plus the new helper file. No fixture, application config, package or lockfile changes belong to the extraction. Validate all canonical destinations and resolved parents before any write.

## Verification orchestration and runtime lifecycle

Run engine checks in the engine workspace and target checks in the target workspace. The RealWorld path never appends tests/fixture-invariants.test.ts or invokes scripts/reset-fixture.js. VibeMart's existing fixture tests may retain their protected fixture lifecycle.

After applying the extraction, run target npm run tscheck, build, existing test:r, and the immutable boundary suite. Report each command/result separately. Existing upstream tests are allowed to use internal imports; the no-application-import rule applies to VibeDebt's boundary anchors.

Serve a fresh process for verification, using a reserved loopback port and a readiness probe. Stop prior app processes before mutation/restoration so development watchers cannot race with writes. Manage browser/API state afresh for each verification execution.

Agent-selected initial deadlines:

- 120 seconds per target command; 60 seconds for server readiness.
- 30 seconds per browser journey; 180 seconds for the complete boundary suite.
- Parent-owned process-tree cleanup after timeout or cancellation, including Windows descendants; record failure if termination/restoration cannot be confirmed.

The builder may choose platform process-management details but must demonstrate bounded teardown. Do not introduce implementation-stage dependencies merely to write this design.

## Snapshot and Git recovery

The generic transaction uses a canonical source/configuration manifest, not an application reset script and not a hard Git reset.

Capture all files and directories within the declared owned workspace boundary, including existing untracked and ignored source/configuration files. Exclude only declared dependency/output/cache paths and root Git metadata. Keep run artifacts outside that boundary. Record relative paths, file bytes, hashes, directory existence and applicable file modes; reject unsupported links/special files inside the owned boundary before applying. Excluded node_modules links must not be traversed or rejected as source links.

The operation writes only its validated allowlist. Snapshot the wider owned boundary so unexpected modifications are detectable; reject successful completion if changes escape the plan's allowlist. Refuse to proceed if included files change between baseline verification, snapshot and application. This milestone assumes exclusive control of its disposable run workspace; filesystem locking is not protection against arbitrary external editors.

On verification failure, mutation exception, timeout or handled cancellation:

1. Stop supervised app/browser/verification processes.
2. Restore original bytes and applicable modes, recreate deleted original directories/files, and remove newly created included files/directories.
3. Re-enumerate the owned boundary and compare paths, types and hashes against the pre-extraction snapshot.
4. Replay the frozen anchors on the restored baseline, with fresh runtime state.
5. Report failure, restoration status and evidence separately.

Restoration failure must not be reported as rolledBack=true. Retain external recovery artifacts and stop for intervention. Do not continue healing after a failed restore.

Retain an external on-disk snapshot until acceptance/restoration verification completes. This also permits an explicit recovery command after abrupt process death; crash-atomic multi-file writes and automatic recovery from machine failure are outside this milestone. Handled cancellation is covered.

Optional Git checkpoints use the existing separate-index/ref strategy, scoped to the target's actual Git root. Respect source ownership/exclusions, preserve HEAD, branch and real index, and retain the recovery ref after failure. Git checkpoints do not replace the snapshot's preservation of untracked/ignored included files. Operation must also work without a Git repository.

Verify that unrelated files, excluded dependency trees and Git HEAD/index are not changed by the structural operation. Generated build/cache outputs may change during verification; they are explicitly outside the byte-restoration guarantee and can be discarded only inside the disposable run workspace.

## Acceptance evidence

Both runs consume the same frozen anchor bundle and controlled-response assets, whose hashes are checked before and after execution.

Run 1: clean extraction

- Begin from the pinned original source manifest with a passing admitted baseline.
- Complete scoped map and report both selected candidates with resolved evidence.
- Preview the supported extraction and verify execution matches the preview.
- Apply only the three allowed source-file changes.
- Pass target tscheck, build, existing tests and unchanged behavioral anchors.
- Demonstrate that both service paths exercise the helper through observed HTTP behavior.
- Retain source diff, manifest, anchor hashes and separate gate results.

Run 2: type-correct behavioral mutation

- Begin from an independent copy of the same original source/configuration baseline.
- Use the same admitted frozen anchors, without recapture.
- Apply the normal extraction.
- A test-only fault injector changes the helper's authorization prefix from Token to Bearer after application and before normal verification. This is a test harness facility, not a production CLI option or a change to expected results.
- Require the target's actual npm run tscheck to succeed on the corrupted tree.
- Execute the unchanged boundary suite and require failure from an outgoing authorization assertion on an exercised service path. A simulated verifier failure, timeout, syntax/type error, absent request or only a source-hash mismatch does not satisfy this gate.
- Let the real transaction failure path restore the original snapshot, including deleting the extracted helper.
- Verify included path/type/byte hashes against the original manifest, then pass the baseline boundary replay.
- Retain the fault description, passing typecheck result, actual failing assertion, rollback evidence and restored replay result.

Also verify rejection of unsupported/colliding candidates before writes; wrong-target/stale anchors; stale plans; finite analysis timeout with no mutation; protection from symlink/path escapes; excluded-tree pruning; snapshot restoration of pre-existing dirty/untracked files; and preservation of Git HEAD/index where present.

## Agent-selected decisions and builder discretion

Agent-selected decisions for user review:

- Pin the inspected upstream revision rather than following a moving branch.
- Start with pure authorization-options construction while retaining service wrappers and per-call token reads.
- Use browser-boundary controlled responses; make no live-backend/security claim.
- Keep Playwright and run artifacts engine-owned, outside target source and dependencies.
- Use source snapshots as automatic recovery, with Git refs as optional supplemental recovery.
- Use the initial finite budgets/deadlines above; resource exhaustion blocks healing.
- Treat incompatible upstream baseline/toolchain requirements as an admission issue, not permission to modify the benchmark silently.

Left to the builder: internal schema/type names, module boundaries, stable locator selection after inspecting the running UI, exact worker/process-tree implementation, dependency pin selection for the browser runner, and implementation task decomposition. Preserve strict typing and the engine's source-file size rule.

Before implementation planning, the user approves this design and any remaining substantive decisions raised by the builder check. Dependency additions and the multi-file implementation are implementation-plan scope; this document creates no authorization to install or change them yet.

Builder check: a fresh independent software-engineering reviewer read this draft on 2026-11-15 and reported "nothing important left." No additional user decisions were identified. The agent-selected decisions above remain visible for design approval.

## Primary sources and local references

Implementation evidence: [acceptance report](../../../docs/benchmark-artifacts/realworld/acceptance-report.md).
Final engine regression: 136 tests, 135 passed, zero failed, one POSIX-only mode test skipped on Windows. Both actual RealWorld runs passed again after the review fixes; clean anchors 6/6, type-correct mutation rejected by four journeys, byte restoration verified, restored replay 6/6.

Final review clarifications: manifests expose boundary.sourceRoots, boundary.tsconfig and boundary.excludedPaths. Analysis and snapshots share root-relative output exclusions and any-depth dependency/cache exclusions; legitimate src/build sources remain admitted. Saved snapshots persist their scope, and old snapshots retain their original policy. Generic Git checkpoints reject inherited ancestor repositories and use captured owned blobs exclusively. Incomplete final inventories and any file differing from preview.after prevent acceptance. Recovery-only manifest validation permits missing source/config paths while retaining target/path safety checks.

External code inspected for this design, not executed:

- Pinned repository: https://github.com/unlight/react-typescript-realworld-example-app/tree/f9b47563e68cdd9d647ed8fc617f3c7d98858fee
- Package scripts: https://github.com/unlight/react-typescript-realworld-example-app/blob/f9b47563e68cdd9d647ed8fc617f3c7d98858fee/package.json
- TypeScript config: https://github.com/unlight/react-typescript-realworld-example-app/blob/f9b47563e68cdd9d647ed8fc617f3c7d98858fee/tsconfig.json
- User service: https://github.com/unlight/react-typescript-realworld-example-app/blob/f9b47563e68cdd9d647ed8fc617f3c7d98858fee/src/application/api/user.service.ts
- Article service: https://github.com/unlight/react-typescript-realworld-example-app/blob/f9b47563e68cdd9d647ed8fc617f3c7d98858fee/src/application/api/article.service.ts
- Session behavior: https://github.com/unlight/react-typescript-realworld-example-app/blob/f9b47563e68cdd9d647ed8fc617f3c7d98858fee/src/application/api/session.service.ts
- Router: https://github.com/unlight/react-typescript-realworld-example-app/blob/f9b47563e68cdd9d647ed8fc617f3c7d98858fee/src/app/App.tsx
- API configuration: https://github.com/unlight/react-typescript-realworld-example-app/blob/f9b47563e68cdd9d647ed8fc617f3c7d98858fee/src/application/api/config.ts

Local baseline: README.md, PLAN.md, AGENTS.md and the src files listed in Current implementation and required seams. This milestone does not reinterpret the completed VibeMart milestones as completion of this design.

