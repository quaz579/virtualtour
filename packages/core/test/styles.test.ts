import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import postcss from "postcss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../src/index";
import type { Tour } from "../src/index";
import { setCurrentTour } from "../src/registry";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const baseCss = read("src/styles/base.css");
const themeCss = read("src/styles/theme.css");
const engineCss = read("src/engine/styles/engine.css");
const stylesMd = read("STYLES.md");
const allCss = [baseCss, themeCss, engineCss].join("\n");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "thumbtack" ? [] : sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

const sourceText = sourceFiles(resolve(root, "src"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")
  .replace(/\$\{(?:ns|namespace)\}/g, "<ns>")
  .replace(/\$\{FIXED_PREFIX\}/g, "vt");

const stylesSections = stylesMd.split(/^#{2,3} /m).slice(1);
const exempt = /^(Reserved|Author-applied)/;

function documentedTokens(pattern: RegExp, { includeExempt }: { includeExempt: boolean }): string[] {
  const found = new Set<string>();
  for (const section of stylesSections) {
    if (!includeExempt && exempt.test(section)) continue;
    for (const match of section.matchAll(/`([^`]+)`/g)) {
      const token = match[1] as string;
      if (pattern.test(token)) found.add(token);
    }
  }
  return [...found];
}

const CLASS_TOKEN = /^(<ns>|vt)-[\w*<>-]+$/;
const VARIABLE_TOKEN = /^--vt-[\w-]+$/;
const ATTRIBUTE_TOKEN = /^data-vt-[\w-]+$/;

function cssClasses(css: string): Set<string> {
  const out = new Set<string>();
  postcss.parse(css).walkRules((rule) => {
    for (const match of rule.selector.matchAll(/\.(vt-[\w-]+)/g)) out.add(match[1] as string);
  });
  return out;
}

function cssAttributes(css: string): Set<string> {
  const out = new Set<string>();
  postcss.parse(css).walkRules((rule) => {
    for (const match of rule.selector.matchAll(/\[(data-vt-[\w-]+)/g)) out.add(match[1] as string);
  });
  return out;
}

function cssVariables(css: string): Set<string> {
  return new Set(css.match(/--vt-[\w-]+/g) ?? []);
}

describe("stylesheets", () => {
  it("parse without errors", () => {
    for (const css of [baseCss, themeCss, engineCss]) expect(() => postcss.parse(css)).not.toThrow();
  });

  it("a parser rejects broken CSS, so the parse check means something", () => {
    expect(() => postcss.parse(".vt-popover { color: red;")).toThrow();
  });

  it("base.css is under 5 KB raw and theme.css under 4 KB raw", () => {
    expect(Buffer.byteLength(baseCss)).toBeLessThan(5 * 1024);
    expect(Buffer.byteLength(themeCss)).toBeLessThan(4 * 1024);
  });

  it("base.css alone styles the popover and carries the marker", () => {
    const decls = new Map<string, string>();
    postcss.parse(baseCss).walkRules(".vt-popover", (rule) => {
      rule.walkDecls((decl) => {
        decls.set(decl.prop, decl.value);
      });
    });
    expect(decls.get("--vt-base")).toBe("1");
    expect(decls.get("background-color")).toMatch(/^#/);
    expect(decls.get("color")).toMatch(/^#/);
    expect(decls.get("box-shadow")).toBeTruthy();
  });

  it("base.css imports the engine stylesheet", () => {
    expect(baseCss).toMatch(/^@import "\.\.\/engine\/styles\/engine\.css";/);
  });

  it("theme.css does not set the base marker", () => {
    expect(themeCss).not.toContain("--vt-base");
  });
});

describe("STYLES.md matches the shipped CSS", () => {
  it("lists every variable used by the stylesheets, and nothing the stylesheets lack", () => {
    const documented = new Set(documentedTokens(VARIABLE_TOKEN, { includeExempt: true }));
    const used = cssVariables(allCss);
    expect([...used].filter((name) => !documented.has(name))).toEqual([]);
    expect([...documented].filter((name) => !used.has(name))).toEqual([]);
  });

  it("documents every class that a stylesheet selects", () => {
    const documented = documentedTokens(CLASS_TOKEN, { includeExempt: true });
    const exact = new Set(documented.filter((token) => !token.includes("*")));
    const prefixes = documented.filter((token) => token.endsWith("*")).map((token) => token.slice(0, -1));
    const missing = [...cssClasses(allCss)].filter((name) => !exact.has(name) && !prefixes.some((prefix) => name.startsWith(prefix)));
    expect(missing).toEqual([]);
  });

  it("documents every attribute that a stylesheet selects", () => {
    const documented = new Set(documentedTokens(ATTRIBUTE_TOKEN, { includeExempt: true }));
    expect([...cssAttributes(allCss)].filter((name) => !documented.has(name))).toEqual([]);
  });

  it("every documented class or attribute is emitted by the source", () => {
    const tokens = [...documentedTokens(CLASS_TOKEN, { includeExempt: false }), ...documentedTokens(ATTRIBUTE_TOKEN, { includeExempt: false })];
    const missing = tokens.filter((token) => !sourceText.includes(token.replace(/\*$/, "")) && !sourceText.includes(token.replace(/^<ns>/, "${ns}")));
    expect(missing).toEqual([]);
  });

  it("the class tables are complete against names()", async () => {
    const { names } = await import("../src/engine/core/namespace");
    const documented = new Set(documentedTokens(CLASS_TOKEN, { includeExempt: true }));
    const wildcard = (value: string) => [...documented].some((token) => token.endsWith("*") && value.startsWith(token.slice(0, -1)));
    const n = names("zz");
    const fixedClasses = [
      ...Object.entries(n.popover)
        .filter(([key, value]) => typeof value === "string" && !/Id$/.test(key))
        .map(([, value]) => value as string),
      n.layer,
      n.liveRegion,
    ];
    expect(fixedClasses.filter((value) => !documented.has(value) && !wildcard(value))).toEqual([]);
    const namespaced = [n.active, n.fade, n.simple, n.noScroll, n.target, n.targetBlocked, n.targetRaised, n.extra, n.targetParent, n.overlay, n.overlayAnimated];
    expect(namespaced.map((value) => value.replace(/^zz/, "<ns>")).filter((value) => !documented.has(value))).toEqual([]);
  });

  it("documents the theme variables with their light defaults", () => {
    const declared = new Map<string, string>();
    postcss.parse(themeCss).walkRules(":where(:root)", (rule) => {
      if (rule.parent?.type !== "root") return;
      rule.walkDecls(/^--vt-/, (decl) => {
        declared.set(decl.prop, decl.value);
      });
    });
    for (const name of ["--vt-accent", "--vt-bg", "--vt-fg", "--vt-muted", "--vt-radius", "--vt-space", "--vt-shadow", "--vt-font", "--vt-enter-duration"]) {
      expect(declared.has(name), name).toBe(true);
    }
    for (const name of ["--vt-accent", "--vt-bg", "--vt-fg", "--vt-muted", "--vt-radius", "--vt-space", "--vt-enter-duration"]) {
      expect(stylesMd, name).toContain(`\`${declared.get(name)}\``);
    }
  });
});

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function schemeColors(selectorPattern: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  postcss.parse(themeCss).walkRules((rule) => {
    if (!selectorPattern.test(rule.selector)) return;
    rule.walkDecls(/^--vt-(accent|bg|fg|muted)$/, (decl) => {
      out[decl.prop.slice(5)] = decl.value;
    });
  });
  return out;
}

describe("theme.css colors", () => {
  const light = { ...schemeColors(/^:where\(:root\)$/) };
  const dark = { ...light, ...schemeColors(/^:where\(\[data-vt-theme="dark"\]\)$/) };

  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s text, muted text and primary button text meet 4.5:1, accent meets 3:1", (_name, colors) => {
    const { accent, bg, fg, muted } = colors as Record<string, string>;
    expect(contrast(fg as string, bg as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted as string, bg as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(bg as string, accent as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accent as string, bg as string)).toBeGreaterThanOrEqual(3);
  });

  it("the forced light block matches the root defaults", () => {
    const forced = schemeColors(/^:where\(\[data-vt-theme="light"\]\)$/);
    expect(Object.keys(forced).sort()).toEqual(["accent", "bg", "fg", "muted"]);
    expect(forced).toEqual(light);
  });

  it("scheme selectors have zero specificity so author overrides win", () => {
    postcss.parse(themeCss).walkRules((rule) => {
      if (rule.parent?.type === "root" || rule.parent?.type === "atrule") {
        if (/--vt-/.test(rule.toString()) && /(:root|data-vt-theme)/.test(rule.selector)) expect(rule.selector.startsWith(":where("), rule.selector).toBe(true);
      }
    });
  });

  it("the media-query dark block matches the forced dark block", () => {
    const media: Record<string, string> = {};
    postcss.parse(themeCss).walkAtRules("media", (at) => {
      if (!at.params.includes("prefers-color-scheme: dark")) return;
      at.walkDecls(/^--vt-/, (decl) => {
        media[decl.prop] = decl.value;
      });
    });
    const forced: Record<string, string> = {};
    postcss.parse(themeCss).walkRules((rule) => {
      if (rule.selector !== ':where([data-vt-theme="dark"])') return;
      rule.walkDecls(/^--vt-/, (decl) => {
        forced[decl.prop] = decl.value;
      });
    });
    expect(Object.keys(forced).length).toBeGreaterThan(0);
    expect(media).toEqual(forced);
  });

  it("the entrance animation only runs when motion is allowed", () => {
    const unguarded: string[] = [];
    postcss.parse(themeCss).walkDecls("animation", (decl) => {
      let guarded = false;
      for (let node: postcss.Node | undefined = decl.parent; node; node = node.parent) {
        if (node.type === "atrule" && (node as postcss.AtRule).params.includes("prefers-reduced-motion: no-preference")) guarded = true;
      }
      if (!guarded) unguarded.push(decl.value);
    });
    expect(unguarded).toEqual([]);
    expect(themeCss).toContain("@keyframes vt-enter");
  });

  it("the focus ring uses the accent on every interactive part", () => {
    let outline = "";
    postcss.parse(themeCss).walkRules((rule) => {
      if (!rule.selector.includes(".vt-button:focus-visible") || !rule.selector.includes(".vt-popover-footer-btn:focus-visible")) return;
      rule.walkDecls("outline", (decl) => {
        outline = decl.value;
      });
    });
    expect(outline).toBe("2px solid var(--vt-accent)");
    expect(themeCss).toMatch(/\.vt-popover-close-btn:focus-visible,\s*\.vt-popover-footer-btn:focus-visible \{\s*outline/);
  });
});

describe("missing stylesheet warning", () => {
  const created: Tour[] = [];
  const addStyle = (css: string) => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  };

  beforeEach(() => {
    document.head.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
    tours.off();
    setCurrentTour(null);
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  const make = () => {
    const tour = createTour({ animate: false, steps: [{ id: "a", title: "A", body: "a" }, { id: "b", title: "B", body: "b" }] });
    created.push(tour);
    return tour;
  };
  const warnings = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.filter((call) => String(call[0]).includes("base.css is not loaded"));

  it("warns once per tour when the marker is absent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = make();
    await tour.start();
    await tour.forward();
    expect(warnings(warn)).toHaveLength(1);
    tour.finish();
    await tour.start();
    expect(warnings(warn)).toHaveLength(1);
  });

  it("does not warn when base.css is present", async () => {
    addStyle(baseCss.replace(/^@import[^\n]*\n/, ""));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await make().start();
    expect(warnings(warn)).toHaveLength(0);
  });

  it("does not warn when the marker is injected by hand", async () => {
    addStyle(".vt-popover { --vt-base: 1; }");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await make().start();
    expect(warnings(warn)).toHaveLength(0);
  });

  it("warns when only theme.css is loaded", async () => {
    addStyle(themeCss);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await make().start();
    expect(warnings(warn)).toHaveLength(1);
  });

  it("never warns in a production build", async () => {
    vi.stubGlobal("__DEV__", false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await make().start();
    expect(warnings(warn)).toHaveLength(0);
  });
});
