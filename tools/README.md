# Tools

## Prose lint

`npm run lint:prose` scans every `.md`, `.mdx`, `.ts`, `.tsx`, `.mts`, `.mjs`, `.json`, `.html` and `.css` file (skipping `node_modules`, `dist`, `.git`, `test-results`, `playwright-report`, `coverage` and `package-lock.json`) for banned words, so the
library stays generic. The word list is merged from three sources; blank lines and lines starting
with `#` are ignored in each:

1. `tools/banned-words.txt`, committed and intentionally empty apart from comments.
2. `tools/banned-words.local.txt`, gitignored, one word or phrase per line. Create it on each machine.
3. The optional `BANNED_WORDS` environment variable, comma-separated, useful in CI secrets.

Matching is case-insensitive and whole-word. `driver.js`, its repository URL, and its author's
copyright line are allow-listed. Never commit words to the list; add them to the local file or the
environment variable instead.

With zero words loaded the lint passes trivially. Set `REQUIRE_BANNED_WORDS=1` to make that case exit
non-zero. When `CI` is set and zero words load, the lint prints a loud warning instead.

## Upstream apply

`node tools/upstream-apply.mjs <sha> [--dry-run]` applies one driver.js commit to this fork with the path and class-name rewrites described in `UPSTREAM.md`. It never commits, and refuses patches that touch removed or moved files (exit code 2).
