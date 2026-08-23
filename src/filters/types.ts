export type FilterId =
  | 'risograph'
  | 'characters'
  | 'dither'
  | 'cobalt-grain'
  | 'denim-grain'
  | 'harbor-grain'
  | 'meadow-grain'
  | 'dot-cross'
  | 'block'
  | 'dots'
  | 'paper'
  | 'watercolor'
  | 'ink-wash'
  | 'cyanotype'
  | 'mixed'
  | 'pixel-art'
  | 'mosaic'
  | 'lego'
  | 'cross'
  | 'diamond'
  | 'lines'
  | 'diagonal'
  | 'braille'
  | 'voxel'
  | 'disco';

export type FilterSettings = {
  detail: number;
  intensity: number;
  contrast: number;
};

export type FilterPreset = {
  id: FilterId;
  settings: FilterSettings;
};

export type RGB = [number, number, number];
