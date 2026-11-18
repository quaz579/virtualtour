# Tools

## Prose lint

`npm run lint:prose` scans every Markdown file and TypeScript source file for banned words, so the
library stays generic. The word list is merged from three sources; blank lines and lines starting
with `#` are ignored in each:

1. `tools/banned-words.txt`, committed and intentionally empty apart from comments.
2. `tools/banned-words.local.txt`, gitignored, one word or phrase per line. Create it on each machine.
3. The optional `BANNED_WORDS` environment variable, comma-separated, useful in CI secrets.

Matching is case-insensitive and whole-word. `driver.js`, its repository URL, and its author's
copyright line are allow-listed. Never commit words to the list; add them to the local file or the
environment variable instead.
