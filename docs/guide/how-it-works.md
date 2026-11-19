# How it works

Placeholder: the full page arrives with the docs work. This section is the part written with the upstream tooling.

## Tracking upstream

VirtualTour's engine is a fork of driver.js at tag `1.12.1`. The fork never waits for upstream, but fixes to code we still share are worth having.

- A maintainer reads the upstream changelog on every release and at least once a quarter, and records a verdict for every entry in [`UPSTREAM.md`](https://github.com/quaz579/virtualtour/blob/main/UPSTREAM.md).
- `node tools/upstream-apply.mjs <sha>` takes one upstream commit, rewrites its paths and class names to ours, and stages it with a three-way apply. It never commits and leaves conflicts for you.
- It refuses commits that touch hints, checklists or the popover stylesheet, because those files were removed or moved.
- Commits made this way carry an `Upstream: <sha> (<version>)` trailer.

See `UPSTREAM.md` for the policy, the review log and the table of which fork tasks changed each engine file.
