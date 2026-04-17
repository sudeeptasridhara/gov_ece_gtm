"""
enrich_leadership.py — One-time (re-runnable) enrichment script.

For each district that doesn't yet have a `superintendent` field, searches
Google News RSS to find:
  - Current superintendent name
  - Approximate tenure start year
  - Source URL for the finding

Writes three new fields to data/districts.json:
  superintendent          — full name string, e.g. "Dr. Jane Smith"
  superintendentSince     — integer year, e.g. 2021  (null if unknown)
  superintendentSrc       — URL of the news item that confirmed the name

Skips test entries (isTest: true) and districts that already have a
non-empty superintendent value (safe to re-run).

Usage:
    python scripts/enrich_leadership.py

Run time: ~2–4 hours for the full dataset (rate-limited to avoid
Google News throttling). Re-run any time to fill gaps.
"""

import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, date

DATA_PATH = "data/districts.json"

# ── Name extraction patterns ───────────────────────────────────────────────────
# Ordered from most specific to broadest.  Each pattern must produce a
# named group 'name' that captures "FirstName LastName" (with optional
# middle initial / suffix / title prefix).

NAME_PREFIX = r"(?:Dr\.?\s+|Mr\.?\s+|Ms\.?\s+|Mrs\.?\s+)?"
LAST_FIRST  = r"[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+"   # "Jane A. Smith"

# Pattern set — (regex, score)
# Higher score = more trustworthy match
NAME_PATTERNS = [
    # "named/hired/appointed [Title] [Name]"
    (re.compile(
        r"(?:named|hired|appointed|selected|chosen)\s+(?:as\s+)?(?:new\s+)?superintendent\s+(?:" + NAME_PREFIX + r")(" + LAST_FIRST + r")",
        re.I), 10),
    # "[Name] named/hired/appointed superintendent"
    (re.compile(
        r"(" + NAME_PREFIX + LAST_FIRST + r")\s+(?:named|hired|appointed|selected|chosen|tapped)\s+(?:as\s+)?(?:new\s+)?superintendent",
        re.I), 10),
    # "[Name] to serve as superintendent" / "will be superintendent"
    (re.compile(
        r"(" + NAME_PREFIX + LAST_FIRST + r")\s+(?:to\s+serve|will\s+(?:serve|be))\s+as\s+superintendent",
        re.I), 9),
    # "Superintendent [Name]" — as part of a longer clause
    (re.compile(
        r"\bSuperintendent\s+(" + NAME_PREFIX + LAST_FIRST + r")",
        re.I), 7),
    # "[Name], superintendent of / at"
    (re.compile(
        r"(" + NAME_PREFIX + LAST_FIRST + r"),?\s+superintendent\s+(?:of|at|for)",
        re.I), 8),
    # "[Name] retiring as superintendent" / "[Name] resigning"
    (re.compile(
        r"(" + NAME_PREFIX + LAST_FIRST + r")\s+(?:retiring|resigning|stepping down|leaving)\s+as\s+superintendent",
        re.I), 6),
]

# Tenure patterns — look for years in news text
TENURE_PATTERNS = [
    re.compile(r"(?:since|starting|began|joined|appointed|hired|named)\s+(?:in\s+)?(\d{4})", re.I),
    re.compile(r"(\d{4})[–\-]\d{4}\s+superintendent", re.I),
    re.compile(r"superintendent\s+(?:since|starting|from|in)\s+(\d{4})", re.I),
    re.compile(r"(\d{4})\s+(?:school year|academic year).*superintendent", re.I),
]

CURRENT_YEAR = date.today().year


# ── Google News RSS helper ────────────────────────────────────────────────────
def fetch_rss(query: str, max_results: int = 10) -> list:
    encoded = urllib.parse.quote(query)
    url = (
        f"https://news.google.com/rss/search"
        f"?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read()
        root = ET.fromstring(raw)
        items = []
        for item in root.findall(".//item")[:max_results]:
            title = item.findtext("title") or ""
            link  = item.findtext("link")  or ""
            pub   = item.findtext("pubDate") or ""
            desc  = item.findtext("description") or ""
            items.append({"title": title, "link": link, "published": pub, "desc": desc})
        return items
    except Exception as e:
        print(f"    RSS error for '{query[:55]}': {e}")
        return []


# ── Name / tenure extraction ───────────────────────────────────────────────────
def extract_name(text: str) -> tuple[str | None, int]:
    """Return (name, score) for the best match found in text, or (None, 0)."""
    best_name  = None
    best_score = 0
    for pattern, score in NAME_PATTERNS:
        m = pattern.search(text)
        if m and score > best_score:
            raw = m.group(1).strip()
            # Strip leading honorifics that slipped through
            raw = re.sub(r"^(?:Dr\.?\s+|Mr\.?\s+|Ms\.?\s+|Mrs\.?\s+)", "", raw, flags=re.I).strip()
            # Must be at least two words, each capitalised
            parts = raw.split()
            if len(parts) >= 2 and all(p[0].isupper() for p in parts if p):
                best_name  = raw
                best_score = score
    return best_name, best_score


def extract_tenure_year(text: str) -> int | None:
    for pattern in TENURE_PATTERNS:
        m = pattern.search(text)
        if m:
            year = int(m.group(1))
            if 2000 <= year <= CURRENT_YEAR:
                return year
    return None


# ── Per-district enrichment ───────────────────────────────────────────────────
def enrich_district(d: dict) -> bool:
    """
    Search for superintendent data for one district.
    Returns True if the district dict was updated.
    """
    district_name = d.get("district", "")
    # Strip state prefix e.g. "CA — Westminster School District" → "Westminster School District"
    search_name = re.sub(r"^[A-Z]{2}\s*[—\-–]\s*", "", district_name).strip()
    search_name = search_name.split("(")[0].strip()

    best_name  = None
    best_score = 0
    best_src   = ""
    best_year  = None

    queries = [
        f'"{search_name}" superintendent 2024 OR 2025 OR 2026',
        f'"{search_name}" superintendent named OR hired OR appointed OR retiring',
        f'"{search_name}" new superintendent',
    ]

    for query in queries:
        items = fetch_rss(query, max_results=8)
        time.sleep(1.2)

        for item in items:
            combined = item["title"] + " " + item.get("desc", "")
            name, score = extract_name(combined)
            if name and score > best_score:
                best_name  = name
                best_score = score
                best_src   = item["link"]
                year = extract_tenure_year(combined)
                if year:
                    best_year = year

        if best_score >= 8:
            break  # good enough — skip remaining queries

    if best_name:
        d["superintendent"]      = best_name
        d["superintendentSince"] = best_year  # may be None
        d["superintendentSrc"]   = best_src
        print(f"    ✓ {best_name}" + (f" (since {best_year})" if best_year else "") + f"  [score {best_score}]")
        return True
    else:
        # Write a sentinel so we don't retry forever on unresolvable districts
        d["superintendent"]      = ""
        d["superintendentSince"] = None
        d["superintendentSrc"]   = ""
        print(f"    – no name found")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"Starting leadership enrichment — {date.today()}")

    with open(DATA_PATH) as f:
        districts = json.load(f)

    total      = 0
    enriched   = 0
    skipped    = 0

    for i, d in enumerate(districts):
        # Skip test entries
        if d.get("isTest"):
            continue

        # Skip if already has a non-empty superintendent
        if d.get("superintendent"):
            skipped += 1
            continue

        tier = d.get("priorityTier", "Tier 3")
        # Only enrich Tier 1 and Tier 2 on first pass (Tier 3 can wait)
        if tier not in ("Tier 1", "Tier 2"):
            continue

        total += 1
        name_display = d.get("district", "?")[:60]
        print(f"  [{i+1}/{len(districts)}] {name_display} ({tier})")

        changed = enrich_district(d)
        if changed:
            enriched += 1

        # Save incrementally every 10 districts so partial progress is never lost
        if total % 10 == 0:
            with open(DATA_PATH, "w") as f:
                json.dump(districts, f, indent=2)
            print(f"    (checkpoint saved — {enriched}/{total} enriched so far)")

        time.sleep(2)  # polite rate-limiting between districts

    # Final save
    with open(DATA_PATH, "w") as f:
        json.dump(districts, f, indent=2)

    print(f"\nDone. {enriched}/{total} Tier 1/2 districts enriched → {DATA_PATH}")
    print(f"({skipped} already had superintendent data, skipped)")


if __name__ == "__main__":
    main()
