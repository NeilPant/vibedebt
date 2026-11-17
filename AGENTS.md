# VibeDebt — Autonomous Engineering Contract (AGENTS.md)

## 1. Non-Stop Autonomous Execution Rule
- You are operating in **Autonomous Marathon Mode**.
- Do NOT stop after scaffolding or finishing a single file/phase to ask the user "Would you like me to continue?".
- Maintain `PLAN.md` in the root directory. Work sequentially through every unchecked milestone (`- [ ]`) until EVERY milestone in `PLAN.md` is marked `- [x]` and both `npx tsc --noEmit` and `npx vitest run` pass with 0 errors.

## 2. Hard Workspace Boundaries
- **NEVER modify or delete**:
  - `fixtures/vibe-mart-pristine/**`
  - `tests/fixture-invariants.test.ts`
  - `scripts/reset-fixture.js`
- Whenever any test or refactoring pass modifies `fixtures/vibe-mart/`, always run `node scripts/reset-fixture.js` before and after E2E tests so tests remain 100% repeatable and idempotent.

## 3. Architectural & Code Quality Standards
- **Tech Stack**: Node.js (ESM with `.js` import extensions in TypeScript), TypeScript 5.8 (`strict: true`), `ts-morph`, `commander`, `vitest`, React 19.
- **Strict File Modularity**: Keep every file under `src/` clean, strongly typed (zero `any`), and under 250 lines.
- **Verification Gate**: At the end of each milestone in `PLAN.md`, run:
  1. `npx tsc --noEmit`
  2. `npx vitest run`
  If either fails, diagnose the root cause and fix it immediately before moving to the next milestone.
