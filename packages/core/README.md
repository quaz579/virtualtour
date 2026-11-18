# virtualtour

Commands, run from the repository root:

- `npm ci`: install dependencies
- `npm run typecheck`: strict TypeScript check
- `npm run build`: build `packages/core/dist`

## More commands

- `npm test` runs both Vitest projects (`unit-node`, `unit-dom`).
- `npm run e2e` runs Playwright on chromium, firefox, webkit, and edge when installed (skipped otherwise).
- `npm run size` builds and prints gzip sizes; `npm run size -- --write` refreshes `SIZE.md`.
- `UPDATE_FORK_POINT=1 npm test -- test/fork-point.node.test.ts` regenerates `test/fixtures/fork-point.sha256` after a deliberate engine change.
