# Contributing to VibeDebt

Thank you for your interest in contributing to **VibeDebt**!

---

## 🗺️ Engine Architecture Map

VibeDebt is organized into modular subsystems under `src/`:

```
src/
├── cartographer/      # Phase 1: AST scanner & smell detectors (ts-morph)
│   ├── astScanner.ts      # Scans functions, components, state hooks, imports
│   ├── smellDetector.ts   # Detects duplicate logic, orphaned state, API mismatches
│   └── index.ts           # Public cartographer API & topology generator
├── anchor/            # Phase 2: Black-box behavioral test synthesizer
│   ├── contractExtractor.ts # Discovers public boundaries & exported signatures
│   ├── vitestSynthesizer.ts # Synthesizes deterministic Vitest suites
│   └── index.ts           # Captures runtime golden vectors & writes anchor tests
├── healer/            # Phase 3: Transactional architectural refactorer
│   ├── domainExtractor.ts   # Extracts pure domain logic into domain/ modules
│   ├── componentRewriter.ts # Rewires imports and removes dead state
│   ├── rollbackGuard.ts     # In-memory snapshot & byte-level rollback
│   └── index.ts             # Orchestrates heal transaction & gate verification
├── generic/           # Reusable multi-repo analysis & boundary runtime
│   ├── analysis/          # Scoped project syntax analysis & budget guards
│   ├── browser/           # Playwright journey capture & assertion replay
│   ├── extraction/        # Generalized AST candidate transforms
│   └── runtime/           # Supervised process management & Git checkpoints
├── reporter/          # Markdown PR report & offline HTML visualizer
├── contracts/         # Shared TypeScript interfaces (TopologyReport, HealResult)
└── cli/               # Commander CLI entry points & generic command adapters
```

---

## 🛡️ Protected Benchmark Boundaries

To ensure benchmarks remain reproducible and mathematically honest, the following paths are **strictly protected**:
- `fixtures/vibe-mart-pristine/**`: The golden immutable benchmark copy.
- `tests/fixture-invariants.test.ts`: Invariant tests verifying business logic.
- `scripts/reset-fixture.js`: Fixture restoration utility.

Tests automatically restore the fixture before and after each run via Vitest `globalSetup` in `tests/setup-fixture.ts`.

---

## 📏 Code Quality Standards (Enforced by Tests)

1. **Strict File Modularity**: Every file under `src/` must remain strictly under **250 lines of code**.
2. **Zero `any` Types**: No explicit `any` types permitted anywhere in `src/`.
   - *Enforcement*: Continuously asserted by `tests/code-quality.test.ts` on every test run and in CI.
3. **Strict TypeScript**: TypeScript 5.8 with `strict: true` and Node ESM `.js` import specifiers.

---

## 🛠️ How to Add a Smell Detector

Smell detectors inspect the AST to detect anti-patterns. To add a new detector:

1. Open `src/cartographer/smellDetector.ts`.
2. Implement your detection logic operating on `SourceFile` or AST nodes:
   ```typescript
   export function detectUnusedAsync(sourceFiles: SourceFile[]): SmellOccurrence[] {
     const occurrences: SmellOccurrence[] = [];
     for (const file of sourceFiles) {
       for (const fn of file.getFunctions()) {
         if (fn.isAsync() && !fn.getText().includes('await')) {
           occurrences.push({
             file: file.getFilePath(),
             line: fn.getStartLineNumber(),
             name: fn.getName() ?? 'anonymous',
             reason: 'Async function without await keyword',
           });
         }
       }
     }
     return occurrences;
   }
   ```
3. Wire the detector into `src/cartographer/index.ts` within `analyzeCodebase()`.
4. Add a unit test in `tests/cartographer.test.ts`.

---

## 🔧 How to Add a Transform

Transforms safely restructure code behind the rollback guard:

1. Open `src/healer/domainExtractor.ts` (or `src/generic/extraction/builder.ts`).
2. Construct your AST transform as a pure in-memory operation:
   - Identify candidate nodes using `ts-morph`.
   - Extract shared pure logic into a new target file.
   - Replace call sites with imported helper references.
3. Add a shape guard in `src/healer/shapeGuard.ts` to ensure unsupported private shapes fail closed before disk writes.
4. Add verification tests in `tests/healer-e2e.test.ts`.

---

## 🧪 Verification Before Opening a PR

Run both gates locally before submitting your pull request:
```bash
npx tsc --noEmit
npx vitest run
```

### 🌐 Browser Tests & Playwright

Some end-to-end integration tests (`generic-browser.test.ts`, `generic-transaction.test.ts`) exercise browser journeys via Playwright.
Install the Chromium browser locally with:
```bash
npx playwright install chromium
# Or with system dependencies on Linux:
npx playwright install --with-deps chromium
```
If Chromium is not installed, browser-dependent test suites automatically skip with an advisory message (`run npx playwright install chromium`) without failing your local run. Continuous Integration runs install Chromium and execute the complete suite.
