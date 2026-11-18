import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

export const COLUMNS = 4;
export const ROWS = 4;
export const FRAME_SIZE = 32;
export const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../e2e/fixtures/test-pack");

const PALETTE = [
  [230, 25, 75], [60, 180, 75], [255, 225, 25], [0, 130, 200],
  [245, 130, 48], [145, 30, 180], [70, 240, 240], [240, 50, 230],
  [210, 245, 60], [250, 190, 212], [0, 128, 128], [220, 190, 255],
  [170, 110, 40], [255, 250, 200], [128, 0, 0], [170, 255, 195],
];

const GLYPHS = [
  ["111", "101", "101", "101", "111"],
  ["010", "110", "010", "010", "111"],
  ["111", "001", "111", "100", "111"],
  ["111", "001", "111", "001", "111"],
  ["101", "101", "111", "001", "001"],
  ["111", "100", "111", "001", "111"],
  ["111", "100", "111", "101", "111"],
  ["111", "001", "001", "001", "001"],
  ["111", "101", "111", "101", "111"],
  ["111", "101", "111", "001", "111"],
];

const GLYPH_SCALE = 3;

const ANIMATIONS = [
  { name: "rest", frames: [0], ms: 500, loop: true, classic: "RestPose" },
  { name: "wave", frames: [1, 2, 3], ms: 90, loop: false, still: 0, classic: "Wave" },
  { name: "think", frames: [4, 5], ms: 120, loop: true, pixels: true, classic: "Thinking" },
  { name: "blink", frames: [6], ms: 80, classic: "IdleBlink" },
  { name: "wobble", frames: [7], ms: 80, classic: "IdleWobble" },
  { name: "look", frames: [8], ms: 80, classic: "IdleLook" },
  { name: "point-left", frames: [9], ms: 80, classic: "GestureLeft" },
  { name: "point-right", frames: [10], ms: 80, classic: "GestureRight" },
  { name: "point-up", frames: [11], ms: 80, classic: "GestureUp" },
  { name: "point-down", frames: [12], ms: 80, classic: "GestureDown" },
  { name: "point-any", frames: [13], ms: 80, classic: "Explain" },
  { name: "celebrate", frames: [14], ms: 200, loop: true, classic: "Congratulate" },
  { name: "alert", frames: [15], ms: 150, classic: "Alert" },
  { name: "exit", frames: [3, 2, 1], ms: 90, loop: false, classic: "GoodBye" },
];

const ROLES = {
  rest: "rest",
  idle: ["blink", "wobble", "look"],
  greet: "wave",
  point: { left: "point-left", right: "point-right", up: "point-up", down: "point-down", any: "point-any" },
  think: "think",
  celebrate: "celebrate",
  exit: "exit",
  alert: "alert",
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function fillRect(rgb, sheetWidth, x0, y0, size, color) {
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) {
      const at = (y * sheetWidth + x) * 3;
      rgb[at] = color[0];
      rgb[at + 1] = color[1];
      rgb[at + 2] = color[2];
    }
  }
}

function drawFrame(rgb, sheetWidth, index) {
  const { col, row } = gridOf(index);
  const originX = col * FRAME_SIZE;
  const originY = row * FRAME_SIZE;
  const color = PALETTE[index];
  fillRect(rgb, sheetWidth, originX, originY, FRAME_SIZE, color);
  const luminance = 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];
  const ink = luminance > 140 ? [0, 0, 0] : [255, 255, 255];
  const label = String(index);
  const advance = 4 * GLYPH_SCALE;
  const textWidth = label.length * advance - GLYPH_SCALE;
  const textHeight = 5 * GLYPH_SCALE;
  const left = originX + Math.floor((FRAME_SIZE - textWidth) / 2);
  const top = originY + Math.floor((FRAME_SIZE - textHeight) / 2);
  [...label].forEach((digit, d) => {
    const glyph = GLYPHS[Number(digit)];
    glyph.forEach((bits, gy) => {
      [...bits].forEach((bit, gx) => {
        if (bit === "1") {
          fillRect(rgb, sheetWidth, left + d * advance + gx * GLYPH_SCALE, top + gy * GLYPH_SCALE, GLYPH_SCALE, ink);
        }
      });
    });
  });
}

function sheetPng() {
  const width = COLUMNS * FRAME_SIZE;
  const height = ROWS * FRAME_SIZE;
  const rgb = Buffer.alloc(width * height * 3);
  for (let index = 0; index < COLUMNS * ROWS; index++) drawFrame(rgb, width, index);
  return encodePng(width, height, rgb);
}

function packJson() {
  const animations = {};
  for (const animation of ANIMATIONS) {
    const frames = animation.frames.map((index) => {
      const { col, row } = gridOf(index);
      return animation.pixels
        ? { x: col * FRAME_SIZE, y: row * FRAME_SIZE, ms: animation.ms }
        : { col, row, ms: animation.ms };
    });
    const entry = { frames };
    if (animation.loop !== undefined) entry.loop = animation.loop;
    if (animation.still !== undefined) entry.still = animation.still;
    animations[animation.name] = entry;
  }
  return {
    format: "virtualtour-avatar/1",
    name: "Synthetic test pack",
    version: "1.0.0",
    sheet: { src: "sheet.png", frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE, columns: COLUMNS, pixelArt: true },
    animations,
    roles: ROLES,
    bubble: { dock: "end", gap: 8 },
    license: { name: "MIT", attribution: "Synthetic test pack generated by packages/core/tools/make-test-pack.mjs" },
  };
}

function gridOf(index) {
  return { col: index % COLUMNS, row: Math.floor(index / COLUMNS) };
}

function classicColumnRow() {
  return ANIMATIONS.map((animation) => {
    const frames = animation.frames.map((index) => ({
      Duration: animation.ms,
      ImagesOffsets: { Column: gridOf(index).col, Row: gridOf(index).row },
    }));
    if (animation.name === "wave") frames.push({ Duration: animation.ms, ImagesOffsets: null });
    return { Name: animation.classic, Frames: frames };
  });
}

function classicPixelMap() {
  const animations = {};
  for (const animation of ANIMATIONS) {
    const frames = animation.frames.map((index) => {
      const { col, row } = gridOf(index);
      return { duration: animation.ms, position: [col * FRAME_SIZE, row * FRAME_SIZE] };
    });
    const entry = { frames };
    if (animation.loop !== undefined) entry.loop = animation.loop;
    animations[animation.classic] = entry;
  }
  return { frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE, animations };
}

function asJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function buildTestPack() {
  return new Map([
    ["sheet.png", sheetPng()],
    ["pack.json", asJson(packJson())],
    ["classic-a.json", asJson(classicColumnRow())],
    ["classic-b.json", asJson(classicPixelMap())],
  ]);
}

export function writeTestPack(dir = FIXTURE_DIR) {
  mkdirSync(dir, { recursive: true });
  for (const [name, bytes] of buildTestPack()) {
    writeFileSync(join(dir, name), bytes);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  writeTestPack();
  console.log(`wrote synthetic test pack to ${FIXTURE_DIR}`);
}
