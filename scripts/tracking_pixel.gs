// ─── EMAIL OPEN TRACKING PIXEL + ACTIVITY WRITE PROXY ────────────────────────
// Google Apps Script web app that:
//   1. Serves a 1x1 tracking pixel and logs email_open rows when emails are opened.
//   2. Logs email_click rows and redirects when tracked links are clicked.
//   3. Acts as a write proxy (write=1) so reps whose Google accounts don't have
//      direct edit access to the sheet can still log activities through this endpoint.
//      The script runs as the owner ("Execute as: Me"), so it always has sheet access.
//
// ── DEPLOYMENT STEPS ─────────────────────────────────────────────────────────
// 1. Go to https://script.google.com and create a new project.
// 2. Paste this entire file into the editor (replace the default Code.gs).
// 3. Update SHEET_ID below to match your ACTIVITY_SHEET_ID from the dashboard.
// 4. Click Deploy → New deployment (or Manage deployments → New version).
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Click Deploy, authorize the permissions, then copy the /exec URL.
// 6. Paste that URL into the TRACKING_PIXEL_URL constant in dashboard_template.jsx.
// 7. Rebuild the dashboard (python3 scripts/build_html.py) and push to GitHub.
//
// ── QUERY PARAMETERS ─────────────────────────────────────────────────────────
// Pixel / click mode (default):
//   id    — unique tracking ID (districtId_timestamp)
//   d     — district ID
//   r     — rep email
//   t     — template/campaign name
//   click — "1" for a link click; omit for an email open
//   url   — destination URL to redirect to (click mode only)
//
// Write-proxy mode (write=1):
//   write — "1" to write an arbitrary activity row
//   row   — JSON array of 12 column values matching SHEET_COLS
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID   = "1PasvZHeHTbAaiM1oI0Xe9pxyx-MgwDTF64Y-yuQACwM";
const SHEET_NAME = "Activity Log";

function doGet(e) {
  const p = e.parameter || {};

  // ── Write-proxy mode ────────────────────────────────────────────────────────
  // Used as a fallback when a rep's Google account doesn't have editor access to
  // the activity sheet. The dashboard posts the row data here and this script
  // writes it using the deploying account's credentials.
  if (p.write === "1" && p.row) {
    try {
      const row  = JSON.parse(p.row);
      const ss   = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
      if (sheet && Array.isArray(row)) {
        // Stamp logged_at with server time if the client left it blank
        if (!row[11]) row[11] = new Date().toISOString();
        sheet.appendRow(row);
      }
    } catch (err) {
      console.error("write-proxy error:", err);
    }
    return HtmlService.createHtmlOutput("ok")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ── Pixel / click mode ──────────────────────────────────────────────────────
  const isClick    = p.click === "1";
  const trackingId = p.id  || String(Date.now());
  const districtId = p.d   || "0";
  const repEmail   = p.r   || "";
  const template   = p.t   || "";
  const destUrl    = p.url || "";
  const now        = new Date().toISOString();
  const dateStr    = now.split("T")[0];

  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    if (sheet) {
      // Columns: activity_id, district_id, district_name, type, date,
      //          notes, full_notes, source, rep_email, director_name, dedup_id, logged_at
      if (isClick) {
        const urlSlug  = destUrl.replace(/https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
        const dedupKey = trackingId + "_" + urlSlug;
        sheet.appendRow([
          "click_" + dedupKey,
          districtId,
          "",
          "email_click",
          dateStr,
          "Link clicked: " + destUrl.slice(0, 120),
          template,
          "pixel",
          repEmail,
          "",
          dedupKey,
          now,
        ]);
      } else {
        sheet.appendRow([
          "open_" + trackingId,
          districtId,
          "",
          "email_open",
          dateStr,
          "Email opened",
          template,
          "pixel",
          repEmail,
          "",
          trackingId,
          now,
        ]);
      }
    }
  } catch (err) {
    console.error("tracking error:", err);
  }

  if (isClick && destUrl) {
    return HtmlService
      .createHtmlOutput(
        '<html><head><meta http-equiv="refresh" content="0;url=' +
        destUrl.replace(/"/g, "&quot;") +
        '"></head><body>Redirecting…</body></html>'
      )
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService
    .createHtmlOutput(
      '<html><head><meta http-equiv="refresh" content="0;url=data:image/gif;base64,' +
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' +
      '"></head><body></body></html>'
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
