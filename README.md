# Textures

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vite.dev/)

Client-only image texture filters in the browser. Upload a photo, pick a style from the dock, tweak Detail / Intensity / Contrast, and download a PNG — no backend, no AI APIs.

Inspired by [texture.fayaz.workers.dev](https://texture.fayaz.workers.dev/) by [Fayaz Ahmed](https://github.com/fayazara). This is an **independent reimplementation** — see [NOTICE](./NOTICE).

## Features

- 25+ canvas / ImageData filters (risograph, glyphfield, dither, grain, watercolor, cyanotype, and more)
- Live Detail, Intensity, and Contrast controls
- Replace image + download PNG
- Fully client-side (Vite + React)

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173`).

```bash
npm run build    # production build → dist/
npm run preview  # preview the build
```

## Usage

1. A sample image loads from `public/sample-image.jpg`.
2. Pick a filter from the bottom dock.
3. Adjust **Detail** / **Intensity** / **Contrast** in the top panel.
4. Replace the image with the top-left button.
5. Download a PNG with the top-right button.

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- Canvas 2D / `ImageData` for filters (no WebGL required)

## Layout

```
src/
  App.tsx              # UI shell
  filters/
    types.ts           # FilterId, settings
    helpers.ts         # Shared helpers
    pixel.ts           # Pixel-buffer filters
    canvas.ts          # Canvas drawing filters
    index.ts           # Presets + applyFilter
public/
  sample-image.jpg     # Default demo image
  favicon.svg
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © 2026 Mohtasham Madani. Attribution and inspiration notes are in [NOTICE](./NOTICE).
