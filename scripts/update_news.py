"""
update_news.py — Additive-only news updater for Florida PreK district dashboard.

Runs weekly via GitHub Actions. For each Tier 1 and Tier 2 district it:
  1. Searches Google News RSS for recent mentions
  2. Detects board meeting minutes and appends to boardNotes (new field)
  3. Detects buying signals (curriculum news, leadership changes, grants) and
     appends to buyingSignals — NEVER overwrites existing entries
  4. Stamps lastUpdated on any district that received new data

Usage:
    python scripts/update_news.py
"""

import json
import re
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import date, datetime

DATA_PATH = "data/districts.json"

# Keywords that indicate a board meeting with relevant content
BOARD_KEYWORDS = [
    "school board", "board meeting", "board minutes", "board agenda",
    "curriculum adoption", "curriculum review", "vpk", "pre-k", "prek",
    "early childhood", "kindergarten readiness", "head start",
]

# Keywords that indicate a buying signal worth capturing
SIGNAL_KEYWORDS = [
    "curriculum", "new superintendent", "new director", "new principal",
    "grant", "expansion", "readiness", "vpk", "pre-k", "early childhood",
    "improvement plan", "budget", "rfp", "vendor", "pilot program",
]

BOARD_SIGNAL_KEYWORDS = [
    "curriculum", "vpk", "pre-k", "prek", "early childhood",
    "kindergarten", "head start", "instructional material",
]


def fetch_rss(query: str, max_results: int = 8) -> list[dict]:
    """Fetch Google News RSS for a query. Returns list of {title, link, published}."""
    encoded = urllib.parse.quote(query)
    url = (
        f"https://news.google.com/rss/search"
        f"?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
        root = ET.fromstring(raw)
        items = []
        for item in root.findall(".//item")[:max_results]:
            title = item.findtext("title") or ""
            link  = item.findtext("link")  or ""
            pub   = item.findtext("pubDate") or ""
            items.append({"title": title, "link": link, "published": pub})
        return items
    except Exception as e:
        print(f"  RSS fetch failed for '{query}': {e}")
        return []


def parse_pub_date(pub_str: str) -> str:
    """Convert RSS pubDate string to YYYY-MM-DD, fallback to today."""
    try:
        dt = datetime.strptime(pub_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return str(date.today())


def is_recent(pub_str: str, days: int = 90) -> bool:
    """Return True if the item was published within `days` days."""
    try:
        dt = datetime.strptime(pub_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
        delta = datetime.utcnow() - dt
        return delta.days <= days
    except Exception:
        return True  # include if we can't parse


def contains_keywords(text: str, keywords: list[str]) -> bool:
    t = text.lower()
    return any(kw in t for kw in keywords)


def already_captured(existing: list, new_text: str) -> bool:
    """Fuzzy dedup: skip if a very similar string already exists."""
    new_lower = new_text.lower()[:80]
    for entry in existing:
        if isinstance(entry, str):
            if entry.lower()[:80] == new_lower:
                return True
        elif isinstance(entry, dict):
            existing_text = (entry.get("summary", "") + entry.get("source", "")).lower()
            if new_lower[:40] in existing_text:
                return True
    return False


def update_district(d: dict) -> bool:
    """Search for news for one district. Returns True if any new data was added."""
    county   = d.get("county", "")
    district = d.get("district", "")
    tier     = d.get("priorityTier", "Tier 3")

    # Only run for Tier 1 and Tier 2 (Tier 3 is watch-list only)
    if tier not in ("Tier 1", "Tier 2"):
        return False

    changed = False
    search_name = district.split("(")[0].strip()  # drop parenthetical abbreviations

    # ── 1. Board meeting / board minutes search ────────────────────────────────
    board_query = f'"{search_name}" school board minutes OR agenda 2025 OR 2026'
    board_items = fetch_rss(board_query, max_results=5)
    time.sleep(1)  # be polite

    for item in board_items:
        if not is_recent(item["published"], days=120):
            continue
        title = item["title"]
        if not contains_keywords(title, BOARD_SIGNAL_KEYWORDS):
            continue
        pub_date = parse_pub_date(item["published"])
        summary  = re.sub(r"\s*-\s*Google News$", "", title).strip()

        new_note = {"date": pub_date, "summary": summary, "source": item["link"]}
        if not already_captured(d.get("boardNotes", []), summary):
            d.setdefault("boardNotes", []).append(new_note)
            changed = True
            print(f"    [BOARD NOTE] {pub_date}: {summary[:70]}")

    # ── 2. General buying-signal news ─────────────────────────────────────────
    signal_query = f'"{search_name}" early childhood OR vpk OR curriculum OR "school readiness" 2025 OR 2026'
    signal_items = fetch_rss(signal_query, max_results=5)
    time.sleep(1)

    for item in signal_items:
        if not is_recent(item["published"], days=120):
            continue
        title = item["title"]
        if not contains_keywords(title, SIGNAL_KEYWORDS):
            continue
        summary = re.sub(r"\s*-\s*Google News$", "", title).strip()
        pub_date = parse_pub_date(item["published"])
        signal   = f"{summary} ({pub_date})"

        if not already_captured(d.get("buyingSignals", []), signal):
            d.setdefault("buyingSignals", []).append(signal)
            changed = True
            print(f"    [SIGNAL] {signal[:80]}")

    # ── 3. Leadership / contact change search ─────────────────────────────────
    leadership_query = f'"{search_name}" "early childhood" OR "vpk" director OR coordinator hired OR appointed 2025 OR 2026'
    leader_items = fetch_rss(leadership_query, max_results=3)
    time.sleep(1)

    for item in leader_items:
        if not is_recent(item["published"], days=180):
            continue
        title = item["title"]
        if not contains_keywords(title, ["director", "coordinator", "hired", "appointed", "new "]):
            continue
        summary  = re.sub(r"\s*-\s*Google News$", "", title).strip()
        pub_date = parse_pub_date(item["published"])
        signal   = f"⚠️ Possible contact change: {summary} ({pub_date}) — verify contact info"

        if not already_captured(d.get("buyingSignals", []), signal):
            d.setdefault("buyingSignals", []).append(signal)
            changed = True
            print(f"    [CONTACT ALERT] {signal[:80]}")

    return changed


def main():
    print(f"Starting update — {date.today()}")

    with open(DATA_PATH) as f:
        districts = json.load(f)

    updated_count = 0
    for d in districts:
        county = d.get("county", "?")
        tier   = d.get("priorityTier", "?")
        if tier not in ("Tier 1", "Tier 2"):
            continue
        print(f"  Checking {county} County ({tier})...")
        changed = update_district(d)
        if changed:
            d["lastUpdated"] = str(date.today())
            updated_count += 1
        time.sleep(2)  # rate-limit between districts

    with open(DATA_PATH, "w") as f:
        json.dump(districts, f, indent=2)

    print(f"\nDone. {updated_count} district(s) updated → {DATA_PATH}")


if __name__ == "__main__":
    main()
