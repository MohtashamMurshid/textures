import type { RGB } from './types';

export const PAPER_BASE: RGB = [245, 239, 221];
export const RISO_INKS: RGB[] = [
  [0, 120, 145],
  [226, 79, 45],
  [244, 190, 22],
  [28, 54, 47],
];
export const GLYPH_CHARS = '@%#*+=-:. ';
export const MAX_DIM = 1400;

export const ANGLE_COS = [Math.cos(0.27), Math.cos(-0.27), 1, Math.cos(0.78)];
export const ANGLE_SIN = [Math.sin(0.27), Math.sin(-0.27), 0, Math.sin(0.78)];

/** Bayer 8x8 ordered dither matrix */
export const BAYER_8 = [
  0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52, 11,
  59, 7, 55, 40, 24, 36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61, 34, 18,
  46, 30, 33, 17, 45, 29, 10, 58, 6, 54, 9, 57, 5, 53, 42, 26, 38, 22, 41, 25, 37,
  21,
];

export const scale = (w: number, h: number) =>
  Math.max(0.5, Math.max(w, h) / MAX_DIM);

export const clamp = (v: number, lo = 0, hi = 255) =>
  Math.min(hi, Math.max(lo, v));

/** Contrast curve: settings.contrast around 50 is neutral */
export const contrast = (v: number, c: number) => {
  const n = ((c - 50) / 50) * 0.72;
  const r = (1 + n) / (1 - n);
  return clamp((v / 255 - 0.5) * r * 255 + 127.5);
};

/** Deterministic hash noise in [0,1) */
export const hashNoise = (x: number, y: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/** Smooth value noise */
export const valueNoise = (x: number, y: number, cell: number) => {
  const rx = x / cell;
  const ry = y / cell;
  const ax = Math.floor(rx);
  const ay = Math.floor(ry);
  const sx = rx - ax;
  const sy = ry - ay;
  const ux = sx * sx * (3 - 2 * sx);
  const uy = sy * sy * (3 - 2 * sy);
  const a = hashNoise(ax, ay) * (1 - ux) + hashNoise(ax + 1, ay) * ux;
  const b = hashNoise(ax, ay + 1) * (1 - ux) + hashNoise(ax + 1, ay + 1) * ux;
  return a * (1 - uy) + b * uy;
};

export const luma = (rgb: RGB | number[]) =>
  0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;

export const blendIntensity = (
  out: Uint8ClampedArray,
  idx: number,
  orig: RGB | number[],
  fx: RGB | number[],
  intensity: number,
) => {
  const a = intensity / 100;
  out[idx] = orig[0]! * (1 - a) + fx[0]! * a;
  out[idx + 1] = orig[1]! * (1 - a) + fx[1]! * a;
  out[idx + 2] = orig[2]! * (1 - a) + fx[2]! * a;
  out[idx + 3] = 255;
};

export const multiplyInk = (rgb: number[], ink: RGB) => {
  rgb[0] = (rgb[0]! * ink[0]) / 255;
  rgb[1] = (rgb[1]! * ink[1]) / 255;
  rgb[2] = (rgb[2]! * ink[2]) / 255;
};

/** Halftone dot test for risograph channels */
export const inHalftoneDot = (
  x: number,
  y: number,
  channel: number,
  cell: number,
  amount: number,
  offset: number,
) => {
  if (amount <= 0.012) return false;
  if (amount >= 0.988) return true;
  const cos = ANGLE_COS[channel] ?? 1;
  const sin = ANGLE_SIN[channel] ?? 0;
  const rx = x * cos - y * sin + offset;
  const ry = x * sin + y * cos + offset * 0.63;
  const u = ((rx % cell) + cell) % cell;
  const v = ((ry % cell) + cell) % cell;
  const dx = u - cell / 2;
  const dy = v - cell / 2;
  const r = Math.sqrt(amount / Math.PI) * cell;
  return dx * dx + dy * dy <= r * r;
};

export const samplePixel = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
): RGB => {
  const sx = Math.max(0, Math.min(w - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(y)));
  const i = (sy * w + sx) * 4;
  return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
};

export const samplePixelBilinear = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
): RGB => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = samplePixel(data, w, h, x0, y0);
  const b = samplePixel(data, w, h, x0 + 1, y0);
  const c = samplePixel(data, w, h, x0, y0 + 1);
  const d = samplePixel(data, w, h, x0 + 1, y0 + 1);
  return [0, 1, 2].map(
    (ch) =>
      (a[ch] ?? 0) * (1 - fx) * (1 - fy) +
      (b[ch] ?? 0) * fx * (1 - fy) +
      (c[ch] ?? 0) * (1 - fx) * fy +
      (d[ch] ?? 0) * fx * fy,
  ) as RGB;
};

export const blockAverage = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  bw: number,
  bh: number,
): RGB => {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  const step = Math.max(1, Math.floor(Math.min(bw, bh) / 3));
  const x1 = Math.min(w, Math.ceil(x + bw));
  const y1 = Math.min(h, Math.ceil(y + bh));
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  for (let py = y0; py < y1; py += step) {
    for (let px = x0; px < x1; px += step) {
      const i = (py * w + px) * 4;
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      n += 1;
    }
  }
  const d = Math.max(1, n);
  return [r / d, g / d, b / d];
};

export const applyContrastRGB = (rgb: RGB | number[], c: number): RGB => [
  contrast(rgb[0]!, c),
  contrast(rgb[1]!, c),
  contrast(rgb[2]!, c),
];

export const rgba = (rgb: RGB | number[], a: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

export const glyphFillStyle = (
  rgb: RGB | number[],
  L: number,
  intensity: number,
) => {
  const light = L >= 138;
  const mix = light ? 0.24 : 0.66;
  const col = rgb.map((v) => (light ? v * (1 - mix) : v + (255 - v) * mix));
  const o = Math.abs(L - 128) / 128;
  const a = (0.46 + Math.min(1, o) * 0.18) * intensity;
  return `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${a})`;
};

export const quantizeLevels = (rgb: RGB | number[], levels = 6): RGB =>
  rgb.map(
    (v) => Math.round((v / 255) * (levels - 1)) * (255 / (levels - 1)),
  ) as RGB;

export const orderedQuantize = (v: number, threshold: number, levels: number) => {
  const r = (v / 255) * (levels - 1);
  const i = Math.floor(r);
  return ((i + +(r - i > threshold)) / (levels - 1)) * 255;
};

export const toUnit = (v: number, s: number) => v / s;
