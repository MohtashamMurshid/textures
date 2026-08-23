# Contributing

Thanks for your interest in Textures.

## Setup

```bash
npm install
npm run dev
```

## Before opening a PR

1. Run `npm run build` and fix any TypeScript or build errors.
2. Keep the app **client-only** — no backend, no remote AI/API calls for filters.
3. Prefer small, focused changes with a clear description.

## Where filters live

| Path | Role |
|------|------|
| `src/filters/types.ts` | Filter IDs and settings types |
| `src/filters/helpers.ts` | Shared math / sampling helpers |
| `src/filters/pixel.ts` | ImageData (pixel) filters |
| `src/filters/canvas.ts` | Canvas2D drawing filters |
| `src/filters/index.ts` | Presets, labels, `applyFilter` entry point |
| `src/App.tsx` | UI (dock, settings, upload/download) |

Add new filters in `pixel.ts` or `canvas.ts`, register them in `types.ts` / `index.ts`, and add a dock swatch style in `App.css` if needed.
