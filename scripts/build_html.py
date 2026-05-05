"""
build_html.py — Rebuilds index.html from:
  - data/districts.json  (source of truth, updated by update_news.py)
  - scripts/dashboard_template.jsx  (React component, no data)

Compiles JSX → plain JS via Babel, inlines React + ReactDOM, writes index.html.

Usage:
    python scripts/build_html.py
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT       = Path(__file__).parent.parent
DATA_FILE  = ROOT / "data" / "districts.json"
STATE_INFO = ROOT / "data" / "state_info.json"
TEMPLATE   = ROOT / "scripts" / "dashboard_template.jsx"
OUT_HTML   = ROOT / "index.html"
REACT_MIN  = ROOT / "node_modules" / "react" / "umd" / "react.production.min.js"
RDOM_MIN   = ROOT / "node_modules" / "react-dom" / "umd" / "react-dom.production.min.js"
BABEL_BIN  = ROOT / "node_modules" / ".bin" / "babel"
BABEL_CFG  = ROOT / "babel.config.json"


def load_districts() -> str:
    with open(DATA_FILE) as f:
        data = json.load(f)
    out = "const INITIAL_DISTRICTS = " + json.dumps(data, indent=2) + ";\n"
    state_info = {}
    if STATE_INFO.exists():
        with open(STATE_INFO) as f:
            state_info = json.load(f)
    out += "const STATE_INFO = " + json.dumps(state_info, indent=2) + ";\n"
    return out


def compile_jsx(jsx_src: str) -> str:
    with tempfile.NamedTemporaryFile(suffix=".jsx", mode="w", delete=False) as tmp_in:
        tmp_in.write(jsx_src)
        tmp_in_path = tmp_in.name

    tmp_out_path = tmp_in_path.replace(".jsx", ".js")
    result = subprocess.run(
        [str(BABEL_BIN), tmp_in_path, "--out-file", tmp_out_path,
         "--config-file", str(BABEL_CFG)],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("Babel compile error:", result.stderr)
        sys.exit(1)

    with open(tmp_out_path) as f:
        compiled = f.read()

    os.unlink(tmp_in_path)
    os.unlink(tmp_out_path)
    return compiled


def build():
    print("Loading districts data...")
    districts_js = load_districts()

    print("Loading React template...")
    with open(TEMPLATE) as f:
        template_src = f.read()

    # Strip "export default" — valid in ES modules but breaks plain <script> tags
    template_src = template_src.replace(
        "export default function BrightwheelDashboard",
        "function BrightwheelDashboard"
    )

    # Inject data at the top of the component file
    full_jsx = districts_js + "\n\n" + template_src

    print("Compiling JSX...")
    compiled_js = compile_jsx(full_jsx)

    print("Reading inlined React/ReactDOM...")
    react_js   = REACT_MIN.read_text()
    rdom_js    = RDOM_MIN.read_text()

    today = __import__("datetime").date.today().isoformat()

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>brightwheel · PreK Sales Intelligence</title>
  <!-- Last built: {today} -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
    select {{ appearance: auto; }}
  </style>
  <script>{react_js}</script>
  <script>{rdom_js}</script>
</head>
<body>
  <div id="root"></div>
  <script>
    const {{ useState, useMemo, useRef, useEffect, useCallback }} = React;
  </script>
  <script>
{compiled_js}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(BrightwheelDashboard));
  </script>
</body>
</html>"""

    OUT_HTML.write_text(html)
    size_kb = OUT_HTML.stat().st_size // 1024
    print(f"Done → {OUT_HTML}  ({size_kb} KB)")


if __name__ == "__main__":
    build()
