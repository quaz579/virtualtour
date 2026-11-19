import { defineConfig } from "vitepress";

export default defineConfig({
  title: "VirtualTour",
  description: "Guided tours and onboarding for the web, forked from driver.js.",
  lang: "en-US",
  cleanUrls: true,
  srcExclude: ["plan/**", "README.md"],
  cacheDir: "./node_modules/.vitepress-cache",
  outDir: "./.vitepress/dist",
  ignoreDeadLinks: false,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Cookbook", link: "/cookbook/custom-counter" },
      { text: "API", link: "/api/config" },
      { text: "Avatar", link: "/avatar/" },
      { text: "Migration", link: "/migration/from-driverjs" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "How it works", link: "/guide/how-it-works" },
          { text: "Steps and targets", link: "/guide/steps-and-targets" },
          { text: "Positioning", link: "/guide/positioning" },
          { text: "Overlay", link: "/guide/overlay" },
          { text: "Events and lifecycle", link: "/guide/events-and-lifecycle" },
          { text: "Action steps", link: "/guide/action-steps" },
          { text: "Keyboard and focus", link: "/guide/keyboard-and-focus" },
          { text: "Persistence", link: "/guide/persistence" },
          { text: "JSON tours", link: "/guide/json-tours" },
          { text: "Styling", link: "/guide/styling" },
          { text: "Containers", link: "/guide/containers" },
          { text: "Accessibility", link: "/guide/accessibility" },
          { text: "Framework wrappers", link: "/guide/framework-wrappers" },
          { text: "Presenters", link: "/guide/presenters" },
          { text: "Motion", link: "/guide/motion" },
        ],
      },
      {
        text: "Cookbook",
        items: [
          { text: "Custom counter", link: "/cookbook/custom-counter" },
          { text: "Advancing programmatically", link: "/cookbook/advancing-programmatically" },
          { text: "Scroll lock", link: "/cookbook/scroll-lock" },
          { text: "Sanitizing HTML", link: "/cookbook/sanitizing-html" },
          { text: "Multiple tours", link: "/cookbook/multiple-tours" },
        ],
      },
      {
        text: "API",
        items: [
          { text: "Tour configuration", link: "/api/config" },
          { text: "Step configuration", link: "/api/step" },
          { text: "Tour and step objects", link: "/api/tour" },
        ],
      },
      {
        text: "Avatar",
        items: [{ text: "Avatar reference", link: "/avatar/" }],
      },
      {
        text: "Migration",
        items: [{ text: "From driver.js", link: "/migration/from-driverjs" }],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/quaz579/virtualtour" }],
  },
});
