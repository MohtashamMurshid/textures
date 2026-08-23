import type { FilterId, FilterSettings, RGB } from './types';
import {
  BAYER_8,
  PAPER_BASE,
  RISO_INKS,
  blendIntensity,
  clamp,
  contrast,
  hashNoise,
  inHalftoneDot,
  luma,
  multiplyInk,
  orderedQuantize,
  samplePixel,
  scale,
  toUnit,
  valueNoise,
} from './helpers';

type GrainPreset = {
  ink: RGB;
  paper: RGB;
  kernel: [number, number, number][];
  noise: number;
  thresholdBias: number;
};

const GRAIN: Record<string, GrainPreset> = {
  'cobalt-grain': {
    ink: [49, 61, 235],
    paper: [248, 248, 252],
    kernel: [
      [1, 0, 7 / 16],
      [-1, 1, 3 / 16],
      [0, 1, 5 / 16],
      [1, 1, 1 / 16],
    ],
    noise: 7,
    thresholdBias: 4,
  },
  'denim-grain': {
    ink: [70, 121, 164],
    paper: [248, 249, 247],
    kernel: [
      [1, 0, 1 / 8],
      [2, 0, 1 / 8],
      [-1, 1, 1 / 8],
      [0, 1, 1 / 8],
      [1, 1, 1 / 8],
      [0, 2, 1 / 8],
    ],
    noise: 5,
    thresholdBias: 7,
  },
  'harbor-grain': {
    ink: [2, 92, 116],
    paper: [243, 248, 244],
    kernel: [
      [1, 0, 1 / 2],
      [-1, 1, 1 / 4],
      [0, 1, 1 / 4],
    ],
    noise: 6,
    thresholdBias: 2,
  },
  'meadow-grain': {
    ink: [25, 134, 32],
    paper: [248, 250, 242],
    kernel: [
      [1, 0, 8 / 32],
      [2, 0, 4 / 32],
      [-2, 1, 2 / 32],
      [-1, 1, 4 / 32],
      [0, 1, 8 / 32],
      [1, 1, 4 / 32],
      [2, 1, 2 / 32],
    ],
    noise: 8,
    thresholdBias: 5,
  },
};

/** Risograph — CMYK-ish rotated halftone with ink multiply */
export function risograph(img: ImageData, settings: FilterSettings): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.data.length);
  const s = scale(img.width, img.height);
  const cell = (3 + Math.round(((100 - settings.detail) / 100) * 8)) * s;

  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      const orig: RGB = [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
      const c0 = contrast(orig[0], settings.contrast) / 255;
      const c1 = contrast(orig[1], settings.contrast) / 255;
      const c2 = contrast(orig[2], settings.contrast) / 255;
      const k = 1 - Math.max(c0, c1, c2);
      const denom = Math.max(0.001, 1 - k);
      const amounts = [(1 - c0 - k) / denom, (1 - c1 - k) / denom, (1 - c2 - k) / denom, k];
      const hx = toUnit(x, s);
      const hy = toUnit(y, s);
      const jitter = (hashNoise(hx, hy) - 0.5) * 0.12;
      const rgb: number[] = [...PAPER_BASE];
      for (let ch = 0; ch < amounts.length; ch += 1) {
        const amt = clamp((amounts[ch] ?? 0) + (ch < 3 ? jitter : 0), 0, 1);
        if (inHalftoneDot(x, y, ch, cell, amt, ch * 1.7 * s)) {
          multiplyInk(rgb, RISO_INKS[ch] ?? RISO_INKS[3]!);
        }
      }
      const grain = (hashNoise(hx + 31, hy - 17) - 0.5) * 10;
      rgb[0] = clamp(rgb[0]! + grain);
      rgb[1] = clamp(rgb[1]! + grain);
      rgb[2] = clamp(rgb[2]! + grain);
      blendIntensity(out, i, orig, rgb as RGB, settings.intensity);
    }
  }
  return out;
}

/** Bitgrain — Bayer ordered dither with quantized levels */
export function dither(img: ImageData, settings: FilterSettings): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.data.length);
  const s = scale(img.width, img.height);
  const step = Math.max(1, Math.round((1 + Math.round(((100 - settings.detail) / 100) * 5)) * s));
  const levels = settings.detail > 72 ? 5 : settings.detail > 38 ? 4 : 3;

  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const i = (y * img.width + x) * 4;
      const t = ((BAYER_8[((y / step) % 8) * 8 + ((x / step) % 8)] ?? 0) + 0.5) / 64;
      const fx: RGB = [0, 1, 2].map((c) =>
        orderedQuantize(contrast(img.data[i + c] ?? 0, settings.contrast), t, levels),
      ) as RGB;
      for (let py = y; py < Math.min(y + step, img.height); py += 1) {
        for (let px = x; px < Math.min(x + step, img.width); px += 1) {
          const j = (py * img.width + px) * 4;
          blendIntensity(
            out,
            j,
            [img.data[j] ?? 0, img.data[j + 1] ?? 0, img.data[j + 2] ?? 0],
            fx,
            settings.intensity,
          );
        }
      }
    }
  }
  return out;
}

/** Colored grain family — error diffusion with ink/paper */
export function grain(
  img: ImageData,
  settings: FilterSettings,
  id: FilterId,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.data.length);
  const preset = GRAIN[id];
  if (!preset) return out;
  const s = scale(img.width, img.height);
  const cell = Math.max(1, Math.round(s * (1.64 + ((100 - settings.detail) / 100) * 1.84)));
  const gw = Math.ceil(img.width / cell);
  const gh = Math.ceil(img.height / cell);
  const buf = new Float32Array(gw * gh);

  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const sx = Math.min(img.width - 1, gx * cell + Math.floor(cell / 2));
      const sy = Math.min(img.height - 1, gy * cell + Math.floor(cell / 2));
      const i = (sy * img.width + sx) * 4;
      const rgb: RGB = [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
      const n = (hashNoise(gx * 0.61 + 17, gy * 0.57 - 23) - 0.5) * preset.noise;
      buf[gy * gw + gx] = clamp(contrast(luma(rgb), settings.contrast + 7) + n);
    }
  }

  for (let gy = 0; gy < gh; gy += 1) {
    const dir = gy % 2 === 0 ? 1 : -1;
    const start = dir === 1 ? 0 : gw - 1;
    const end = dir === 1 ? gw : -1;
    for (let gx = start; gx !== end; gx += dir) {
      const v = buf[gy * gw + gx] ?? 0;
      const ink = v < 128 + preset.thresholdBias ? preset.ink : preset.paper;
      const err = v - (ink === preset.ink ? 0 : 255);
      for (const [dx, dy, w] of preset.kernel) {
        const nx = gx + dx * dir;
        const ny = gy + dy;
        if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
        const ni = ny * gw + nx;
        buf[ni] = (buf[ni] ?? 0) + err * w;
      }
      const x0 = gx * cell;
      const y0 = gy * cell;
      const x1 = Math.min(x0 + cell, img.width);
      const y1 = Math.min(y0 + cell, img.height);
      for (let py = y0; py < y1; py += 1) {
        for (let px = x0; px < x1; px += 1) {
          const j = (py * img.width + px) * 4;
          blendIntensity(
            out,
            j,
            [img.data[j] ?? 0, img.data[j + 1] ?? 0, img.data[j + 2] ?? 0],
            ink,
            settings.intensity,
          );
        }
      }
    }
  }
  return out;
}

/** Paper — fibrous texture overlay */
export function paper(img: ImageData, settings: FilterSettings): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.data.length);
  const s = scale(img.width, img.height);
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      const orig: RGB = [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
      const c = orig.map((v) => contrast(v, settings.contrast));
      const ux = toUnit(x, s);
      const uy = toUnit(y, s);
      const n1 = (valueNoise(ux, uy * 0.18, 28) - 0.5) * 9;
      const n2 = (valueNoise(ux * 0.24, uy, 17) - 0.5) * 5;
      const n3 = (hashNoise(ux * 0.63, uy * 0.47) - 0.5) * 5;
      const fleck = hashNoise(ux * 0.91 + 17, uy * 0.83 - 9) > 0.987 ? -18 : 0;
      const fx = c.map((v, ch) =>
        clamp((PAPER_BASE[ch] ?? 240) + (v - (PAPER_BASE[ch] ?? 240)) * 0.72 + n1 + n2 + n3 + fleck),
      ) as RGB;
      blendIntensity(out, i, orig, fx, settings.intensity);
    }
  }
  return out;
}

/** Watercolor — soft bleed + posterize */
export function watercolor(img: ImageData, settings: FilterSettings): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.data.length);
  const s = scale(img.width, img.height);
  const r = Math.max(1, Math.round((2.2 + ((100 - settings.detail) / 100) * 4.8) * s));

  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      const orig: RGB = [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
      const samples = [
        samplePixel(img.data, img.width, img.height, x, y),
        samplePixel(img.data, img.width, img.height, x - r, y),
        samplePixel(img.data, img.width, img.height, x + r, y),
        samplePixel(img.data, img.width, img.height, x, y - r),
        samplePixel(img.data, img.width, img.height, x, y + r),
      ];
      const avg = [0, 1, 2].map(
        (ch) => samples.reduce((sum, p) => sum + (p[ch] ?? 0), 0) / samples.length,
      );
      const L = luma(avg);
      const sat = avg.map((v) => contrast(L + (v - L) * 1.18, settings.contrast));
      const edge =
        Math.min(
          0.25,
          (Math.abs(luma(samplePixel(img.data, img.width, img.height, x + r, y)) -
            luma(samplePixel(img.data, img.width, img.height, x - r, y))) +
            Math.abs(luma(samplePixel(img.data, img.width, img.height, x, y + r)) -
              luma(samplePixel(img.data, img.width, img.height, x, y - r)))) /
            390,
        );
      const ux = toUnit(x, s);
      const uy = toUnit(y, s);
      const n1 = (valueNoise(ux, uy, 24) - 0.5) * 14;
      const n2 = (hashNoise(ux * 0.38 + 4, uy * 0.42 - 8) - 0.5) * 7;
      const fx = sat.map((v, ch) => {
        const mixed = v * 0.94 + (PAPER_BASE[ch] ?? 240) * 0.06 + n1 + n2;
        return clamp(Math.round(mixed / 14) * 14 * (1 - edge));
      }) as RGB;
      blendIntensity(out, i, orig, fx, settings.intensity);
    }
  }
  return out;
}

/** Ink wash — monochrome wash with edge darkening */
export function inkWash(img: ImageData, settings: FilterSettings): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.data.length);
  const s = scale(img.width, img.height);
  const r = Math.max(1, Math.round(2.4 * s));
  const ink: RGB = [28, 31, 29];

  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      const orig: RGB = [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
      const u = contrast(luma(orig), settings.contrast + 4) / 255;
      const edge =
        Math.min(
          0.34,
          (Math.abs(
            luma(samplePixel(img.data, img.width, img.height, x + r, y)) -
              luma(samplePixel(img.data, img.width, img.height, x - r, y)),
          ) +
            Math.abs(
              luma(samplePixel(img.data, img.width, img.height, x, y + r)) -
                luma(samplePixel(img.data, img.width, img.height, x, y - r)),
            )) /
            300,
        );
      const ux = toUnit(x, s);
      const uy = toUnit(y, s);
      const n = (valueNoise(ux, uy, 34) - 0.5) * 0.12;
      const fleck = hashNoise(ux * 0.58 + 31, uy * 0.09 - 14) > 0.94 ? 0.1 : 0;
      const tone = clamp(Math.round((u + n + fleck - edge) * 6) / 6, 0, 1);
      const grain = (hashNoise(ux * 0.27, uy * 0.61) - 0.5) * 7;
      const fx = PAPER_BASE.map((p, ch) =>
        clamp((ink[ch] ?? 28) * (1 - tone) + p * tone + grain),
      ) as RGB;
      blendIntensity(out, i, orig, fx, settings.intensity);
    }
  }
  return out;
}

/** Cyanotype — deep blue → highlight grade */
export function cyanotype(img: ImageData, settings: FilterSettings): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.data.length);
  const s = scale(img.width, img.height);
  const dark: RGB = [5, 31, 58];
  const mid: RGB = [18, 87, 130];
  const light: RGB = [232, 235, 211];

  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      const orig: RGB = [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
      const d = contrast(luma(orig), settings.contrast + 6) / 255;
      const t0 = Math.min(1, d * 2);
      const t1 = Math.max(0, d * 2 - 1);
      const ux = toUnit(x, s);
      const uy = toUnit(y, s);
      const grain = (hashNoise(ux * 0.53 + 12, uy * 0.49 - 21) - 0.5) * 8;
      const fx = [0, 1, 2].map((ch) =>
        clamp(
          ((dark[ch]! * (1 - t0) + mid[ch]! * t0) * (1 - t1) + light[ch]! * t1) + grain,
        ),
      ) as RGB;
      blendIntensity(out, i, orig, fx, settings.intensity);
    }
  }
  return out;
}

export const PIXEL_FILTERS = new Set<FilterId>([
  'risograph',
  'dither',
  'cobalt-grain',
  'denim-grain',
  'harbor-grain',
  'meadow-grain',
  'paper',
  'watercolor',
  'ink-wash',
  'cyanotype',
]);

export function applyPixelFilter(
  img: ImageData,
  settings: FilterSettings,
  id: FilterId,
): Uint8ClampedArray {
  switch (id) {
    case 'risograph':
      return risograph(img, settings);
    case 'dither':
      return dither(img, settings);
    case 'cobalt-grain':
    case 'denim-grain':
    case 'harbor-grain':
    case 'meadow-grain':
      return grain(img, settings, id);
    case 'paper':
      return paper(img, settings);
    case 'watercolor':
      return watercolor(img, settings);
    case 'ink-wash':
      return inkWash(img, settings);
    case 'cyanotype':
      return cyanotype(img, settings);
    default:
      return new Uint8ClampedArray(img.data);
  }
}
