#!/usr/bin/env python3
"""Decode _xfer base64 chunks into source files. Exact bytes. Then delete _xfer."""
import base64, hashlib, pathlib, shutil, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
XFER = ROOT / "_xfer"
MAP = {
    "App.css": ROOT / "src" / "App.css",
    "canvas.ts": ROOT / "src" / "filters" / "canvas.ts",
    "pixel.ts": ROOT / "src" / "filters" / "pixel.ts",
    "package-lock.json": ROOT / "package-lock.json",
}
EXPECTED = {
    "App.css": "edf0395734097350e9685eb8bdafba84",
    "canvas.ts": "dfceba1b07cf06a29a1da2d82f775353",
    "pixel.ts": "e0bf986727893ae6b0835855761760bf",
    "package-lock.json": "41cd0cd1a58652ea986d752660752aa0",
}
for name, dest in MAP.items():
    parts = sorted(XFER.glob(f"{name}.*.b64"))
    if not parts:
        print("skip", name)
        continue
    data = base64.b64decode("".join(p.read_text().strip() for p in parts))
    md5 = hashlib.md5(data).hexdigest()
    if md5 != EXPECTED[name]:
        sys.exit(f"md5 mismatch {name}: {md5} != {EXPECTED[name]}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    print("wrote", dest, len(data), md5)
if XFER.exists():
    shutil.rmtree(XFER)
    print("removed _xfer")
