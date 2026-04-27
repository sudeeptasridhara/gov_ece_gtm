"""
enrich_nces.py — Adds ncesId to every district in data/districts.json by
matching against the district intelligence sheet via the public GAS web app.

Run AFTER redeploying district_meta_api.gs (so the response includes nameIndex).

Usage:
    python3 scripts/enrich_nces.py

What it does:
  1. Fetches the GAS web app and extracts nameIndex (name+state → ncesId)
  2. For each district in districts.json, tries to find its NCES ID:
       a. Exact match:  UPPER(district) + "|" + UPPER(stateFull)
       b. Stripped match: remove parenthetical content, common suffixes
  3. Adds  ncesId: "<id>"  to each matched district (leaves missing as null)
  4. Prints a match-rate report and saves districts.json

Matching is case-insensitive and strips trailing parentheticals so names like
"Miami-Dade County Public Schools (M-DCPS)" match "MIAMI-DADE COUNTY PUBLIC SCHOOLS".
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT          = Path(__file__).parent.parent
DISTRICTS_FILE = ROOT / "data" / "districts.json"

# Must match the constant in dashboard_template.jsx
WEBAPP_URL = "https://script.google.com/a/macros/mybrightwheel.com/s/AKfycbzwqD9vVh7kLHmQL10BsQrQ9js79ZeQnI_9TZxavfXR1i7jqUcG_w4_lCG_IWBzM_Z2/exec"

# Map 2-letter state codes → full names as they appear in the NCES sheet
STATE_FULL = {
    "AL":"ALABAMA","AK":"ALASKA","AZ":"ARIZONA","AR":"ARKANSAS","CA":"CALIFORNIA",
    "CO":"COLORADO","CT":"CONNECTICUT","DE":"DELAWARE","DC":"DISTRICT OF COLUMBIA",
    "FL":"FLORIDA","GA":"GEORGIA","HI":"HAWAII","ID":"IDAHO","IL":"ILLINOIS",
    "IN":"INDIANA","IA":"IOWA","KS":"KANSAS","KY":"KENTUCKY","LA":"LOUISIANA",
    "ME":"MAINE","MD":"MARYLAND","MA":"MASSACHUSETTS","MI":"MICHIGAN","MN":"MINNESOTA",
    "MS":"MISSISSIPPI","MO":"MISSOURI","MT":"MONTANA","NE":"NEBRASKA","NV":"NEVADA",
    "NH":"NEW HAMPSHIRE","NJ":"NEW JERSEY","NM":"NEW MEXICO","NY":"NEW YORK",
    "NC":"NORTH CAROLINA","ND":"NORTH DAKOTA","OH":"OHIO","OK":"OKLAHOMA",
    "OR":"OREGON","PA":"PENNSYLVANIA","RI":"RHODE ISLAND","SC":"SOUTH CAROLINA",
    "SD":"SOUTH DAKOTA","TN":"TENNESSEE","TX":"TEXAS","UT":"UTAH","VT":"VERMONT",
    "VA":"VIRGINIA","WA":"WASHINGTON","WV":"WEST VIRGINIA","WI":"WISCONSIN","WY":"WYOMING",
}


def normalize(name: str) -> str:
    """Uppercase, strip parenthetical suffixes, collapse whitespace."""
    n = name.upper().strip()
    n = re.sub(r"\s*\([^)]*\)", "", n)   # remove (...) blocks
    n = re.sub(r"\s+", " ", n).strip()
    return n


def fetch_name_index() -> dict:
    print(f"Fetching name index from GAS web app…")
    try:
        req = urllib.request.Request(WEBAPP_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
        data = json.loads(raw)
        name_index = data.get("nameIndex", {})
        print(f"  Got {len(name_index):,} entries in nameIndex")
        return name_index
    except Exception as e:
        print(f"ERROR fetching web app: {e}")
        print("Make sure you have redeployed district_meta_api.gs with the updated code.")
        sys.exit(1)


def find_nces_id(district: dict, name_index: dict) -> str | None:
    state_code = district.get("state", "FL")
    state_full = STATE_FULL.get(state_code, state_code)
    dist_name  = district.get("district", "")

    # --- Attempt 1: exact normalized match ---
    key = normalize(dist_name) + "|" + state_full
    if key in name_index:
        return name_index[key]

    # --- Attempt 2: strip county/school suffixes then retry ---
    stripped = normalize(dist_name)
    for suffix in [" PUBLIC SCHOOLS", " SCHOOL DISTRICT", " INDEPENDENT SCHOOL DISTRICT",
                   " ISD", " USD", " UNIFIED SCHOOL DISTRICT", " CITY SCHOOL DISTRICT",
                   " COUNTY SCHOOLS", " COUNTY SCHOOL DISTRICT"]:
        if stripped.endswith(suffix):
            candidate = stripped[: -len(suffix)].strip() + "|" + state_full
            if candidate in name_index:
                return name_index[candidate]

    # --- Attempt 3: check if any key starts with the normalized name ---
    prefix = normalize(dist_name) + "|" + state_full
    for k, v in name_index.items():
        if k.startswith(normalize(dist_name)) and k.endswith("|" + state_full):
            return v

    return None


def main():
    with open(DISTRICTS_FILE) as f:
        districts = json.load(f)

    name_index = fetch_name_index()

    matched     = 0
    already_had = 0
    unmatched   = []

    for d in districts:
        if d.get("ncesId"):
            already_had += 1
            continue
        nces_id = find_nces_id(d, name_index)
        if nces_id:
            d["ncesId"] = nces_id
            matched += 1
        else:
            d["ncesId"] = None
            unmatched.append(f"  [{d.get('state','?')}] {d.get('district','?')}")

    total = len(districts)
    print(f"\nResults:")
    print(f"  {already_had} already had ncesId")
    print(f"  {matched} newly matched")
    print(f"  {len(unmatched)} unmatched ({100*len(unmatched)//total}%)")

    if unmatched:
        print(f"\nUnmatched districts (first 20):")
        for line in unmatched[:20]:
            print(line)
        if len(unmatched) > 20:
            print(f"  ... and {len(unmatched) - 20} more")

    with open(DISTRICTS_FILE, "w") as f:
        json.dump(districts, f, indent=2, ensure_ascii=False)
    print(f"\nSaved → {DISTRICTS_FILE}")
    print(f"Match rate: {100*(matched+already_had)//total}%")


if __name__ == "__main__":
    main()
