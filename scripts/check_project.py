#!/usr/bin/env python3
"""Validate the extension's release-critical files using only the standard library."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
REQUIRED_DOCS = ["README.md", "LICENSE", "PRIVACY.md", "CONTRIBUTING.md", "SECURITY.md"]
JAVASCRIPT_FILES = sorted((ROOT / "src").glob("*.js"))


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"Cannot read {path.relative_to(ROOT)}: {error}")


def check_manifest() -> None:
    manifest = load_json(ROOT / "manifest.json")
    if manifest.get("manifest_version") != 3:
        fail("manifest.json must use Manifest V3")
    if "<all_urls>" in manifest.get("host_permissions", []):
        fail("Do not request persistent <all_urls> host access")

    referenced = [
        manifest.get("action", {}).get("default_popup"),
        manifest.get("background", {}).get("service_worker"),
    ]
    for group in manifest.get("web_accessible_resources", []):
        referenced.extend(group.get("resources", []))
    for value in filter(None, referenced):
        if not (ROOT / value).is_file():
            fail(f"Manifest references missing file: {value}")


def check_dictionary() -> None:
    payload = load_json(ROOT / "assets" / "dictionary.json")
    entries = payload.get("entries")
    if not isinstance(entries, dict) or not entries:
        fail("Dictionary must contain a non-empty entries object")
    if payload.get("entryCount") != len(entries):
        fail("Dictionary entryCount does not match entries")
    for key, entry in entries.items():
        if key != key.lower() or entry.get("word") != key:
            fail(f"Dictionary key is not normalized: {key}")
        if not entry.get("lists") or not entry.get("translations"):
            fail(f"Dictionary entry is incomplete: {key}")


def check_javascript() -> None:
    node = shutil.which("node")
    jsc = Path("/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc")
    if node:
        command = lambda path: [node, "--check", str(path)]
    elif jsc.is_file():
        command = lambda path: [
            str(jsc),
            f"--strict-file={path.relative_to(ROOT)}",
            "--ignoreUncaughtExceptions",
        ]
    else:
        print("WARN: Node.js/JavaScriptCore unavailable; JavaScript syntax checks were skipped")
        return
    for path in JAVASCRIPT_FILES:
        result = subprocess.run(command(path), cwd=ROOT, capture_output=True, text=True)
        if result.returncode:
            fail(result.stderr.strip())


def main() -> None:
    for name in REQUIRED_DOCS:
        if not (ROOT / name).is_file():
            fail(f"Missing open-source file: {name}")
    check_manifest()
    check_dictionary()
    check_javascript()
    print(f"OK: checked {len(JAVASCRIPT_FILES)} JavaScript files and release metadata")


if __name__ == "__main__":
    main()
