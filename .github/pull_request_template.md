## Description

Please include a summary of the changes, problem solved, or refactoring transform added.

## Type of Change

- [ ] New smell detector (`src/cartographer/`)
- [ ] New AST transform / refactoring heuristic (`src/healer/`)
- [ ] Behavioral anchor synthesizer improvement (`src/anchor/`)
- [ ] Bug fix / edge case handling
- [ ] Documentation / benchmark additions

## Checklist

- [ ] Every modified/added file in `src/` is strictly under **250 lines**.
- [ ] Zero explicit `any` types added (`tests/code-quality.test.ts` passes).
- [ ] Protected files untouched (`fixtures/vibe-mart-pristine/**`, `tests/fixture-invariants.test.ts`).
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npx vitest run` passes with 100% success.
