@AGENTS.md

# Testing & Verification Guidelines

- **Routine Verification:** For UI, styling, copy, or component changes, **ONLY** run `npm run typecheck` (`tsc --noEmit`) to verify correctness.
- **Do NOT run E2E tests automatically:** Never run `npm test` or `npm run test:e2e` automatically after small changes. Playwright browser tests take significant time and should not be run for minor edits.
- **Unit Tests:** Run `npm run test:unit` only if modifying core backend logic, pricing calculations, or authentication utilities.
- **Explicit Request Only:** Only run the full test suite (`npm test` or `npm run test:e2e`) when the user explicitly asks to run E2E tests.
