# RealWorld acceptance evidence

Both required acceptance runs passed on 2026-11-15.

## Reproducible admitted baseline

- Upstream: unlight/react-typescript-realworld-example-app, revision 28e1e43fdfcaa8d10baad6212d34f815dcbb1bba.
- User-approved admission patch: benchmarks/patches/register-import-case.patch.
- Patch SHA256: cdfa4bec26fc18a92da10127f7377002df750f87bed6ad866b3fd7b2e9cd649e.
- The patch changes only App.tsx's Register import casing before anchor capture.
- Installed compatibility versions: TypeScript 4.5.4, react-hook-form 7.22.5, @types/node 16.11.26, @types/babel__traverse 7.17.1.
- The upstream checkout stays unchanged. Each run has an independent workspace/dependency tree, with synthetic API responses and credentials.

## Results

| Gate | Clean extraction | Type-correct mutation |
| --- | --- | --- |
| Native tsc --noEmit | Passed | Passed |
| Native production build | Passed | Passed |
| Existing Jest suite | Passed, 2 tests | Passed, 2 tests |
| Frozen behavioral anchors | 6 passed | 4 failed, 2 passed |
| Transaction outcome | Accepted, exactly 3 source files | Rejected and restored |
| Byte restoration | Not needed | Matched original admitted source manifest |
| Browser replay after restoration | Not needed | 6 passed |

The mutation changes the helper's literal authorization prefix from Token to Bearer. Actual outgoing authorization assertions fail; this is not a simulated verifier failure or a typecheck failure.

The extraction moves pure options construction from the two service wrappers to src/api/authorization-options.ts. Existing per-call session reads remain in those wrappers. The applied change set matches the preview. The admission patch is not counted as part of that extraction.

The same anchor bundle remained unchanged across both runs. Its configuration/source envelope hash is 7229f1f8b59851714644d3fab67851183ebc389dabd52552ed1e391e94a1e79e.

## Detailed evidence

The adjacent acceptance.json contains native command outputs, extraction before/after text, actual HTTP assertion failures, recovery snapshot locations and restored-suite results. Full external run artifacts are retained at:

C:\Users\tamil\Downloads\VibeDebt-benchmarks\acceptance-WvCxg8

The engine's complete regression result is saved separately as engine-tests.json. General runtime tests also exercise dirty/untracked/binary restoration, Git HEAD/index preservation, excluded links, process-tree cleanup and cancellation.

## Limits

These results establish preservation of exercised frontend behavior against controlled API responses, not complete semantic equivalence or backend-security correctness. Source/configuration restoration excludes dependencies and generated outputs.

Parallel implementers completed scoped tests and self-reviews. After an initial quota error, independent review completed successfully. All three Important findings were fixed and closed by scoped re-review; both acceptance runs and the full engine suite then passed again. Engine verification: 135 passed, zero failed, one POSIX-only mode test skipped on Windows. Typecheck/build passed.
