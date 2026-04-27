// ─── DISTRICT METADATA PUBLIC API ────────────────────────────────────────────
// Serves the "data" tab of the district intelligence sheet as JSON so the
// dashboard can load Size and Rep Assigned without requiring Gmail sign-in.
//
// ── DEPLOYMENT STEPS ─────────────────────────────────────────────────────────
// 1. Go to https://script.google.com and create a new project.
// 2. Paste this entire file into the editor (replace the default Code.gs).
// 3. Update SHEET_ID below if different from the default.
// 4. Click Deploy → New deployment.
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Click Deploy, authorize permissions, then copy the /exec URL.
// 6. Paste that URL into DISTRICT_META_WEBAPP_URL in dashboard_template.jsx.
// 7. Rebuild (python3 scripts/build_html.py) and push.
//
// ── RESPONSE FORMAT ──────────────────────────────────────────────────────────
// Returns JSON: { data: { "AGENCY NAME|STATE NAME": { size, repAssigned, prek, total } } }
// Key is UPPERCASE(agencyName) + "|" + UPPERCASE(stateName) to match dashboard lookup.
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID  = "1POBU9JkOB6oZVAVG1jhChSs7Cj4Re-qejMtmFNqmisI";
const TAB_NAME  = "data";

function doGet(e) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(TAB_NAME) || ss.getSheets()[0];
    const rows  = sheet.getDataRange().getValues();

    if (rows.length < 2) {
      return jsonResponse({ data: {}, count: 0 });
    }

    // Locate columns by header (row 0)
    const hdrs = rows[0].map(h => String(h).trim().toLowerCase());
    const ci   = (substr) => hdrs.findIndex(h => h.includes(substr));
    const iName  = 0;           // Agency Name — always col A
    const iState = 1;           // State Name  — always col B
    const iTotal = ci("total students");
    const iPrek  = ci("prekindergarten");
    const iSize  = ci("size");
    const iRep   = ci("rep assigned");

    const data = {};
    for (let i = 1; i < rows.length; i++) {
      const r     = rows[i];
      const name  = String(r[iName]  || "").trim().toUpperCase();
      const state = String(r[iState] || "").trim().toUpperCase();
      if (!name || !state) continue;

      const size = iSize >= 0 ? String(r[iSize] || "").trim() : "";
      if (!size || size === "-" || size === "\\-") continue; // skip rows without a size tier

      data[name + "|" + state] = {
        size:        size,
        repAssigned: iRep   >= 0 ? String(r[iRep]   || "").trim() : "",
        prek:        iPrek  >= 0 ? parseInt(String(r[iPrek]  || "").replace(/[^0-9]/g, "")) || 0 : 0,
        total:       iTotal >= 0 ? parseInt(String(r[iTotal] || "").replace(/[^0-9]/g, "")) || 0 : 0,
      };
    }

    return jsonResponse({ data, count: Object.keys(data).length });
  } catch (err) {
    return jsonResponse({ error: err.toString(), data: {} });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
