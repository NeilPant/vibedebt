# Contributing to VibeDebt

Thank you for your interest in contributing to **VibeDebt**!

## Code Quality Standards

1. **Strict File Modularity**: Keep every engine source file in `src/` strictly under **250 lines of code** with **zero `any` types**.
2. **Protected Benchmark Boundaries**: Never modify `fixtures/vibe-mart-pristine/**`, `tests/fixture-invariants.test.ts`, or `scripts/reset-fixture.js`.
3. **Hermetic Reset**: Always run `node scripts/reset-fixture.js` before and after test runs.
4. **Mandatory Verification**: Every pull request must pass:
   ```bash
   npx tsc --noEmit
   npx vitest run
   ```

## Development Workflow

1. Fork the repository and clone your fork.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Run tests locally:
   ```bash
   npx vitest run
   ```
4. Build the CLI binary:
   ```bash
   npm run build
   ```
5. Submit a pull request describing the refactoring transform, smell detector, or characterization anchor enhancement.
