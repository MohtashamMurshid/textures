import type { FilterId, FilterSettings, RGB } from './types';
import {
  BAYER_8,
  GLYPH_CHARS,
  PAPER_BASE,
  applyContrastRGB,
  blockAverage,
  clamp,
  contrast,
  glyphFillStyle,
  hashNoise,
  luma,
  quantizeLevels,
  rgba,
  samplePixel,
  scale,
} from './helpers';

/** Glyphfield / Typeblocks / Signal Mix / Crossmarks / Facets / Linepress / Slant */
export function drawGlyphField(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
  id: FilterId,
) {
  const { width: w, height: h, data } = img;
  const s = scale(w, h);
  const cellW = (5 + Math.round(((100 - settings.detail) / 100) * 13)) * s;
  const cellH = Math.max(7, Math.round(cellW * 1.55));
  const intensity = settings.intensity / 100;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = `650 ${Math.ceil(cellH * 0.9)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let y = 0; y < h; y += cellH) {
    for (let x = 0; x < w; x += cellW) {
      const avg = applyContrastRGB(
        blockAverage(data, w, h, x, y, cellW, cellH),
        settings.contrast,
      );
      const L = luma(avg);
      const density = 1 - L / 255;
      const cx = x + cellW / 2;
      const cy = y + cellH / 2;
      const style = glyphFillStyle(avg, L, intensity);
      ctx.fillStyle = style;
      ctx.strokeStyle = style;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(s, cellW * 0.12);

      if (id === 'cross') {
        const arm = cellW * (0.12 + density * 0.34);
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy);
        ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm);
        ctx.lineTo(cx, cy + arm);
        ctx.stroke();
        continue;
      }
      if (id === 'diamond') {
        const arm = cellW * (0.12 + density * 0.4);
        ctx.beginPath();
        ctx.moveTo(cx, cy - arm);
        ctx.lineTo(cx + arm, cy);
        ctx.lineTo(cx, cy + arm);
        ctx.lineTo(cx - arm, cy);
        ctx.closePath();
        ctx.fill();
        continue;
      }
      if (id === 'lines' || id === 'diagonal') {
        const arm = cellW * (0.14 + density * 0.42);
        ctx.beginPath();
        if (id === 'lines') {
          ctx.moveTo(cx - arm, cy);
          ctx.lineTo(cx + arm, cy);
        } else {
          ctx.moveTo(cx - arm, cy + arm);
          ctx.lineTo(cx + arm, cy - arm);
        }
        ctx.stroke();
        continue;
      }

      const charset =
        id === 'block' ? '█▓▒░ ' : id === 'mixed' ? '@▓#*+·:- ' : GLYPH_CHARS;
      let idx = Math.min(charset.length - 1, Math.floor((L / 256) * charset.length));
      if (id === 'mixed') {
        const jitter = Math.floor(hashNoise(x / s, y / s) * 3) - 1;
        idx = Math.max(0, Math.min(charset.length - 1, idx + jitter));
      }
      ctx.fillText(charset[idx] ?? ' ', cx, cy);
    }
  }
  ctx.restore();
}

/** Stipple — soft base + density dots */
export function drawStipple(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
) {
  const { width: w, height: h, data } = img;
  const s = scale(w, h);
  const cellW = (5.4 + ((100 - settings.detail) / 100) * 2.5) * s;
  const cellH = cellW * 1.55;
  const intensity = settings.intensity / 100;
  const base = new Uint8ClampedArray(data.length);
  const cBoost = Math.min(100, settings.contrast + 6);
  for (let i = 0; i < data.length; i += 4) {
    base[i] = contrast(data[i] ?? 0, cBoost) * 0.74;
    base[i + 1] = contrast(data[i + 1] ?? 0, cBoost) * 0.74;
    base[i + 2] = contrast(data[i + 2] ?? 0, cBoost) * 0.74;
    base[i + 3] = 255;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.putImageData(new ImageData(base, w, h), 0, 0);
  ctx.font = `500 ${cellH * 0.84}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let y = 0; y < h; y += cellH) {
    for (let x = 0; x < w; x += cellW) {
      const avg = applyContrastRGB(
        blockAverage(data, w, h, x, y, cellW, cellH),
        settings.contrast,
      );
      const density = 1 - luma(avg) / 255;
      const cx = x + cellW / 2;
      const cy = y + cellH / 2;
      const light = avg.map((v) => v + (255 - v) * 0.82);
      const a = (0.5 + density * 0.22) * intensity;
      const glyphs = ['∙', '∙', '•', '•'];
      const gi = Math.min(glyphs.length - 1, Math.floor(density * glyphs.length));
      ctx.fillStyle = rgba(light, a);
      ctx.fillText(glyphs[gi] ?? '·', cx, cy);
    }
  }
  ctx.fillStyle = `rgba(10, 7, 12, ${0.018 * intensity})`;
  const stripe = Math.max(2, cellH);
  const thick = Math.max(0.55, s * 0.75);
  for (let y = 0; y < h; y += stripe) ctx.fillRect(0, y, w, thick);
  ctx.restore();
}

/** Dotcross — dots / crosses by density */
export function drawDotCross(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
) {
  const { width: w, height: h, data } = img;
  const s = scale(w, h);
  const cell = (3.2 + ((100 - settings.detail) / 100) * 3.2) * s;
  const intensity = settings.intensity / 100;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineCap = 'square';

  let row = 0;
  for (let y = 0; y < h; y += cell) {
    let col = 0;
    for (let x = 0; x < w; x += cell) {
      const density = clamp(
        1 -
          luma(
            applyContrastRGB(
              blockAverage(data, w, h, x, y, cell, cell),
              settings.contrast + 10,
            ),
          ) /
            255 +
          (((BAYER_8[(row % 8) * 8 + (col % 8)] ?? 0) + 0.5) / 64 - 0.5) * 0.24,
        0,
        1,
      );
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      if (density >= 0.08 && density < 0.31) {
        const r = cell * (0.055 + density * 0.13);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (density >= 0.31) {
        const t = (density - 0.31) / 0.69;
        const arm = cell * (0.25 + t * 0.34);
        ctx.lineWidth = Math.max(s * 0.72, cell * (0.09 + t * 0.1));
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy - arm);
        ctx.lineTo(cx + arm, cy + arm);
        ctx.moveTo(cx + arm, cy - arm);
        ctx.lineTo(cx - arm, cy + arm);
        if (density > 0.76) {
          ctx.moveTo(cx - arm, cy);
          ctx.lineTo(cx + arm, cy);
          ctx.moveTo(cx, cy - arm);
          ctx.lineTo(cx, cy + arm);
        }
        ctx.stroke();
      }
      col += 1;
    }
    row += 1;
  }
  ctx.restore();
}

/** Pixel Crush / Tessera / Studwork / Chroma Pop */
export function drawBlocky(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
  id: FilterId,
) {
  const { width: w, height: h, data } = img;
  const s = scale(w, h);
  const cell = (5 + Math.round(((100 - settings.detail) / 100) * 11)) * s;
  const intensity = settings.intensity / 100;
  ctx.save();
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const avg = applyContrastRGB(
        blockAverage(data, w, h, x, y, cell, cell),
        settings.contrast,
      );
      const color = id === 'pixel-art' ? quantizeLevels(avg, 5) : avg;
      const gap = id === 'mosaic' ? Math.max(1, cell * 0.1) : 0;

      if (id === 'disco') {
        const r = cell * (0.23 + (1 - luma(color) / 255) * 0.18);
        ctx.fillStyle = rgba(color, intensity * 0.92);
        ctx.shadowColor = rgba(color, 0.55);
        ctx.shadowBlur = Math.max(1, cell * 0.22);
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(color, intensity * (id === 'mosaic' ? 0.84 : 0.92));
      ctx.fillRect(x + gap, y + gap, cell - gap * 2, cell - gap * 2);

      if (id === 'lego') {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        ctx.fillStyle = rgba(
          color.map((v) => clamp(v * 1.28)),
          intensity * 0.72,
        );
        ctx.beginPath();
        ctx.arc(cx - cell * 0.08, cy - cell * 0.08, cell * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(cx + cell * 0.06, cy + cell * 0.06, cell * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Dot Cells — braille glyphs from 2x4 samples */
export function drawBraille(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
) {
  const { width: w, height: h, data } = img;
  const s = scale(w, h);
  const cellW = (7 + Math.round(((100 - settings.detail) / 100) * 8)) * s;
  const cellH = cellW * 2;
  const intensity = settings.intensity / 100;
  const dots: [number, number, number][] = [
    [0, 0, 1],
    [0, 1, 2],
    [0, 2, 4],
    [1, 0, 8],
    [1, 1, 16],
    [1, 2, 32],
    [0, 3, 64],
    [1, 3, 128],
  ];
  ctx.save();
  ctx.font = `600 ${Math.ceil(cellH * 0.9)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < h; y += cellH) {
    for (let x = 0; x < w; x += cellW) {
      const avg = applyContrastRGB(
        blockAverage(data, w, h, x, y, cellW, cellH),
        settings.contrast,
      );
      let bits = 0;
      for (const [dx, dy, bit] of dots) {
        const L = luma(
          samplePixel(
            data,
            w,
            h,
            x + ((dx + 0.5) / 2) * cellW,
            y + ((dy + 0.5) / 4) * cellH,
          ),
        );
        if (L < 172) bits |= bit;
      }
      ctx.fillStyle = glyphFillStyle(avg, luma(avg), intensity);
      ctx.fillText(String.fromCharCode(10240 + bits), x + cellW / 2, y + cellH / 2);
    }
  }
  ctx.restore();
}

const LIME_PAPER: RGB = [188, 230, 56];
const PROCESS_C: RGB = [0, 155, 210];
const PROCESS_M: RGB = [214, 12, 112];
const PROCESS_Y: RGB = [242, 214, 0];
const PROCESS_K: RGB = [28, 26, 22];

type DotScreen = {
  ink: RGB;
  angle: number;
  amountOf: (rgb: RGB) => number;
};

const rgbToCmyk = (rgb: RGB) => {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const k = 1 - Math.max(r, g, b);
  const d = Math.max(0.001, 1 - k);
  return {
    c: (1 - r - k) / d,
    m: (1 - g - k) / d,
    y: (1 - b - k) / d,
    k,
  };
};

function drawDotScreens(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
  paper: RGB,
  screens: readonly DotScreen[],
) {
  const { width: w, height: h, data } = img;
  const s = scale(w, h);
  const cell = (6 + ((100 - settings.detail) / 100) * 16) * s;
  const intensity = settings.intensity / 100;
  const pad = Math.hypot(w, h) + cell;
  const cx0 = w / 2;
  const cy0 = h / 2;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = rgba(paper, intensity);
  ctx.fillRect(0, 0, w, h);

  for (const screen of screens) {
    const cos = Math.cos(screen.angle);
    const sin = Math.sin(screen.angle);
    ctx.fillStyle = rgba(screen.ink, intensity);
    for (let v = -pad; v <= pad; v += cell) {
      for (let u = -pad; u <= pad; u += cell) {
        const x = u * cos - v * sin + cx0;
        const y = u * sin + v * cos + cy0;
        if (x < -cell || x > w + cell || y < -cell || y > h + cell) continue;
        const avg = applyContrastRGB(
          blockAverage(data, w, h, x - cell / 2, y - cell / 2, cell, cell),
          settings.contrast + 8,
        );
        const amount = clamp(screen.amountOf(avg), 0, 1);
        if (amount <= 0.02) continue;
        const r = Math.sqrt(amount / Math.PI) * cell * 0.92;
        if (r < 0.35) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Halftone — CMYK angled screens on lime paper */
export function drawHalftone(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
) {
  drawDotScreens(ctx, img, settings, LIME_PAPER, [
    { ink: PROCESS_Y, angle: 0, amountOf: (rgb) => rgbToCmyk(rgb).y },
    { ink: PROCESS_C, angle: (15 * Math.PI) / 180, amountOf: (rgb) => rgbToCmyk(rgb).c },
    { ink: PROCESS_M, angle: (75 * Math.PI) / 180, amountOf: (rgb) => rgbToCmyk(rgb).m },
    {
      ink: PROCESS_K,
      angle: Math.PI / 4,
      amountOf: (rgb) => rgbToCmyk(rgb).k * 0.72,
    },
  ]);
}

/** Newsprint — monochrome round-dot screen */
export function drawNewsprint(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
) {
  drawDotScreens(ctx, img, settings, PAPER_BASE, [
    {
      ink: PROCESS_K,
      angle: Math.PI / 4,
      amountOf: (rgb) => 1 - luma(rgb) / 255,
    },
  ]);
}

/** Isoform — isometric voxel diamonds */
export function drawVoxel(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
) {
  const { width: w, height: h, data } = img;
  const s = scale(w, h);
  const cell = (8 + Math.round(((100 - settings.detail) / 100) * 9)) * s;
  const half = cell / 2;
  const lift = cell * 0.3;
  const intensity = settings.intensity / 100;
  ctx.save();
  for (let y = 0; y < h + cell; y += cell * 0.72) {
    for (let x = -half; x < w + cell; x += cell) {
      const ox = x + (Math.round(y / (cell * 0.72)) % 2) * half;
      const avg = applyContrastRGB(
        samplePixel(data, w, h, ox + half, y),
        settings.contrast,
      );
      const faces = [1.3, 0.92, 0.55].map((m) => avg.map((v) => clamp(v * m)));
      const cx = ox + half;
      const cy = y;
      ctx.fillStyle = rgba(faces[0] ?? avg, intensity * 0.9);
      ctx.beginPath();
      ctx.moveTo(cx, cy - lift);
      ctx.lineTo(cx + half, cy);
      ctx.lineTo(cx, cy + lift);
      ctx.lineTo(cx - half, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(faces[1] ?? avg, intensity * 0.9);
      ctx.beginPath();
      ctx.moveTo(cx - half, cy);
      ctx.lineTo(cx, cy + lift);
      ctx.lineTo(cx, cy + lift * 2.5);
      ctx.lineTo(cx - half, cy + lift * 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(faces[2] ?? avg, intensity * 0.9);
      ctx.beginPath();
      ctx.moveTo(cx + half, cy);
      ctx.lineTo(cx, cy + lift);
      ctx.lineTo(cx, cy + lift * 2.5);
      ctx.lineTo(cx + half, cy + lift * 1.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

export function applyCanvasFilter(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  settings: FilterSettings,
  id: FilterId,
) {
  if (id === 'pixel-art' || id === 'mosaic' || id === 'lego' || id === 'disco') {
    drawBlocky(ctx, img, settings, id);
    return;
  }
  if (id === 'braille') {
    drawBraille(ctx, img, settings);
    return;
  }
  if (id === 'voxel') {
    drawVoxel(ctx, img, settings);
    return;
  }
  if (id === 'dots') {
    drawStipple(ctx, img, settings);
    return;
  }
  if (id === 'dot-cross') {
    drawDotCross(ctx, img, settings);
    return;
  }
  if (id === 'halftone') {
    drawHalftone(ctx, img, settings);
    return;
  }
  if (id === 'newsprint') {
    drawNewsprint(ctx, img, settings);
    return;
  }
  drawGlyphField(ctx, img, settings, id);
}
