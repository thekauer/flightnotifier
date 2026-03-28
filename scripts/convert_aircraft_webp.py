#!/usr/bin/env python3
"""
Convert aircraft image assets to WebP using the `cwebp` CLI.

Writes `.webp` files next to the original `.jpg` / `.jpeg` / `.png` files
under `public/assets/aircraft` and keeps the originals intact.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "public" / "assets" / "aircraft"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def build_command(source: Path, destination: Path, quality: int) -> list[str]:
    command = ["cwebp", "-quiet", "-mt"]
    if source.suffix.lower() == ".png":
        command.extend(["-lossless", "-m", "6"])
    else:
        command.extend(["-q", str(quality)])
    command.extend([str(source), "-o", str(destination)])
    return command


def iter_source_images(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def convert_image(source: Path, destination: Path, quality: int) -> tuple[bool, str]:
    command = build_command(source, destination, quality)
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode == 0:
        return True, ""
    error = result.stderr.strip() or result.stdout.strip() or "unknown cwebp error"
    return False, error


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert aircraft assets to WebP using cwebp."
    )
    parser.add_argument(
        "--root",
        default=str(ROOT),
        help="Root directory to scan (default: public/assets/aircraft).",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=82,
        help="JPEG/WebP quality for lossy inputs (default: 82).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild WebP files even if they already exist and are newer.",
    )
    args = parser.parse_args()

    if shutil.which("cwebp") is None:
        print("error: `cwebp` was not found in PATH.", file=sys.stderr)
        print("Install the WebP CLI first, then rerun this script.", file=sys.stderr)
        return 1

    root = Path(args.root).resolve()
    if not root.exists():
        print(f"error: root directory does not exist: {root}", file=sys.stderr)
        return 1

    files = iter_source_images(root)
    converted = 0
    skipped = 0
    failed: list[tuple[Path, str]] = []

    for source in files:
        destination = source.with_suffix(".webp")
        if (
            not args.force
            and destination.exists()
            and destination.stat().st_mtime >= source.stat().st_mtime
        ):
            skipped += 1
            continue

        ok, error = convert_image(source, destination, args.quality)
        if ok:
            converted += 1
        else:
            failed.append((source, error))

    print(f"root={root}")
    print(f"converted={converted}")
    print(f"skipped={skipped}")
    print(f"failed={len(failed)}")

    if failed:
        for source, error in failed[:20]:
            print(f"FAIL {source}: {error}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
