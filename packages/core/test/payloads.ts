export const FLAG = "__vtPwned";

export const PAYLOADS: Record<string, string> = {
  script: `<script>window.${FLAG}=1</script>`,
  img: `<img src=x onerror="window.${FLAG}=1">`,
  link: `<a href="javascript:window.${FLAG}=1">go</a>`,
  svg: `<svg onload="window.${FLAG}=1"></svg>`,
};

const URL_ATTRS = ["href", "src", "xlink:href", "action", "formaction"];

export function stripSanitizer(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const el of Array.from(template.content.querySelectorAll("*"))) {
    if (/^(script|style|iframe|object|embed)$/i.test(el.tagName)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const isJs = URL_ATTRS.includes(name) && /^\s*javascript:/i.test(attr.value);
      if (name.startsWith("on") || isJs) el.removeAttribute(attr.name);
    }
  }
  return template.innerHTML;
}

export function findExecutable(root: ParentNode): string[] {
  const found: string[] = [];
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (el.tagName.toLowerCase() === "script") found.push("script");
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) found.push(`${el.tagName.toLowerCase()}[${name}]`);
      if (URL_ATTRS.includes(name) && /^\s*javascript:/i.test(attr.value)) found.push(`${el.tagName.toLowerCase()}[${name}=javascript:]`);
    }
  }
  return found;
}

export const pwned = (): unknown => (window as unknown as Record<string, unknown>)[FLAG];
