# Tracking upstream driver.js

Fork point: tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63` of https://github.com/nilbuild/driver.js (see `NOTICE.md`).

## Policy

- Nothing in this project waits for upstream. Every feature lands in `packages/core/src/engine/` directly.
- Review cadence: on every upstream release, and at least once a quarter, a maintainer reads the upstream changelog (`apps/docs/src/content/guides/changelog.mdx`) and records the review in the log below with a verdict per entry.
- Cherry-pick security fixes and bug fixes in code the fork still shares (anything under `src/engine/` whose logic was not rewritten). New upstream features are not adopted by default.
- Ignore changes to hints, checklists, the Astro playground, the docs site, and the `tsdown` build.
- A fix that applies upstream may be offered back as a pull request. It never blocks anything here.

## Mechanics

- Add the upstream repository as a git remote named `upstream`; fetch tags only when reviewing.
- Upstream paths are `packages/driver/src/<file>` and ours are `packages/core/src/engine/<file>`. Apply a cherry-pick with a path rewrite:
  `git format-patch -1 <sha> --stdout | git apply -p4 --directory=packages/core/src/engine --3way`
- Every cherry-pick commit message carries `Upstream: <sha>` and the upstream version.
- After a cherry-pick, run the ported engine suite first, then the whole suite.

## Review log

| Date | Upstream version | Reviewer | Verdict per changelog entry |
|---|---|---|---|
