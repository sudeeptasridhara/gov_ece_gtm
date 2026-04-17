"""
update_news.py — Additive-only news updater for Florida PreK district dashboard.

Runs weekly via GitHub Actions. For each Tier 1 and Tier 2 district it:
  1. Searches Google News RSS for recent board meeting mentions
  2. Detects board meeting minutes and appends to boardNotes (new field)
  3. Detects buying signals (curriculum news, leadership changes, grants) and
     appends to buyingSignals — NEVER overwrites existing entries
  4. Searches for strategic plans and recent district initiatives
  5. Searches for funding sources (grants, Title I, VPK state funding)
  6. Attempts to scrape district website early childhood / VPK page for context
  7. Saves rich context to districtContext[] for email personalization
  8. Stamps lastUpdated on any district that received new data

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
from html.parser import HTMLParser

DATA_PATH = "data/districts.json"

# ── DISTRICT WEBSITE URL MAP ───────────────────────────────────────────────────
# Maps district name prefix → (base_url, early_childhood_path_hints)
DISTRICT_URLS = {
    "Alachua":       ("https://www.alachuaschools.org", ["/departments/early-learning", "/earlychildhood", "/vpk"]),
    "Baker":         ("https://www.baker.k12.fl.us", ["/departments/early-learning", "/vpk"]),
    "Bay":           ("https://www.bay.k12.fl.us", ["/departments/early-childhood", "/vpk"]),
    "Bradford":      ("https://www.bradford.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Brevard":       ("https://www.brevardschools.org", ["/departments/early-childhood", "/vpk"]),
    "Broward":       ("https://www.browardschools.com", ["/Page/1", "/departments/early-childhood", "/vpk"]),
    "Calhoun":       ("https://www.calhoun.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Charlotte":     ("https://www.yourcharlotteschools.net", ["/early-childhood", "/vpk"]),
    "Citrus":        ("https://www.citrusschools.org", ["/departments/early-childhood", "/vpk"]),
    "Clay":          ("https://www.myoneclay.net", ["/early-childhood", "/vpk"]),
    "Collier":       ("https://www.collierschools.com", ["/early-childhood", "/vpk"]),
    "Columbia":      ("https://www.columbia.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Miami-Dade":    ("https://www.dadeschools.net", ["/early-childhood", "/vpk", "/prekindergarten"]),
    "DeSoto":        ("https://www.desotoschools.com", ["/early-childhood", "/vpk"]),
    "Dixie":         ("https://www.dixie.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Duval":         ("https://dcps.duvalschools.org", ["/early-childhood", "/vpk", "/preschool"]),
    "Escambia":      ("https://www.escambia.k12.fl.us", ["/departments/early-childhood", "/vpk"]),
    "Flagler":       ("https://www.flaglerschools.com", ["/departments/early-childhood", "/vpk"]),
    "Franklin":      ("https://www.franklin.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Gadsden":       ("https://www.gcdsb.net", ["/early-childhood", "/vpk"]),
    "Gilchrist":     ("https://www.gilchrist.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Glades":        ("https://www.glades.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Gulf":          ("https://www.gulf.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Hamilton":      ("https://www.hamilton.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Hardee":        ("https://www.hardee.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Hendry":        ("https://www.hendry-schools.org", ["/early-childhood", "/vpk"]),
    "Hernando":      ("https://www.hernandoschools.org", ["/departments/early-childhood", "/vpk"]),
    "Highlands":     ("https://www.highlands.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Hillsborough":  ("https://www.sdhc.k12.fl.us", ["/early-childhood", "/vpk", "/preschool"]),
    "Holmes":        ("https://www.holmes.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Indian River":  ("https://www.indianriverschools.org", ["/departments/early-childhood", "/vpk"]),
    "Jackson":       ("https://www.jackson.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Jefferson":     ("https://www.jefferson.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Lafayette":     ("https://www.lafayette.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Lake":          ("https://www.lake.k12.fl.us", ["/departments/early-childhood", "/vpk"]),
    "Lee":           ("https://www.leeschools.net", ["/departments/early-childhood", "/vpk"]),
    "Leon":          ("https://www.leonschools.net", ["/departments/early-childhood", "/vpk"]),
    "Levy":          ("https://www.levy.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Liberty":       ("https://www.liberty.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Madison":       ("https://www.madison.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Manatee":       ("https://www.manateeschools.net", ["/early-childhood", "/vpk"]),
    "Marion":        ("https://www.marionschools.net", ["/departments/early-childhood", "/vpk"]),
    "Martin":        ("https://www.martinschools.org", ["/departments/early-childhood", "/vpk"]),
    "Monroe":        ("https://www.keysschools.com", ["/early-childhood", "/vpk"]),
    "Nassau":        ("https://www.nassau.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Okaloosa":      ("https://www.okaloosaschools.com", ["/departments/early-childhood", "/vpk"]),
    "Okeechobee":    ("https://www.okee.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Orange":        ("https://www.ocps.net", ["/departments/early-childhood", "/vpk"]),
    "Osceola":       ("https://www.osceolaschools.net", ["/departments/early-childhood", "/vpk"]),
    "Palm Beach":    ("https://www.palmbeachschools.org", ["/departments/early-childhood", "/vpk"]),
    "Pasco":         ("https://www.pasco.k12.fl.us", ["/departments/early-childhood", "/vpk"]),
    "Pinellas":      ("https://www.pcsb.org", ["/early-childhood", "/vpk"]),
    "Polk":          ("https://www.polk-fl.net", ["/departments/early-childhood", "/vpk"]),
    "Putnam":        ("https://www.putnamschools.org", ["/early-childhood", "/vpk"]),
    "Santa Rosa":    ("https://www.santarosa.k12.fl.us", ["/departments/early-childhood", "/vpk"]),
    "Sarasota":      ("https://www.sarasotacountyschools.net", ["/departments/early-childhood", "/vpk"]),
    "Seminole":      ("https://www.scps.k12.fl.us", ["/departments/early-childhood", "/vpk"]),
    "St. Johns":     ("https://www.stjohns.k12.fl.us", ["/departments/early-childhood", "/vpk"]),
    "St. Lucie":     ("https://www.stlucieschools.org", ["/departments/early-childhood", "/vpk"]),
    "Sumter":        ("https://www.sumter.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Suwannee":      ("https://www.suwannee.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Taylor":        ("https://www.taylor.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Union":         ("https://www.union.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Volusia":       ("https://www.vcsedu.org", ["/departments/early-childhood", "/vpk"]),
    "Wakulla":       ("https://www.wakulla.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Walton":        ("https://www.walton.k12.fl.us", ["/early-childhood", "/vpk"]),
    "Washington":    ("https://www.washington.k12.fl.us", ["/early-childhood", "/vpk"]),
}

# ── KEYWORD LISTS ──────────────────────────────────────────────────────────────
BOARD_KEYWORDS = [
    "school board", "board meeting", "board minutes", "board agenda",
    "curriculum adoption", "curriculum review", "vpk", "pre-k", "prek",
    "early childhood", "kindergarten readiness", "head start",
]

SIGNAL_KEYWORDS = [
    "curriculum", "new superintendent", "new director", "new principal",
    "grant", "expansion", "readiness", "vpk", "pre-k", "early childhood",
    "improvement plan", "budget", "rfp", "vendor", "pilot program",
]

BOARD_SIGNAL_KEYWORDS = [
    "curriculum", "vpk", "pre-k", "prek", "early childhood",
    "kindergarten", "head start", "instructional material",
]

STRATEGIC_KEYWORDS = [
    "strategic plan", "improvement plan", "priority", "initiative",
    "early learning", "school readiness", "pre-k", "vpk", "early childhood",
    "literacy", "achievement gap", "equity",
]

FUNDING_KEYWORDS = [
    "grant", "funding", "title i", "head start", "early head start",
    "preschool development", "idea", "esser", "federal", "state funding",
    "early childhood", "vpk", "pre-k", "appropriation", "award",
]

WEBSITE_EC_KEYWORDS = [
    "vpk", "pre-k", "prek", "early childhood", "preschool",
    "kindergarten readiness", "head start", "school readiness",
    "curriculum", "summer bridge", "early learning",
]


# ── PLAIN-TEXT HTML PARSER ─────────────────────────────────────────────────────
class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text_parts = []
        self._skip_tags = {"script", "style", "nav", "footer", "header"}
        self._current_skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._skip_tags:
            self._current_skip += 1

    def handle_endtag(self, tag):
        if tag in self._skip_tags and self._current_skip > 0:
            self._current_skip -= 1

    def handle_data(self, data):
        if self._current_skip == 0:
            stripped = data.strip()
            if stripped:
                self.text_parts.append(stripped)

    def get_text(self):
        return " ".join(self.text_parts)


def extract_text_from_html(html: str) -> str:
    parser = TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser.get_text()


# ── NETWORK HELPERS ────────────────────────────────────────────────────────────
def fetch_rss(query: str, max_results: int = 8) -> list:
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
        print(f"  RSS fetch failed for '{query[:60]}': {e}")
        return []


def fetch_url(url: str, timeout: int = 12) -> str:
    """Fetch a URL and return the raw text. Returns empty string on failure."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; DistrictResearch/1.0)",
                "Accept": "text/html,application/xhtml+xml,*/*",
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(200_000)  # cap at ~200 KB
        charset = "utf-8"
        content_type = resp.headers.get("Content-Type", "")
        if "charset=" in content_type:
            charset = content_type.split("charset=")[-1].strip().split(";")[0]
        try:
            return raw.decode(charset, errors="replace")
        except Exception:
            return raw.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"    Web fetch failed ({url[:60]}): {e}")
        return ""


# ── DATE HELPERS ───────────────────────────────────────────────────────────────
def parse_pub_date(pub_str: str) -> str:
    try:
        dt = datetime.strptime(pub_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return str(date.today())


def is_recent(pub_str: str, days: int = 90) -> bool:
    try:
        dt = datetime.strptime(pub_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
        delta = datetime.utcnow() - dt
        return delta.days <= days
    except Exception:
        return True


# ── TEXT HELPERS ───────────────────────────────────────────────────────────────
def contains_keywords(text: str, keywords: list) -> bool:
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


def already_in_context(context_list: list, summary: str) -> bool:
    """Dedup for districtContext entries."""
    new_lower = summary.lower()[:80]
    for entry in context_list:
        if entry.get("summary", "").lower()[:80] == new_lower:
            return True
    return False


def snippet_from_text(text: str, keywords: list, max_chars: int = 300) -> str:
    """Extract the most relevant sentence(s) from text that contain keywords."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    hits = []
    for s in sentences:
        if contains_keywords(s, keywords) and len(s.strip()) > 30:
            hits.append(s.strip())
        if sum(len(h) for h in hits) > max_chars:
            break
    if hits:
        return " ".join(hits)[:max_chars]
    return ""


# ── SEARCH FUNCTIONS ───────────────────────────────────────────────────────────
def search_board_meetings(d: dict) -> bool:
    """Search for board meeting news. Returns True if new data found."""
    county   = d.get("county", "")
    district = d.get("district", "")
    search_name = district.split("(")[0].strip()
    changed = False

    board_query = f'"{search_name}" school board minutes OR agenda 2025 OR 2026'
    board_items = fetch_rss(board_query, max_results=5)
    time.sleep(1)

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

    return changed


def search_buying_signals(d: dict) -> bool:
    """Search for general buying signals. Returns True if new data found."""
    district = d.get("district", "")
    search_name = district.split("(")[0].strip()
    changed = False

    # General signal search
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

    return changed


def search_leadership(d: dict) -> bool:
    """Search for ECE director / coordinator changes. Returns True if new data found."""
    district = d.get("district", "")
    search_name = re.sub(r"^[A-Z]{2}\s*[—\-–]\s*", "", district).split("(")[0].strip()
    changed = False

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


# Keywords that signal a superintendent is leaving
DEPARTURE_KEYWORDS = [
    "resign", "retiring", "retirement", "stepping down", "leaving", "departure",
    "fired", "terminated", "replaced", "transition", "interim superintendent",
    "new superintendent", "named superintendent", "hired superintendent",
    "appointed superintendent", "superintendent search", "superintendent vacancy",
]

# Keywords that signal a new superintendent is arriving
ARRIVAL_KEYWORDS = [
    "new superintendent", "named superintendent", "hired superintendent",
    "appointed superintendent", "named as superintendent", "named new superintendent",
    "will serve as superintendent", "to be superintendent",
]


def _extract_superintendent_name(text: str) -> str | None:
    """Try to pull a full name from a news headline / description."""
    import re as _re
    NAME_PREFIX = r"(?:Dr\.?\s+|Mr\.?\s+|Ms\.?\s+|Mrs\.?\s+)?"
    LAST_FIRST  = r"[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+"
    patterns = [
        _re.compile(r"(?:named|hired|appointed|selected)\s+(?:as\s+)?(?:new\s+)?superintendent\s+(?:" + NAME_PREFIX + r")(" + LAST_FIRST + r")", _re.I),
        _re.compile(r"(" + NAME_PREFIX + LAST_FIRST + r")\s+(?:named|hired|appointed|selected|tapped)\s+(?:as\s+)?(?:new\s+)?superintendent", _re.I),
        _re.compile(r"(" + NAME_PREFIX + LAST_FIRST + r")\s+(?:retiring|resigning|stepping down|leaving)\s+as\s+superintendent", _re.I),
        _re.compile(r"\bSuperintendent\s+(" + NAME_PREFIX + LAST_FIRST + r")", _re.I),
    ]
    for pat in patterns:
        m = pat.search(text)
        if m:
            raw = m.group(1).strip()
            raw = _re.sub(r"^(?:Dr\.?\s+|Mr\.?\s+|Ms\.?\s+|Mrs\.?\s+)", "", raw, flags=_re.I).strip()
            parts = raw.split()
            if len(parts) >= 2 and all(p[0].isupper() for p in parts if p):
                return raw
    return None


def search_superintendent_changes(d: dict) -> bool:
    """
    Search for superintendent departures and new appointments.
    - Sets d['newLeadership'] = True when a departure or replacement is detected.
    - Updates d['superintendent'] if a new name is confidently identified.
    - Adds a buying signal with source link.
    Returns True if any new data was added.
    """
    district    = d.get("district", "")
    search_name = re.sub(r"^[A-Z]{2}\s*[—\-–]\s*", "", district).split("(")[0].strip()
    known_super = (d.get("superintendent") or "").strip().lower()
    changed     = False

    queries = [
        f'"{search_name}" superintendent resign OR retire OR "stepping down" OR departure 2025 OR 2026',
        f'"{search_name}" "new superintendent" OR "superintendent named" OR "superintendent appointed" 2025 OR 2026',
        f'"{search_name}" superintendent search OR "interim superintendent" 2025 OR 2026',
    ]

    for query in queries:
        items = fetch_rss(query, max_results=5)
        time.sleep(1)

        for item in items:
            if not is_recent(item["published"], days=180):
                continue

            title    = item["title"]
            title_lc = title.lower()
            pub_date = parse_pub_date(item["published"])
            summary  = re.sub(r"\s*-\s*Google News$", "", title).strip()

            # Does this headline contain departure or arrival signals?
            is_departure = contains_keywords(title_lc, DEPARTURE_KEYWORDS)
            is_arrival   = contains_keywords(title_lc, ARRIVAL_KEYWORDS)

            if not (is_departure or is_arrival):
                continue

            # Try to extract the name mentioned in the headline
            found_name = _extract_superintendent_name(title)

            # If we know the current superintendent and found a different name in
            # an ARRIVAL headline, that strongly confirms a change occurred.
            name_changed = (
                found_name
                and known_super
                and found_name.lower() != known_super
                and is_arrival
            )

            # Build the buying signal text
            if is_departure and not is_arrival:
                emoji   = "🚨"
                label   = "Superintendent departing"
                detail  = found_name or "name not confirmed"
            elif name_changed:
                emoji   = "🆕"
                label   = "New superintendent"
                detail  = found_name
            elif is_arrival:
                emoji   = "🆕"
                label   = "Superintendent appointment"
                detail  = found_name or summary[:60]
            else:
                emoji   = "⚠️"
                label   = "Leadership transition signal"
                detail  = summary[:60]

            signal = f"{emoji} {label}: {detail} ({pub_date})"

            if not already_captured(d.get("buyingSignals", []), signal):
                d.setdefault("buyingSignals", []).append(signal)
                changed = True
                print(f"    [SUPERINTENDENT] {signal[:90]}")

            # Mark newLeadership flag
            if not d.get("newLeadership"):
                d["newLeadership"] = True
                changed = True
                print(f"    [SUPERINTENDENT] newLeadership flag set")

            # Update stored superintendent name if we found a new one with high confidence
            if name_changed and found_name:
                d["superintendent"]          = found_name
                d["superintendentSince"]     = int(pub_date[:4]) if pub_date else None
                d["superintendentSrc"]       = item["link"]
                changed = True
                print(f"    [SUPERINTENDENT] Updated to: {found_name}")

    return changed


def search_strategic_plan(d: dict) -> bool:
    """Search for strategic plans and district initiatives. Saves to districtContext."""
    district = d.get("district", "")
    search_name = district.split("(")[0].strip()
    changed = False

    queries = [
        f'"{search_name}" "strategic plan" early childhood OR vpk OR "school readiness" 2024 OR 2025 OR 2026',
        f'"{search_name}" "improvement plan" OR "district goals" early childhood OR literacy 2025 OR 2026',
        f'"{search_name}" initiative OR priority "early learning" OR vpk OR "pre-k" 2025 OR 2026',
    ]

    for query in queries:
        items = fetch_rss(query, max_results=4)
        time.sleep(1)
        for item in items:
            if not is_recent(item["published"], days=365):
                continue
            title = item["title"]
            if not contains_keywords(title, STRATEGIC_KEYWORDS):
                continue
            pub_date = parse_pub_date(item["published"])
            summary  = re.sub(r"\s*-\s*Google News$", "", title).strip()
            ctx_entry = {
                "type":    "strategic",
                "date":    pub_date,
                "summary": summary,
                "source":  item["link"],
            }
            if not already_in_context(d.get("districtContext", []), summary):
                d.setdefault("districtContext", []).append(ctx_entry)
                changed = True
                print(f"    [STRATEGIC] {pub_date}: {summary[:70]}")

    return changed


def search_funding(d: dict) -> bool:
    """Search for grants and funding sources. Saves to districtContext + buyingSignals."""
    district = d.get("district", "")
    county   = d.get("county", "")
    search_name = district.split("(")[0].strip()
    changed = False

    queries = [
        f'"{search_name}" grant OR funding "early childhood" OR vpk OR "pre-k" 2025 OR 2026',
        f'"{county} county schools" "title i" OR "head start" OR "preschool development grant" 2025 OR 2026',
        f'"{search_name}" "federal funding" OR "state funding" OR appropriation preschool OR "early learning" 2025 OR 2026',
    ]

    for query in queries:
        items = fetch_rss(query, max_results=4)
        time.sleep(1)
        for item in items:
            if not is_recent(item["published"], days=365):
                continue
            title = item["title"]
            if not contains_keywords(title, FUNDING_KEYWORDS):
                continue
            pub_date = parse_pub_date(item["published"])
            summary  = re.sub(r"\s*-\s*Google News$", "", title).strip()

            # Add to districtContext
            ctx_entry = {
                "type":    "funding",
                "date":    pub_date,
                "summary": summary,
                "source":  item["link"],
            }
            if not already_in_context(d.get("districtContext", []), summary):
                d.setdefault("districtContext", []).append(ctx_entry)
                changed = True
                print(f"    [FUNDING] {pub_date}: {summary[:70]}")

            # Also add notable funding events to buyingSignals
            if contains_keywords(title, ["grant", "award", "funding", "appropriation"]):
                signal = f"💰 Funding: {summary} ({pub_date})"
                if not already_captured(d.get("buyingSignals", []), signal):
                    d.setdefault("buyingSignals", []).append(signal)

    return changed


def fetch_district_website(d: dict) -> bool:
    """
    Attempt to scrape the district's early childhood / VPK web page.
    Extracts relevant text snippets and saves to districtContext.
    Returns True if new context was captured.
    """
    county = d.get("county", "")
    district = d.get("district", "")

    # Look up URL by county name
    url_info = DISTRICT_URLS.get(county)
    if not url_info:
        # Try to match by county prefix in district name
        for key, val in DISTRICT_URLS.items():
            if county.lower().startswith(key.lower()) or key.lower() in county.lower():
                url_info = val
                break

    if not url_info:
        return False

    base_url, path_hints = url_info
    changed = False

    for path in path_hints:
        url = base_url + path
        html = fetch_url(url, timeout=12)
        if not html or len(html) < 500:
            continue

        text = extract_text_from_html(html)
        if not text or not contains_keywords(text, WEBSITE_EC_KEYWORDS):
            continue

        snippet = snippet_from_text(text, WEBSITE_EC_KEYWORDS, max_chars=400)
        if not snippet or len(snippet) < 50:
            continue

        # Truncate and clean
        snippet = re.sub(r'\s+', ' ', snippet).strip()[:400]

        ctx_entry = {
            "type":    "website",
            "date":    str(date.today()),
            "summary": snippet,
            "source":  url,
        }
        if not already_in_context(d.get("districtContext", []), snippet[:60]):
            d.setdefault("districtContext", []).append(ctx_entry)
            changed = True
            print(f"    [WEBSITE] Captured {len(snippet)} chars from {url}")
        break  # one good page is enough per district

    return changed


# ── MAIN UPDATE LOOP ───────────────────────────────────────────────────────────
def update_district(d: dict) -> bool:
    """Run all searches for one district. Returns True if any new data was added."""
    tier = d.get("priorityTier", "Tier 3")

    # Only run for Tier 1 and Tier 2 (Tier 3 is watch-list only)
    if tier not in ("Tier 1", "Tier 2"):
        return False

    changed = False

    # 1. Board meeting / minutes
    changed |= search_board_meetings(d)

    # 2. General buying signals
    changed |= search_buying_signals(d)

    # 3. ECE director / coordinator changes
    changed |= search_leadership(d)

    # 3b. Superintendent departure / appointment tracking
    changed |= search_superintendent_changes(d)

    # 4. Strategic plans and district initiatives
    changed |= search_strategic_plan(d)

    # 5. Funding sources and grants
    changed |= search_funding(d)

    # 6. District website early childhood page
    changed |= fetch_district_website(d)

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
