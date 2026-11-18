import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { animations, buildPack, canvas, frameSvg } from "../src/avatar/thumbtack/frames.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src/avatar/thumbtack");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function quantize(rgba, maxColors) {
  const counts = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const key = rgba.readUInt32LE(i);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries = [...counts].map(([key, count]) => ({
    key,
    count,
    c: [key & 0xff, (key >>> 8) & 0xff, (key >>> 16) & 0xff, key >>> 24],
  }));
  let boxes = [entries];
  const spread = (box) => {
    let best = { axis: 0, range: -1 };
    for (let axis = 0; axis < 4; axis += 1) {
      let lo = 255;
      let hi = 0;
      for (const e of box) {
        lo = Math.min(lo, e.c[axis]);
        hi = Math.max(hi, e.c[axis]);
      }
      if (hi - lo > best.range) best = { axis, range: hi - lo };
    }
    return best;
  };
  const weight = (box) => box.reduce((sum, e) => sum + e.count, 0);
  while (boxes.length < maxColors - 1) {
    let pick = -1;
    let pickScore = 0;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      const score = weight(box) * spread(box).range;
      if (score > pickScore) {
        pick = index;
        pickScore = score;
      }
    });
    if (pick < 0) break;
    const box = boxes[pick];
    const { axis } = spread(box);
    const sorted = [...box].sort((a, b) => a.c[axis] - b.c[axis]);
    const half = weight(sorted) / 2;
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      acc += sorted[i].count;
      cut = i + 1;
      if (acc >= half) break;
    }
    boxes.splice(pick, 1, sorted.slice(0, cut), sorted.slice(cut));
  }
  const palette = [[0, 0, 0, 0]];
  const lookup = new Map();
  for (const box of boxes) {
    const total = weight(box);
    const mean = [0, 1, 2, 3].map((axis) => Math.round(box.reduce((sum, e) => sum + e.c[axis] * e.count, 0) / total));
    palette.push(mean);
    for (const e of box) lookup.set(e.key, palette.length - 1);
  }
  const indices = Buffer.alloc(rgba.length / 4);
  for (let i = 0; i < indices.length; i += 1) {
    indices[i] = rgba[i * 4 + 3] === 0 ? 0 : lookup.get(rgba.readUInt32LE(i * 4));
  }
  return { palette, indices };
}

function filterRows(indices, width, height, type) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width + 1);
    raw[row] = type;
    for (let x = 0; x < width; x += 1) {
      const value = indices[y * width + x];
      const left = x > 0 ? indices[y * width + x - 1] : 0;
      const up = y > 0 ? indices[(y - 1) * width + x] : 0;
      const upLeft = y > 0 && x > 0 ? indices[(y - 1) * width + x - 1] : 0;
      const predictor = type === 0 ? 0 : type === 1 ? left : type === 2 ? up : paeth(left, up, upLeft);
      raw[row + 1 + x] = (value - predictor) & 0xff;
    }
  }
  return raw;
}

export function encodePng(width, height, rgba) {
  const { palette, indices } = quantize(rgba, 64);
  const idat = [0, 1, 2, 4]
    .map((type) => deflateSync(filterRows(indices, width, height, type), { level: 9 }))
    .reduce((best, candidate) => (candidate.length < best.length ? candidate : best));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 3;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", Buffer.from(palette.flatMap((c) => c.slice(0, 3)))),
    chunk("tRNS", Buffer.from(palette.map((c) => c[3]))),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function rasterize(svgs) {
  const { chromium } = await import("@playwright/test");
  const { frameWidth, frameHeight, scale, columns } = canvas;
  const cellW = frameWidth * scale;
  const cellH = frameHeight * scale;
  const rows = Math.ceil(svgs.length / columns);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const pixels = await page.evaluate(
      async ({ svgs, cellW, cellH, columns, rows }) => {
        const sheet = document.createElement("canvas");
        sheet.width = cellW * columns;
        sheet.height = cellH * rows;
        const ctx = sheet.getContext("2d", { willReadFrequently: true });
        for (let i = 0; i < svgs.length; i += 1) {
          const image = new Image();
          image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs[i])}`;
          await image.decode();
          ctx.drawImage(image, (i % columns) * cellW, Math.floor(i / columns) * cellH, cellW, cellH);
        }
        const data = ctx.getImageData(0, 0, sheet.width, sheet.height).data;
        let binary = "";
        for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
        return btoa(binary);
      },
      { svgs, cellW, cellH, columns, rows },
    );
    return { width: cellW * columns, height: cellH * rows, rgba: Buffer.from(pixels, "base64") };
  } finally {
    await browser.close();
  }
}

export async function buildThumbtack() {
  const svgRoot = join(outDir, "svg");
  await rm(svgRoot, { recursive: true, force: true });
  const svgs = [];
  for (const [name, animation] of Object.entries(animations)) {
    await mkdir(join(svgRoot, name), { recursive: true });
    for (const [index, frame] of animation.frames.entries()) {
      const svg = frameSvg(frame);
      svgs.push(svg);
      await writeFile(join(svgRoot, name, `${String(index).padStart(2, "0")}.svg`), svg);
    }
  }
  const { width, height, rgba } = await rasterize(svgs);
  await writeFile(join(outDir, "sheet.png"), encodePng(width, height, rgba));
  await writeFile(join(outDir, "pack.json"), `${JSON.stringify(buildPack(), null, 2)}\n`);
  return { frames: svgs.length, width, height };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildThumbtack();
  process.stdout.write(`thumbtack: ${result.frames} frames, sheet ${result.width}x${result.height}\n`);
}
