#!/usr/bin/env python3
"""Create a deterministic installable extension archive."""

from __future__ import annotations

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent.parent
INCLUDE = [ROOT / "manifest.json", ROOT / "assets" / "dictionary.json", ROOT / "src"]


def files() -> list[Path]:
    result: list[Path] = []
    for item in INCLUDE:
        result.extend(sorted(item.rglob("*")) if item.is_dir() else [item])
    return [item for item in result if item.is_file()]


def main() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    output = ROOT / "dist" / f"liucitongdu-{version}.zip"
    output.parent.mkdir(exist_ok=True)

    with ZipFile(output, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files():
            info = ZipInfo(path.relative_to(ROOT).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    print(f"Wrote {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
