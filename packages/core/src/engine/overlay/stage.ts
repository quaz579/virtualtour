export type StageDefinition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Per-corner radii of the cut-out, in CSS pixels. */
export type StageCornerRadius = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

export type StageOptions = {
  padding: number;
  radius: number | StageCornerRadius;
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function stageViewBox(): string {
  return `0 0 ${window.innerWidth} ${window.innerHeight}`;
}

export function createStageSvg(className: string, path: string, fill: string, opacity: number | string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", stageViewBox());
  svg.setAttribute("preserveAspectRatio", "xMinYMin slice");
  svg.style.fillRule = "evenodd";

  const stagePath = document.createElementNS(SVG_NAMESPACE, "path");
  stagePath.setAttribute("d", path);
  stagePath.style.fill = fill;
  stagePath.style.opacity = `${opacity}`;
  stagePath.style.pointerEvents = "auto";
  svg.appendChild(stagePath);

  return svg;
}

export type StageCutout = StageDefinition & { radii: StageCornerRadius };

function clampRadius(value: number | undefined, width: number, height: number): number {
  const limited = Math.min(Number(value) || 0, width / 2, height / 2);
  return Math.floor(Math.max(limited, 0));
}

export function stageCutout(stage: StageDefinition, options: StageOptions): StageCutout {
  const width = stage.width + options.padding * 2;
  const height = stage.height + options.padding * 2;
  const radius = options.radius;
  const corner = (key: keyof StageCornerRadius) =>
    clampRadius(typeof radius === "number" ? radius : radius[key], width, height);

  return {
    x: stage.x - options.padding,
    y: stage.y - options.padding,
    width,
    height,
    radii: {
      topLeft: corner("topLeft"),
      topRight: corner("topRight"),
      bottomRight: corner("bottomRight"),
      bottomLeft: corner("bottomLeft"),
    },
  };
}

export function generateStageSvgPathString(stage: StageDefinition, options: StageOptions) {
  const windowX = window.innerWidth;
  const windowY = window.innerHeight;

  const cutout = stageCutout(stage, options);
  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = cutout.radii;

  const top = cutout.width - tl - tr;
  const right = cutout.height - tr - br;
  const bottom = cutout.width - br - bl;
  const left = cutout.height - bl - tl;

  return `M${windowX},0L0,0L0,${windowY}L${windowX},${windowY}L${windowX},0Z
    M${cutout.x + tl},${cutout.y} h${top} a${tr},${tr} 0 0 1 ${tr},${tr} v${right} a${br},${br} 0 0 1 -${br},${br} h-${bottom} a${bl},${bl} 0 0 1 -${bl},-${bl} v-${left} a${tl},${tl} 0 0 1 ${tl},-${tl} z`;
}

type Rect = StageDefinition;

function isInside(rect: Rect, x: number, y: number): boolean {
  return x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height;
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Drops rects fully inside the stage cut-out or inside another kept rect, so nested extras make one hole. */
export function dedupeRects(stage: Rect, rects: Rect[]): Rect[] {
  const kept: Rect[] = [];
  [...rects]
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .forEach(rect => {
      if (!contains(stage, rect) && !kept.some(other => contains(other, rect))) {
        kept.push(rect);
      }
    });

  return kept;
}

export function generateExtraCutoutsPathString(cutout: StageCutout, rects: Rect[]): string {
  const isInsideExtraCutout = (x: number, y: number) => rects.some(rect => isInside(rect, x, y));
  const gridLines = (start: "x" | "y", size: "width" | "height") =>
    [...new Set([cutout, ...rects].flatMap(rect => [rect[start], rect[start] + rect[size]]))].sort((a, b) => a - b);
  const columns = gridLines("x", "width");
  const rows = gridLines("y", "height");
  let path = "";

  columns.forEach((x, column) => {
    rows.forEach((y, row) => {
      const width = columns[column + 1]! - x;
      const height = rows[row + 1]! - y;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      if (isInsideExtraCutout(centerX, centerY) && !isInside(cutout, centerX, centerY)) {
        path += `M${x},${y}h${width}v${height}h-${width}z`;
      }
    });
  });

  const { topLeft, topRight, bottomRight, bottomLeft } = cutout.radii;
  for (const isRight of [0, 1]) {
    for (const isBottom of [0, 1]) {
      const r = isBottom ? (isRight ? bottomRight : bottomLeft) : isRight ? topRight : topLeft;
      const cornerX = cutout.x + isRight * cutout.width;
      const cornerY = cutout.y + isBottom * cutout.height;
      const towardsCenterX = isRight ? -r : r;
      const towardsCenterY = isBottom ? -r : r;
      if (r && isInsideExtraCutout(cornerX + towardsCenterX / 2, cornerY + towardsCenterY / 2)) {
        path += `M${cornerX},${cornerY}h${towardsCenterX}a${r},${r} 0 0 ${isRight ^ isBottom} ${-towardsCenterX},${towardsCenterY}z`;
      }
    }
  }

  return path;
}
