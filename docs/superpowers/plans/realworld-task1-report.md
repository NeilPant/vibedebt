# Task 1 implementation and verification

Implemented the fixed Task 1 public APIs in `src/generic/analysis/index.ts` and `src/generic/extraction/index.ts`. Ownership remained within those two subtrees, the two owned tests, and this report. No fixture, legacy module, package file, common contract, Git state, or target source was changed.

## Analyzer

- Enumeration, effective-tsconfig interpretation, syntax inventory and candidate semantics run in a supervised worker. The parent owns separate inventory and semantic timers, terminates the worker before settling, and receives heap failures as incomplete diagnostics.
- Defaults: 2,000 admitted implementation files, 2 MiB per file, 32 MiB total, 30-second inventory, 60-second semantics, 512 MiB old-generation heap.
- Dependency/output/cache/Git/artifact directories are pruned before descent. Links/junctions are ignored in discovery. File-byte budgets apply before ts-morph parses the effective project's application sources. Tests remain available as read-only context but cannot be production candidates or selected mutation sources.
- Effective compiler options retain aliases, JSX and decorators. The first pass inventories declaration kinds/names, functions, classes, imports/specifiers/local bindings/type-only markers, exports, hook calls and HTTP-shaped calls, with one-based source locations and line counts. Hook evidence recognizes named-import aliases. These are syntax observations: an HTTP-shaped `.get` call does not prove network traffic, and a hook-shaped name does not prove React semantics. No references or type queries are used to obtain this evidence. Only selected candidate semantics invoke symbol/type/reference operations. Reports distinguish resolved supported candidates from unsupported candidates with rejection evidence. Dependency declaration files and TypeScript libraries are semantic context, not inventory/mutation inputs.
- Worker bootstrapping supports both emitted `.js` deployment and Node 24 source `.ts` execution without changing ESM import conventions.

## Structural operation

- Explicit selectors must resolve to undecorated synchronous instance arrow properties with one constant provider call and one return expression. Provider-property symbols and return types must resolve. Getters, extra statements/effects, unresolved or non-string token types, unsupported callers, computed/spread/shorthand properties and unsupported constructions fail closed.
- The supported construction is nested property-assignment object literals containing one conditional leaf: the resolved token, one literal-prefix/template-token interpolation, and global `undefined`. Local token identifiers are replaced by symbol identity. AST printing normalizes formatting while retaining meaningful literal whitespace.
- The helper accepts the token; the original arrow wrapper, token provider expression, invocation count, `this` binding and call sites remain. The original undefined-valued property and prefix remain observable. Relative import extension conventions follow existing relative imports.
- Preparation constructs exact before/after text in memory. It rejects existing destinations unless all wrappers and the helper match the exact supported already-extracted form, which produces a hash-checked no-op.
- Canonical component validation rejects escapes, links, junctions, excluded destinations and Windows alternate-stream paths. Relevant non-dependency semantic declaration paths receive the same validation, preventing a compiler-followed source junction from silently authorizing extraction.
- Plans hash admitted sources, selected local semantic declaration context, tsconfig and package configuration. Application checks all hashes, every destination and every before-text before its first write. New files use exclusive creation. Wider transaction restoration remains the runtime/controller's responsibility; crash-atomic multi-file writes are outside this operation's guarantee.

## Test-first evidence

The initial 12 tests all failed against explicit `not implemented` API exports. After implementation they passed. Additional focused regression cycles observed these concrete failures before fixes:

1. Different literal prefixes differing only by a space were incorrectly accepted.
2. An unrelated source tree outside tsconfig consumed the admitted source budget.
3. A reserved helper keyword generated invalid source.
4. Explicitly selected test files were incorrectly eligible for mutation.
5. A provider declaration reached through a junction outside the root was incorrectly accepted by compiler resolution.
6. An arbitrary component's general syntax evidence was absent: the map exposed only file paths. A new test first failed on missing line/function/class fields, then passed with declarations, aliased React hook/import bindings, named exports and exact HTTP/hook locations.

Other coverage exercises configured aliases; excluded poison outputs; file/count/aggregate budgets; independent parent inventory and semantic deadlines; actual execution of extracted code with absent, present and empty tokens; wrapper binding and per-call reads; effects/getters/type rejection; destination collisions; stale sources; stale no-op helper bytes; path traversal and destination junctions.

## Verification results

- Initial delivery: **19 passed (19), 2 files passed**, duration 30.41 seconds. An intermediate run hit Vitest's default five-second case deadline in the multi-worker stale-plan test under concurrent load; the three tests performing multiple full semantic operations now have explicit 15-second case deadlines. Production worker deadlines were unchanged. General-inventory follow-up final run: **20 passed (20), 2 files passed**, duration 34.54 seconds, using `npx vitest run tests/generic-analysis.test.ts tests/generic-extraction.test.ts --reporter=verbose`.
- Isolated strict TypeScript checking of both entry points, the worker and both owned tests passed with zero diagnostics.
- Isolated emission of owned code, followed by an actual emitted `.js` worker map/prepare/apply/reprepare on a temporary project passed: complete map, one resolved candidate, two changes, exact helper output and `noop: true` on repetition. This was not an engine-wide build. Generated verification files were removed after verification.
- The general-inventory follow-up also passed isolated strict checking and emitted-worker execution: an arbitrary exported function and its `fetch` call were reported with declaration/export evidence and exact source positions. Generated verification files were removed again.
- An emitted-worker read-only map of the original pinned target admitted 85 application files and reported both selected wrappers as unresolved. A read-only extraction preview rejected the same missing provider binding. Target dependency modules (`ky`, `njct`, `rsts`) were absent; the controller subsequently identified unavailable upstream `rsts@1.0.0`. Checks were not weakened to admit this baseline.
- Every owned engine source file remains below 250 lines; no explicit `any` or benchmark application symbol/name appears in the generic engine.
- Full engine build, full tests, fixture reset and target acceptance were intentionally left to the controller, as explicitly required by concurrent ownership instructions.

## Limits

The operation is a conservative supported-template transformation, not a general purity/equivalence proof. Unsupported syntax and unresolved evidence reject extraction. Watchdogs demonstrate bounded failure, not guaranteed completion for every project. Config includes/excludes use an internal conventional glob matcher over a pruned inventory; this is intentionally limited to filesystem-backed TypeScript configurations and does not claim support for custom compiler hosts. Dependency/output trees are read-only semantic context where applicable and remain outside extraction writes and recovery scope.

## Review follow-up: declarative source boundary

Added `BoundaryOptions` to `AnalysisOptions` and the optional third `AnalysisOptions` argument to `prepareExtraction`. Both entry points now merge numeric defaults with shared normalized boundary settings before worker dispatch, including omitted options. Numeric validation explicitly examines the six resource keys; array/string boundary settings are never treated as numbers.

The worker enumerates only declared source roots and calls shared `excludedPath` before descending. Shared default exclusions govern both enumeration and extraction paths: dependency/cache exclusions apply at their configured depth, conventional root output names are root-relative, and custom relative exclusions are honored. Legitimate `src/build` source directories remain admissible. Source-root links and excluded-output junctions are handled without walking their children.

The selected tsconfig is relative to the target root; its includes, aliases and `baseUrl` are interpreted relative to that configuration's own directory. An explicitly missing config rejects the operation, while an absent implicit root default retains the supported fallback. Extraction validates both selected sources and destinations against declared source roots and exclusions, hashes the selected configuration and owned inherited configuration/context files, and carries the boundary into application-time validation. A configuration appearing after a config-free preview is stale evidence and rejects application.

Four new regression tests first failed against the previous implementation: custom configuration/alias/source-root mapping with poison output, explicit-missing config behavior, custom configuration hashes/staleness, and excluded/outside-root selections or destinations. Follow-up tests cover successful custom-config apply/no-op recognition, inherited-config staleness, newly appeared default configs, legitimate `src/build` inventory/extraction, and an excluded junction to an outside poison tree. The structural extraction template was not broadened.

Scoped strict no-emit checking passes with zero diagnostics. Final boundary run: `npx vitest run tests/generic-analysis.test.ts tests/generic-extraction.test.ts --reporter=verbose` — **28 passed (28), 2 files passed**, 49.84 seconds. The largest owned source module is 88 lines and the generic subtrees contain no explicit `any`. No full suite, build, legacy edit, shared-boundary edit or Git operation was performed in this review wave.
