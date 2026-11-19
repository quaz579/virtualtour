export const UPSTREAM_URL: string;
export const UPSTREAM_SRC: string;
export const ENGINE_SRC: string;
export const REFUSED_FILES: readonly { path: string; reason: string }[];
export const KNOWN_POPOVER_CLASSES: readonly string[];
export const CLASS_TABLE: Readonly<Record<string, string>>;
export function rewriteClassStrings(text: string, unmapped?: Set<string>): string;
export function rewritePatch(patch: string): {
  patch: string;
  refused: { file: string; reason: string }[];
  skipped: string[];
  unmapped: string[];
};
export interface RunResult {
  status: number | null;
  stdout?: string;
  stderr?: string;
}
export function main(
  argv: string[],
  io?: {
    run?: (command: string, args: string[], options?: Record<string, unknown>) => RunResult;
    log?: (line: string) => void;
    error?: (line: string) => void;
  },
): number;
