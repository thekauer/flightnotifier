#!/usr/bin/env python3
"""
One-off: fill public/assets/aircraft/* from Wikimedia Commons search.
Uses stdlib only. Identifying User-Agent required by WMF.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "aircraft")
UA = "FlightNotifier/1.0 (https://github.com; aircraft quiz assets; +local)"

# folder -> search queries (tried in order)
CONFIG: dict[str, list[str]] = {
    "boeing-747": [
        "Boeing 747",
        "747-400",
        "747-8",
        "Boeing 747-400",
    ],
    "boeing-777": [
        "Boeing 777",
        "777-300ER",
        "Boeing 777-200",
    ],
    "boeing-787": [
        "Boeing 787",
        "787 Dreamliner",
        "787-9",
    ],
    "airbus-a330": ["Airbus A330"],
    "airbus-a340": [
        "Airbus A340",
        "A340-600",
        "A340-300",
    ],
    "airbus-a350": [
        "Airbus A350",
        "A350-900",
        "A350-1000",
    ],
    "airbus-a380": [
        "Airbus A380",
        "A380-800",
    ],
    "embraer-ejet": [
        "Embraer E-Jet",
        "Embraer E190",
        "Embraer E175",
        "Embraer 195",
        "Embraer ERJ",
    ],
    "atr-72": [
        "ATR 72",
        "ATR-72",
        "ATR72",
    ],
    "dash-8": [
        "Bombardier Dash 8",
        "De Havilland Canada Dash 8",
        "DHC-8",
        "Q400 aircraft",
    ],
    "bombardier-crj": [
        "Bombardier CRJ",
        "Canadair Regional Jet",
        "CRJ900",
        "CRJ700",
    ],
}

BAD_SUBSTR = (
    "diagram",
    "seat map",
    "cutaway",
    "cockpit layout",
)

SKIP_EXT = (".svg", ".pdf", ".djvu", ".gif", ".webm", ".ogv")


def api_get(params: dict) -> dict:
    base = "https://commons.wikimedia.org/w/api.php"
    url = base + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def search_files(query: str, offset: int) -> tuple[list[str], bool]:
    data = api_get(
        {
            "action": "query",
            "format": "json",
            "list": "search",
            "srsearch": query,
            "srnamespace": "6",
            "srlimit": "50",
            "sroffset": str(offset),
        }
    )
    hits = data.get("query", {}).get("search", [])
    titles = [h["title"] for h in hits]
    cont = data.get("continue", {})
    next_off = cont.get("sroffset")
    has_more = next_off is not None
    return titles, has_more


def image_thumb_url(title: str) -> tuple[str | None, str]:
    """Return (download_url, suggested_suffix) or (None, reason)."""
    low = title.lower()
    if any(low.endswith(ext) for ext in SKIP_EXT):
        return None, "bad ext"
    if any(b in low for b in BAD_SUBSTR):
        return None, "filtered title"
    data = api_get(
        {
            "action": "query",
            "format": "json",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|mime|size",
            "iiurlwidth": "1600",
        }
    )
    pages = data.get("query", {}).get("pages", {})
    for _pid, page in pages.items():
        infos = page.get("imageinfo") or []
        if not infos:
            return None, "no imageinfo"
        info = infos[0]
        mime = (info.get("mime") or "").lower()
        if "svg" in mime or "pdf" in mime:
            return None, mime
        w = int(info.get("width") or 0)
        h = int(info.get("height") or 0)
        if w and h and w * h < 120_000:
            return None, "too small"
        url = info.get("thumburl") or info.get("url")
        if not url:
            return None, "no url"
        if mime == "image/png" or url.lower().endswith(".png"):
            return url, ".png"
        return url, ".jpg"


def download(url: str, dest: str) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            body = r.read()
        if len(body) < 8000:
            return False
        with open(dest, "wb") as f:
            f.write(body)
        return True
    except (urllib.error.HTTPError, urllib.error.URLError, OSError):
        return False


def existing_numbers(folder: str) -> set[int]:
    out: set[int] = set()
    for name in os.listdir(folder):
        if not name.endswith((".jpg", ".jpeg", ".png")):
            continue
        base = os.path.splitext(name)[0]
        if base.isdigit():
            out.add(int(base))
    return out


def next_slots(folder: str, target: int) -> list[int]:
    have = existing_numbers(folder)
    return [n for n in range(1, target + 1) if n not in have]


def fill_folder(folder_name: str, target: int = 50) -> tuple[int, str]:
    folder = os.path.join(ROOT, folder_name)
    os.makedirs(folder, exist_ok=True)
    slots = next_slots(folder, target)
    if not slots:
        return 0, "already complete"
    queries = CONFIG.get(folder_name, [folder_name.replace("-", " ")])
    seen_titles: set[str] = set()
    offset = 0
    qidx = 0
    downloaded = 0
    pending = list(slots)

    def try_title(title: str) -> bool:
        nonlocal downloaded
        if not pending:
            return False
        if title in seen_titles:
            return False
        seen_titles.add(title)
        url, suf = image_thumb_url(title)
        if not url:
            return False
        slot = pending[0]
        name = f"{slot:03d}{suf}"
        dest = os.path.join(folder, name)
        if os.path.exists(dest):
            pending.pop(0)
            downloaded += 1
            return True
        time.sleep(0.15)
        if not download(url, dest):
            return False
        pending.pop(0)
        downloaded += 1
        return True

    while pending:
        if qidx >= len(queries):
            break
        query = queries[qidx]
        titles, has_more = search_files(query, offset)
        if not titles:
            qidx += 1
            offset = 0
            continue
        for t in titles:
            if not pending:
                break
            try_title(t)
        if has_more:
            offset += 50
        else:
            qidx += 1
            offset = 0
        time.sleep(0.2)

    remaining = len(pending)
    if remaining > 0:
        return downloaded, f"missing {remaining} after exhausting queries"
    return downloaded, "ok"


def main() -> None:
    import sys

    if len(sys.argv) > 1:
        names = [n for n in sys.argv[1:] if n in CONFIG]
        unknown = [n for n in sys.argv[1:] if n not in CONFIG]
        if unknown:
            print("unknown folders:", ", ".join(unknown), file=sys.stderr)
    else:
        names = sorted(CONFIG.keys())
    for name in names:
        n, msg = fill_folder(name, 50)
        print(f"{name}: +{n} ({msg})")


if __name__ == "__main__":
    main()
