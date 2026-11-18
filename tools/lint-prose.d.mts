export interface Violation {
  file: string;
  line: number;
  word: string;
}
export function parseWordList(text: string): string[];
export function loadBannedWords(options?: {
  committedFile?: string;
  localFile?: string;
  env?: Record<string, string | undefined>;
}): string[];
export function findViolations(text: string, words: string[]): { line: number; word: string }[];
export function lintProse(options: { root: string; words: string[] }): Violation[];
