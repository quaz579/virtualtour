export const canvas = { frameWidth: 96, frameHeight: 96, scale: 2, columns: 10 };

export const palette = {
  head: "#e5484d",
  rim: "#a82a30",
  highlight: "#ff9a9e",
  pin: "#9aa4b2",
  pinShade: "#6f7a89",
  eyeWhite: "#ffffff",
  ink: "#1d2330",
};

export const defaultFrameMs = 80;

const restPose = Object.freeze({
  tilt: 0,
  nod: 0,
  lift: 0,
  squash: 0,
  eyeX: 0,
  eyeY: 0,
  browL: 0,
  browR: 0,
  blink: 0,
  wide: 0,
  mouth: 0,
});

/**
 * Completes a partial pose. `tilt` is degrees clockwise (positive leans right), `nod` is degrees
 * (positive looks up), `squash` is -1..1 (negative stretches), `lift` is pixels off the ground,
 * `eyeX`/`eyeY` are -1..1 pupil offsets, `browL`/`browR`/`blink`/`wide`/`mouth` are 0..1.
 */
export function pose(partial = {}) {
  return { ...restPose, ...partial };
}

function sequence(count, fn) {
  return Array.from({ length: count }, (_, index) => pose(fn(count === 1 ? 0 : index / (count - 1), index)));
}

function fromList(list) {
  return list.map((partial) => pose(partial));
}

const tau = Math.PI * 2;
const hump = (t) => Math.sin(Math.PI * t);
const lean = 20;
const bodyScale = 1.1;

function pointSequence(shape) {
  return sequence(6, (t) => shape(hump(t)));
}

export const animations = {
  rest: { loop: false, ms: 100, still: 0, frames: fromList([{}]) },
  blink: {
    loop: false,
    ms: 60,
    still: 0,
    frames: fromList([{}, { blink: 0.6 }, { blink: 1 }, {}]),
  },
  wobble: {
    loop: false,
    ms: 80,
    still: 0,
    frames: sequence(8, (t) => ({ tilt: 9 * Math.sin(tau * t), squash: 0.08 * hump(t) })),
  },
  "look-around": {
    loop: false,
    ms: 90,
    still: 0,
    frames: sequence(8, (t) => ({ eyeX: Math.sin(tau * t), tilt: 3 * Math.sin(tau * t), browL: 0.3 * hump(t) })),
  },
  wave: {
    loop: false,
    ms: 90,
    still: 1,
    frames: sequence(8, (t) => ({
      tilt: 16 * Math.sin(3 * Math.PI * t),
      lift: 2 * Math.abs(Math.sin(3 * Math.PI * t)),
      browL: hump(t),
      browR: hump(t),
      mouth: 0.6 * hump(t),
    })),
  },
  "point-left": {
    loop: false,
    ms: 80,
    still: 2,
    frames: pointSequence((s) => ({ tilt: -lean * s, eyeX: -s, browR: 0.5 * s })),
  },
  "point-right": {
    loop: false,
    ms: 80,
    still: 2,
    frames: pointSequence((s) => ({ tilt: lean * s, eyeX: s, browL: 0.5 * s })),
  },
  "point-up": {
    loop: false,
    ms: 80,
    still: 2,
    frames: pointSequence((s) => ({ nod: lean * s, eyeY: -s, lift: 3 * s, squash: -0.2 * s, browL: 0.6 * s, browR: 0.6 * s, mouth: 0.3 * s })),
  },
  "point-down": {
    loop: false,
    ms: 80,
    still: 2,
    frames: pointSequence((s) => ({ nod: -lean * s, eyeY: s, squash: 0.25 * s })),
  },
  think: {
    loop: true,
    ms: 140,
    still: 2,
    frames: sequence(6, (t) => {
      const s = hump(t);
      return { tilt: 7 * s, eyeX: 0.7 * s, eyeY: -0.7 * s, browL: s, nod: 8 * s };
    }),
  },
  cheer: {
    loop: false,
    ms: 80,
    still: 2,
    frames: sequence(8, (t) => ({
      lift: 8 * Math.abs(Math.sin(tau * t)),
      tilt: 8 * Math.sin(2 * tau * t),
      squash: -0.12 * Math.abs(Math.sin(tau * t)),
      browL: hump(t),
      browR: hump(t),
      mouth: hump(t),
      wide: 0.2 * hump(t),
    })),
  },
  "pop-out": {
    loop: false,
    ms: 80,
    still: 3,
    frames: fromList([
      {},
      { squash: 0.22, mouth: 0.2 },
      { squash: -0.14, lift: 6, wide: 0.15, browL: 1, browR: 1 },
      { squash: -0.1, lift: 8, wide: 0.2, browL: 1, browR: 1, mouth: 0.8 },
      { squash: 0.04, lift: 4, browL: 0.5, browR: 0.5 },
      {},
    ]),
  },
  boing: {
    loop: false,
    ms: 70,
    still: 1,
    frames: fromList([
      {},
      { squash: 0.2, lift: 0, wide: 0.2, browL: 1, browR: 1 },
      { squash: -0.16, lift: 6, wide: 0.3, browL: 1, browR: 1, mouth: 0.9 },
      { squash: 0.1, lift: 0, wide: 0.2, browL: 0.8, browR: 0.8, mouth: 0.6 },
      { squash: -0.05, lift: 2, wide: 0.1, browL: 0.3, browR: 0.3 },
      {},
    ]),
  },
};

export const roles = {
  rest: "rest",
  idle: ["blink", "wobble", "look-around"],
  greet: "wave",
  point: { left: "point-left", right: "point-right", up: "point-up", down: "point-down" },
  think: "think",
  celebrate: "cheer",
  exit: "pop-out",
  alert: "boing",
};

export const pointLean = {
  left: (frame) => -frame.tilt,
  right: (frame) => frame.tilt,
  up: (frame) => frame.nod,
  down: (frame) => -frame.nod,
};

export const license = {
  name: "CC0-1.0",
  url: "https://creativecommons.org/publicdomain/zero/1.0/",
  attribution: "Thumbtack character, original to this project; no credit required",
};

const round = (value) => Math.round(value * 100) / 100 + 0;

/** Returns the SVG source of one frame, a pure function of the pose. */
export function frameSvg(partial) {
  const p = pose(partial);
  const c = palette;
  const rad = (p.nod * Math.PI) / 180;
  const faceDy = -p.nod * 0.3;
  const flat = Math.cos(rad);
  const sx = bodyScale * (1 + 0.16 * p.squash);
  const sy = bodyScale * (1 - 0.2 * p.squash);
  const eyeRx = 7 * (1 + p.wide);
  const eyeRy = Math.max(0.9, 7 * (1 + p.wide) * flat * (1 - p.blink));
  const eyes = [39, 57].map((cx, index) => {
    const cy = 42 + faceDy;
    const id = index === 0 ? "eyeL" : "eyeR";
    const px = cx + p.eyeX * 3;
    const py = cy + p.eyeY * 3 * flat;
    const pupil =
      p.blink < 0.75
        ? `<circle cx="${round(px)}" cy="${round(py)}" r="3.4" fill="${c.ink}" clip-path="url(#${id})"/>`
        : "";
    return (
      `<clipPath id="${id}"><ellipse cx="${cx}" cy="${round(cy)}" rx="${round(eyeRx)}" ry="${round(eyeRy)}"/></clipPath>` +
      `<ellipse cx="${cx}" cy="${round(cy)}" rx="${round(eyeRx)}" ry="${round(eyeRy)}" fill="${c.eyeWhite}" stroke="${c.ink}" stroke-width="1.4"/>` +
      pupil
    );
  });
  const browY = (raise) => round(30 + faceDy - 5 * raise);
  const yl = browY(p.browL);
  const yr = browY(p.browR);
  const brows =
    `<path d="M31 ${round(yl + 1.5)} Q38 ${round(yl - 3.5)} 45 ${yl}" fill="none" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M51 ${yr} Q58 ${round(yr - 3.5)} 65 ${round(yr + 1.5)}" fill="none" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  const my = round(53 + faceDy);
  const mouth =
    p.mouth > 0.05
      ? `<path d="M41 ${my} Q48 ${round(my + 5 + 10 * p.mouth)} 55 ${my} Z" fill="${c.ink}" stroke="${c.ink}" stroke-width="1.6" stroke-linejoin="round"/>`
      : `<path d="M42 ${my} Q48 ${round(my + 5)} 54 ${my}" fill="none" stroke="${c.ink}" stroke-width="2.2" stroke-linecap="round"/>`;
  const transform =
    `translate(0 ${round(-p.lift)}) rotate(${round(p.tilt)} 48 90) ` +
    `translate(48 90) scale(${round(sx)} ${round(sy)}) translate(-48 -90)`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.frameWidth}" height="${canvas.frameHeight}" viewBox="0 0 ${canvas.frameWidth} ${canvas.frameHeight}">` +
    `<g transform="${transform}">` +
    `<polygon points="46.5,70 49.5,70 48,90" fill="${c.pin}"/>` +
    `<polygon points="48,70 49.5,70 48,90" fill="${c.pinShade}"/>` +
    `<circle cx="48" cy="44" r="24" fill="${c.head}" stroke="${c.rim}" stroke-width="1.5"/>` +
    `<ellipse cx="37" cy="29" rx="6" ry="3.4" transform="rotate(-35 37 29)" fill="${c.highlight}" opacity="0.7"/>` +
    `<rect x="22" y="64" width="52" height="8" rx="4" fill="${c.rim}"/>` +
    eyes.join("") +
    brows +
    mouth +
    `</g></svg>\n`
  );
}

/** Lays frames out on the sheet grid and returns the v1 pack description. */
export function buildPack() {
  const { frameWidth, frameHeight, scale, columns } = canvas;
  let index = 0;
  const packed = {};
  for (const [name, animation] of Object.entries(animations)) {
    const frames = animation.frames.map(() => {
      const frame = { col: index % columns, row: Math.floor(index / columns), ms: animation.ms ?? defaultFrameMs };
      index += 1;
      return frame;
    });
    packed[name] = { frames, loop: animation.loop, still: animation.still };
  }
  return {
    format: "virtualtour-avatar/1",
    name: "Thumbtack",
    version: "1.0.0",
    sheet: { src: "./sheet.png", frameWidth, frameHeight, columns, scale, pixelArt: false },
    animations: packed,
    roles,
    bubble: { dock: "end", gap: 8 },
    license,
  };
}

export function frameCount() {
  return Object.values(animations).reduce((total, animation) => total + animation.frames.length, 0);
}
