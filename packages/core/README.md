# virtual-site-tour

Guided product tours and onboarding for the web: spotlight an element, explain it in a popover, walk users through your app. MIT, ESM only, no runtime dependencies, derived from driver.js.

[Live demo](https://quaz579.github.io/virtualtour/) · [Docs and quickstarts](https://github.com/quaz579/virtualtour#readme) · React: [`virtual-site-tour-react`](https://www.npmjs.com/package/virtual-site-tour-react) · Vue: [`virtual-site-tour-vue`](https://www.npmjs.com/package/virtual-site-tour-vue)

```sh
npm install virtual-site-tour
```

```html
<button id="save">Save</button>
<button id="start-tour">Take the tour</button>
```

```ts
import "virtual-site-tour/base.css";
import "virtual-site-tour/theme.css";
import { createTour } from "virtual-site-tour";

const tour = createTour({
  id: "welcome",
  dim: true,
  steps: [
    {
      id: "save",
      target: "#save",
      placement: { side: "bottom", align: "start" },
      title: "Save your work",
      body: "Changes stay in this browser until you press Save.",
    },
    { id: "done", title: "You're all set", body: "Press Done to close the tour." },
  ],
});

document.querySelector("#start-tour")?.addEventListener("click", () => {
  void tour.start();
});
```

Entry points: `virtual-site-tour`, `virtual-site-tour/avatar`, `virtual-site-tour/motion`; stylesheets `virtual-site-tour/base.css` (required), `theme.css` and `avatar.css`. The exported names are listed in `API-FREEZE.md` in the repository, the class and variable names in `STYLES.md`, and the release history in `CHANGELOG.md`.

## For AI coding assistants

This package ships `llms.txt` (the full public API in plain text) and `skills/integrate-virtualtour/SKILL.md` (a step-by-step integration skill). Copy the skill into a project with `cp -R node_modules/virtual-site-tour/skills/integrate-virtualtour .claude/skills/`.
