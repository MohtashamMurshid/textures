import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FILTER_LABELS,
  FILTER_PRESETS,
  applyFilter,
  fitSize,
  type FilterId,
  type FilterSettings,
} from './filters';
import './App.css';

const SAMPLE = '/sample-image.jpg';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [filterId, setFilterId] = useState<FilterId>('characters');
  const [settings, setSettings] = useState<FilterSettings>(
    FILTER_PRESETS[0]!.settings,
  );
  const [hasImage, setHasImage] = useState(false);
  const [imageEpoch, setImageEpoch] = useState(0);
  const [isSample, setIsSample] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [hoverId, setHoverId] = useState<FilterId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(async () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setRendering(true);
    try {
      const { width, height } = fitSize(img.naturalWidth, img.naturalHeight);
      // Yield so UI can show spinner for heavy filters
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      applyFilter(img, canvas, filterId, settings, width, height);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Render failed');
    } finally {
      setRendering(false);
    }
  }, [filterId, settings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImage(SAMPLE);
        if (cancelled) return;
        imageRef.current = img;
        setHasImage(true);
        setIsSample(true);
        setImageEpoch((n) => n + 1);
      } catch {
        if (!cancelled) setError('Could not load sample image');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hasImage) void render();
  }, [hasImage, imageEpoch, render]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const onSelectFilter = (id: FilterId) => {
    const preset = FILTER_PRESETS.find((p) => p.id === id);
    setFilterId(id);
    if (preset) setSettings({ ...preset.settings });
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      imageRef.current = img;
      setHasImage(true);
      setIsSample(false);
      setImageEpoch((n) => n + 1);
    } catch {
      URL.revokeObjectURL(url);
      setError('Failed to load image');
    }
  };

  const onDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasImage) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `texture-${filterId}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };

  const setSetting = (key: keyof FilterSettings, value: number) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  return (
    <div className="app-shell">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      <button
        type="button"
        className="icon-action replace-action"
        aria-label="Replace image"
        title="Replace image"
        onClick={() => fileRef.current?.click()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16" />
          <path d="M14 14l1.5-1.5a2 2 0 012.8 0L20 14" />
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <button
        type="button"
        className="icon-action download-action"
        aria-label="Download PNG"
        title="Download PNG"
        disabled={!hasImage || rendering}
        onClick={onDownload}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 4v12" />
          <path d="M7 12l5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      </button>

      <div className="settings-panel" aria-label="Filter settings">
        {(
          [
            ['detail', 'Detail'],
            ['intensity', 'Intensity'],
            ['contrast', 'Contrast'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="setting">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings[key]}
              onChange={(e) => setSetting(key, Number(e.target.value))}
            />
            <em>{settings[key]}</em>
          </label>
        ))}
      </div>

      <main className="image-stage">
        <div className="image-frame">
          {!hasImage ? (
            <button
              type="button"
              className="upload-trigger"
              aria-label="Upload image"
              onClick={() => fileRef.current?.click()}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          ) : (
            <>
              <canvas ref={canvasRef} />
              {isSample && <span className="sample-label">SAMPLE</span>}
              {rendering && <span className="render-dot" aria-hidden />}
            </>
          )}
        </div>
      </main>

      <div className="dock-outer">
        <div className="dock-panel">
          <div className="dock-scroll" role="listbox" aria-label="Filters">
            {FILTER_PRESETS.map((preset) => {
              const selected = filterId === preset.id;
              const showTip = hoverId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={FILTER_LABELS[preset.id]}
                  title={FILTER_LABELS[preset.id]}
                  className={`filter-option${selected ? ' is-selected' : ''}`}
                  onClick={() => onSelectFilter(preset.id)}
                  onMouseEnter={() => setHoverId(preset.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  {showTip && (
                    <span className="dock-label">{FILTER_LABELS[preset.id]}</span>
                  )}
                  <span className={`filter-swatch ${preset.id}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-toast" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
