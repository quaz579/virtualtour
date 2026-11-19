export interface ExtractedLink {
  line: number;
  target: string;
  kind: "link" | "include";
}
export interface BrokenLink {
  file: string;
  line: number;
  target: string;
  reason: string;
}
export function extractLinks(text: string): ExtractedLink[];
export function checkLinks(options: { root: string }): BrokenLink[];
