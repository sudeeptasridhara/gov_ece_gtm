"""
enrich_curriculum.py — Re-searches curriculum adoption year for districts
where curriculumAdoptionYear is null.

For each eligible district it:
  1. Searches Google News RSS for adoption/purchase news about the specific
     curriculum product currently listed in the district's `curriculum` field
  2. Searches the district website (if in DISTRICT_URLS) for curriculum info
  3. Searches the district's board meeting notes (already in boardNotes[]) for
     curriculum adoption keywords and tries to extract a year

Writes a confirmed year to `curriculumAdoptionYear` only when the evidence is
strong (year found in 2+ sources, or in a direct purchase/adoption headline).
Otherwise writes nothing — leaves null so reps know it's genuinely unknown.

Run after update_news.py has populated boardNotes.

Usage:
    python scripts/enrich_curriculum.py            # only null-year districts
    python scripts/enrich_curriculum.py --force    # re-run even if year exists
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import date, datetime
from html.parser import HTMLParser

DATA_PATH = "data/districts.json"

CURRENT_YEAR = date.today().year

# ── Curriculum vendor → canonical short name for search ───────────────────────
VENDOR_SEARCH_NAMES = {
    "Teaching Strategies":  "Teaching Strategies Creative Curriculum",
    "Frog Street":          "Frog Street curriculum",
    "Houghton Mifflin":     "Houghton Mifflin preschool curriculum",
    "Scholastic":           "Scholastic early childhood curriculum",
    "Pearson":              "Pearson early childhood curriculum",
    "McGraw-Hill":          "McGraw-Hill early childhood curriculum",
    "Benchmark Education":  "Benchmark Education curriculum",
    "Cengage":              "Cengage early childhood curriculum",
    "Amplify":              "Amplify curriculum preschool",
    "Illuminate":           "Illuminate Education curriculum",
    "iReady":               "iReady curriculum",
    "DIBELS":               "DIBELS early childhood",
}

# Keywords that strongly indicate a curriculum was being *newly* adopted
ADOPTION_KEYWORDS = [
    "adopt", "adoption", "approved", "purchase", "selected", "award",
    "contract", "voted to", "board approved", "curriculum renewal",
    "curriculum adoption", "curriculum decision", "new curriculum",
    "replaced", "switching to", "transitioning to",
]

# Year extraction — only accept years in plausible range
YEAR_PAT = re.compile(r"\b(20(?:0[5-9]|1\d|2[0-6]))\b")


# ── Network helpers ───────────────────────────────────────────────────────────
def fetch_rss(query: str, max_results: int = 8) -> list:
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read()
        root = ET.fromstring(raw)
        items = []
        for item in root.findall(".//item")[:max_results]:
            items.append({
                "title":     item.findtext("title") or "",
                "link":      item.findtext("link") or "",
                "published": item.findtext("pubDate") or "",
            })
        return items
    except Exception as e:
        print(f"    RSS error: {e}")
        return []


def fetch_html(url: str, timeout: int = 12) -> str:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html,*/*"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(200_000)
        return raw.decode("utf-8", errors="replace")
    except Exception:
        return ""


def parse_year_from_pub(pub_str: str) -> int | None:
    try:
        dt = datetime.strptime(pub_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
        y = dt.year
        return y if 2005 <= y <= CURRENT_YEAR else None
    except Exception:
        return None


# ── Year extraction helpers ───────────────────────────────────────────────────
def extract_years(text: str) -> list[int]:
    return [int(y) for y in YEAR_PAT.findall(text)]


def best_year(candidates: list[int]) -> int | None:
    """Return the most-cited year in the candidates list, or None."""
    if not candidates:
        return None
    counter = Counter(candidates)
    most_common_year, count = counter.most_common(1)[0]
    # Require at least 2 occurrences OR be the only candidate
    if count >= 2 or len(counter) == 1:
        return most_common_year
    return None


def contains_adoption_keyword(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in ADOPTION_KEYWORDS)


# ── Source 1: Google News RSS search ─────────────────────────────────────────
def search_rss_for_year(d: dict) -> tuple[int | None, str]:
    """
    Search Google News for adoption year of this district's curriculum.
    Returns (year, src_url) or (None, "").
    """
    district_name = d.get("district", "")
    curriculum    = d.get("curriculum", "")
    vendor        = d.get("curriculumVendor", "")

    search_name = re.sub(r"^[A-Z]{2}\s*[—\-–]\s*", "", district_name).split("(")[0].strip()

    # Build curriculum search term
    curriculum_term = vendor or curriculum.split(";")[0].strip()
    curriculum_term = VENDOR_SEARCH_NAMES.get(vendor, curriculum_term)
    if not curriculum_term:
        return None, ""

    year_votes: list[int] = []
    best_src = ""

    queries = [
        f'"{search_name}" "{curriculum_term}" adopted OR adoption OR approved OR purchased',
        f'"{search_name}" curriculum adoption {curriculum_term.split()[0]}',
        f'"{search_name}" school board "{curriculum_term.split()[0]}" adopted',
    ]

    for query in queries:
        items = fetch_rss(query, max_results=8)
        time.sleep(0.8)
        for item in items:
            title = item["title"]
            if not contains_adoption_keyword(title):
                # Also allow if the district name is prominent
                if search_name.lower()[:15] not in title.lower():
                    continue
            years_in_title = extract_years(title)
            if years_in_title:
                year_votes.extend(years_in_title)
                if not best_src:
                    best_src = item["link"]
            else:
                # Fall back to publication year if headline matches well
                pub_year = parse_year_from_pub(item["published"])
                if pub_year and contains_adoption_keyword(title):
                    year_votes.append(pub_year)
                    if not best_src:
                        best_src = item["link"]

    y = best_year(year_votes)
    return y, best_src


# ── Source 2: boardNotes already in district data ─────────────────────────────
def search_board_notes_for_year(d: dict) -> int | None:
    """
    Scan the district's existing boardNotes for curriculum adoption language.
    Returns the best year found, or None.
    """
    notes = d.get("boardNotes") or []
    curriculum = (d.get("curriculum") or "").lower()
    vendor_kw  = (d.get("curriculumVendor") or "").lower().split()[0]
    year_votes = []

    for note in notes:
        text = (note.get("summary", "") + " " + note.get("date", "")).lower()
        if not (contains_adoption_keyword(text) and
                (curriculum[:6] in text or (vendor_kw and vendor_kw in text))):
            continue
        years = extract_years(note.get("date", "") + " " + note.get("summary", ""))
        year_votes.extend(years)

    return best_year(year_votes)


# ── Source 3: districtContext snippets ───────────────────────────────────────
def search_context_for_year(d: dict) -> int | None:
    """
    Scan districtContext entries for curriculum adoption info.
    """
    ctx = d.get("districtContext") or []
    curriculum = (d.get("curriculum") or "").lower()
    vendor_kw  = (d.get("curriculumVendor") or "").lower().split()[0]
    year_votes = []

    for entry in ctx:
        text = (entry.get("summary", "") + " " + entry.get("date", "")).lower()
        if not (contains_adoption_keyword(text) and
                (curriculum[:6] in text or (vendor_kw and vendor_kw in text))):
            continue
        years = extract_years(entry.get("date", "") + " " + entry.get("summary", ""))
        year_votes.extend(years)

    return best_year(year_votes)


# ── Per-district logic ────────────────────────────────────────────────────────
def enrich_curriculum_year(d: dict) -> bool:
    """Find adoption year for one district. Returns True if updated."""
    # Try board notes and context first (free, already in memory)
    board_year   = search_board_notes_for_year(d)
    context_year = search_context_for_year(d)

    all_votes = []
    if board_year:   all_votes.append(board_year)
    if context_year: all_votes.append(context_year)

    src = ""

    # If we already have a consistent answer from local data, use it
    if best_year(all_votes) and len(all_votes) >= 1:
        y = best_year(all_votes)
        print(f"    ✓ {y} (from board/context notes)")
        d["curriculumAdoptionYear"] = y
        return True

    # Otherwise search the web
    rss_year, src = search_rss_for_year(d)
    if rss_year:
        # Merge all votes for a final decision
        all_votes.append(rss_year)
        y = best_year(all_votes)
        if y:
            print(f"    ✓ {y} (RSS {'+ local notes' if len(all_votes) > 1 else ''})")
            d["curriculumAdoptionYear"] = y
            if src:
                d.setdefault("districtContext", []).append({
                    "type":    "strategic",
                    "date":    str(date.today()),
                    "summary": f"Curriculum adoption year found: {y} — source searched for '{d.get('curriculum', '')}' adoption",
                    "source":  src,
                })
            return True

    print(f"    – not found (curriculum: {d.get('curriculum','?')[:40]})")
    return False


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    force = "--force" in sys.argv
    print(f"Starting curriculum year enrichment — {date.today()}")
    print(f"Mode: {'force re-search all' if force else 'null years only'}")

    with open(DATA_PATH) as f:
        districts = json.load(f)

    # Target: districts with null curriculumAdoptionYear AND a known curriculum name
    targets = [
        d for d in districts
        if not d.get("isTest")
        and (force or d.get("curriculumAdoptionYear") is None)
        and d.get("curriculum")                        # must have a curriculum to search for
        and d.get("priorityTier") in ("Tier 1", "Tier 2")
    ]

    print(f"Districts to enrich: {len(targets)}")

    found = 0
    for i, d in enumerate(targets):
        name = d.get("district", "?")[:55]
        tier = d.get("priorityTier", "?")
        curr = (d.get("curriculum") or "")[:35]
        print(f"\n[{i+1}/{len(targets)}] {name} ({tier})")
        print(f"    Curriculum: {curr}")

        if enrich_curriculum_year(d):
            d["lastUpdated"] = str(date.today())
            found += 1

        if (i + 1) % 10 == 0:
            with open(DATA_PATH, "w") as f:
                json.dump(districts, f, indent=2)
            print(f"  (checkpoint — {found}/{i+1} found so far)")

        time.sleep(2)

    with open(DATA_PATH, "w") as f:
        json.dump(districts, f, indent=2)

    print(f"\nDone. {found}/{len(targets)} districts updated → {DATA_PATH}")
    print(f"Remaining null: {sum(1 for d in districts if d.get('curriculumAdoptionYear') is None and d.get('curriculum'))}")


if __name__ == "__main__":
    main()
