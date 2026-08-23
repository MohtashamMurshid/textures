#!/usr/bin/env python3
"""Decode _payloads/*.NN.b64 chunk sets into source files."""
from __future__ import annotations

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAYLOADS = ROOT / "_payloads"

SETS = {
    "appcss": ROOT / "src" / "App.css",
    "canvas": ROOT / "src" / "filters" / "canvas.ts",
    "pixel": ROOT / "src" / "filters" / "pixel.ts",
    "favicon": ROOT / "public" / "favicon.svg",
}


def decode_set(name: str, dest: Path) -> None:
    chunks = sorted(PAYLOADS.glob(f"{name}.*.b64"))
    if not chunks:
        print(f"skip {name}: no chunks")
        return
    blob = "".join(p.read_text().strip() for p in chunks)
    data = base64.b64decode(blob)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    print(f"wrote {dest.relative_to(ROOT)} ({len(data)} bytes) from {len(chunks)} chunks")


def main() -> None:
    for name, dest in SETS.items():
        decode_set(name, dest)


if __name__ == "__main__":
    main()
