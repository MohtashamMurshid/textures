import type { FilterId, FilterPreset, FilterSettings } from './types';
import { PIXEL_FILTERS, applyPixelFilter } from './pixel';
import { applyCanvasFilter } from './canvas';

export type { FilterId, FilterPreset, FilterSettings } from './types';

export const FILTER_LABELS: Record<FilterId, string> = {
  risograph: 'Risograph',
  characters: 'Glyphfield',
  dither: 'Bitgrain',
  'poster-dither': 'Poster Dither',
  halftone: 'Halftone',
  newsprint: 'Newsprint',
  'cobalt-grain': 'Cobalt Grain',
  'denim-grain': 'Denim Grain',
  'harbor-grain': 'Harbor Grain',
  'meadow-grain': 'Meadow Grain',
  'dot-cross': 'Dotcross',
  block: 'Typeblocks',
  dots: 'Stipple',
  paper: 'Paper',
  watercolor: 'Watercolor',
  water: 'Water',
  'fluted-glass': 'Fluted',
  'ink-wash': 'Ink Wash',
  cyanotype: 'Cyanotype',
  mixed: 'Signal Mix',
  'pixel-art': 'Pixel Crush',
  mosaic: 'Tessera',
  lego: 'Studwork',
  cross: 'Crossmarks',
  diamond: 'Facets',
  lines: 'Linepress',
  diagonal: 'Slant',
  braille: 'Dot Cells',
  voxel: 'Isoform',
  disco: 'Chroma Pop',
};

const DEFAULT: FilterSettings = { detail: 58, intensity: 100, contrast: 57 };

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'characters', settings: { detail: 68, intensity: 82, contrast: 56 } },
  { id: 'risograph', settings: DEFAULT },
  { id: 'dither', settings: { detail: 64, intensity: 100, contrast: 58 } },
  { id: 'poster-dither', settings: { detail: 42, intensity: 100, contrast: 68 } },
  { id: 'halftone', settings: { detail: 44, intensity: 100, contrast: 64 } },
  { id: 'newsprint', settings: { detail: 48, intensity: 100, contrast: 66 } },
  { id: 'cobalt-grain', settings: { detail: 73, intensity: 100, contrast: 61 } },
  { id: 'denim-grain', settings: { detail: 76, intensity: 100, contrast: 58 } },
  { id: 'harbor-grain', settings: { detail: 74, intensity: 100, contrast: 62 } },
  { id: 'meadow-grain', settings: { detail: 72, intensity: 100, contrast: 60 } },
  { id: 'dot-cross', settings: { detail: 76, intensity: 100, contrast: 64 } },
  { id: 'block', settings: { detail: 65, intensity: 86, contrast: 56 } },
  { id: 'dots', settings: { detail: 72, intensity: 100, contrast: 61 } },
  { id: 'paper', settings: { detail: 76, intensity: 92, contrast: 53 } },
  { id: 'watercolor', settings: { detail: 61, intensity: 94, contrast: 57 } },
  { id: 'water', settings: { detail: 62, intensity: 78, contrast: 54 } },
  { id: 'fluted-glass', settings: { detail: 52, intensity: 86, contrast: 56 } },
  { id: 'ink-wash', settings: { detail: 59, intensity: 96, contrast: 60 } },
  { id: 'cyanotype', settings: { detail: 70, intensity: 100, contrast: 61 } },
  { id: 'mixed', settings: { detail: 65, intensity: 84, contrast: 57 } },
  { id: 'pixel-art', settings: { detail: 64, intensity: 92, contrast: 58 } },
  { id: 'mosaic', settings: { detail: 67, intensity: 90, contrast: 56 } },
  { id: 'lego', settings: { detail: 62, intensity: 92, contrast: 59 } },
  { id: 'cross', settings: { detail: 65, intensity: 84, contrast: 56 } },
  { id: 'diamond', settings: { detail: 65, intensity: 86, contrast: 57 } },
  { id: 'lines', settings: { detail: 67, intensity: 84, contrast: 57 } },
  { id: 'diagonal', settings: { detail: 66, intensity: 84, contrast: 57 } },
  { id: 'braille', settings: { detail: 70, intensity: 88, contrast: 58 } },
  { id: 'voxel', settings: { detail: 63, intensity: 92, contrast: 58 } },
  { id: 'disco', settings: { detail: 64, intensity: 90, contrast: 60 } },
];

export const MAX_RENDER = 1400;

export function fitSize(
  naturalW: number,
  naturalH: number,
  max = MAX_RENDER,
): { width: number; height: number } {
  const m = Math.max(naturalW, naturalH);
  if (m <= max) return { width: naturalW, height: naturalH };
  const r = max / m;
  return {
    width: Math.max(1, Math.round(naturalW * r)),
    height: Math.max(1, Math.round(naturalH * r)),
  };
}

/**
 * Apply filter to canvas: draw image → getImageData → filter → putImageData / canvas draw.
 */
export function applyFilter(
  source: CanvasImageSource,
  canvas: HTMLCanvasElement,
  filterId: FilterId,
  settings: FilterSettings,
  width: number,
  height: number,
) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  if (PIXEL_FILTERS.has(filterId)) {
    const result = applyPixelFilter(imageData, settings, filterId);
    imageData.data.set(result);
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  applyCanvasFilter(ctx, imageData, settings, filterId);
}
