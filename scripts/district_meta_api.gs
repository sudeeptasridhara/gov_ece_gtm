// ─── DISTRICT METADATA PUBLIC API ────────────────────────────────────────────
// Serves the "data" tab of the district intelligence sheet as JSON so the
// dashboard can load Size and Rep Assigned without requiring Gmail sign-in.
//
// ── DEPLOYMENT / REDEPLOYMENT ─────────────────────────────────────────────────
// First time: Deploy → New deployment (Web app, Execute as: Me, Anyone)
// Updates:    Deploy → Manage deployments → edit → bump version → Deploy
// The /exec URL stays the same across versions — no dashboard update needed.
//
// ── RESPONSE FORMAT ──────────────────────────────────────────────────────────
// {
//   data: { "<ncesId>": { ncesId, size, repAssigned, prek, total, name, state } },
//   nameIndex: { "UPPERCASE_NAME|UPPERCASE_STATE": "<ncesId>" },  // all rows
//   count: <number>
// }
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = "1POBU9JkOB6oZVAVG1jhChSs7Cj4Re-qejMtmFNqmisI";
const TAB_NAME = "data";

function doGet(e) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(TAB_NAME) || ss.getSheets()[0];
    const rows  = sheet.getDataRange().getValues();

    if (rows.length < 2) {
      return jsonResponse({ data: {}, nameIndex: {}, count: 0 });
    }

    // Locate columns by header (row 0)
    const hdrs   = rows[0].map(h => String(h).trim().toLowerCase());
    const ci     = (substr) => hdrs.findIndex(h => h.includes(substr));
    const iName  = 0;                  // Agency Name  — always col A
    const iState = 1;                  // State Name   — always col B
    const iNces  = ci("agency id");    // Agency ID - NCES Assigned
    const iTotal = ci("total students");
    const iPrek  = ci("prekindergarten");
    const iSize  = ci("size");
    const iRep   = ci("rep assigned");

    const data      = {};  // ncesId → metadata (only rows with size tier)
    const nameIndex = {};  // "UPPER_NAME|UPPER_STATE" → ncesId (all rows)

    for (let i = 1; i < rows.length; i++) {
      const r      = rows[i];
      const name   = String(r[iName]  || "").trim();
      const state  = String(r[iState] || "").trim();
      const ncesId = iNces >= 0 ? String(r[iNces] || "").trim() : "";

      if (!name || !state) continue;

      // Build name index for ALL rows (used for one-time ncesId enrichment)
      if (ncesId) {
        nameIndex[name.toUpperCase() + "|" + state.toUpperCase()] = ncesId;
      }

      // Build data map for rows that have a size tier
      const size = iSize >= 0 ? String(r[iSize] || "").trim() : "";
      if (!size || size === "-" || size === "\\-") continue;

      data[ncesId || (name.toUpperCase() + "|" + state.toUpperCase())] = {
        ncesId:      ncesId,
        size:        size,
        repAssigned: iRep   >= 0 ? String(r[iRep]   || "").trim() : "",
        prek:        iPrek  >= 0 ? parseInt(String(r[iPrek]  || "").replace(/[^0-9]/g, "")) || 0 : 0,
        total:       iTotal >= 0 ? parseInt(String(r[iTotal] || "").replace(/[^0-9]/g, "")) || 0 : 0,
        name:        name,
        state:       state,
      };
    }

    return jsonResponse({ data, nameIndex, count: Object.keys(data).length });
  } catch (err) {
    return jsonResponse({ error: err.toString(), data: {}, nameIndex: {} });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
