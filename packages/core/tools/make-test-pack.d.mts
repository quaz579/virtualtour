export const COLUMNS: number;
export const ROWS: number;
export const FRAME_SIZE: number;
export const FIXTURE_DIR: string;
export function buildTestPack(): Map<string, Buffer>;
export function writeTestPack(dir?: string): void;
