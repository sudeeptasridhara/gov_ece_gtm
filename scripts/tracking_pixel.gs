// ─── EMAIL OPEN TRACKING PIXEL ───────────────────────────────────────────────
// Google Apps Script web app that serves a 1x1 transparent GIF and logs an
// email_open row to the shared Activity Sheet whenever an email is opened.
//
// ── DEPLOYMENT STEPS ─────────────────────────────────────────────────────────
// 1. Go to https://script.google.com and create a new project.
// 2. Paste this entire file into the editor (replace the default Code.gs).
// 3. Update SHEET_ID below to match your ACTIVITY_SHEET_ID from the dashboard.
// 4. Click Deploy → New deployment.
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Click Deploy, authorize the permissions, then copy the /exec URL.
// 6. Paste that URL into the TRACKING_PIXEL_URL constant in dashboard_template.jsx.
// 7. Rebuild the dashboard (python3 scripts/build_html.py) and push to GitHub.
//
// ── HOW IT WORKS ─────────────────────────────────────────────────────────────
// The dashboard injects a hidden <img> tag into every outgoing email. When the
// recipient opens the email, their email client fetches the image URL, which
// hits this script. The script logs an email_open row to the Sheet (same format
// as all other activity rows) and returns the transparent 1x1 GIF immediately.
// The open then appears in the activity feed and team activity table.
//
// ── QUERY PARAMETERS ─────────────────────────────────────────────────────────
// id    — unique tracking ID (districtId_timestamp)
// d     — district ID
// r     — rep email
// t     — template/campaign name
//
// For click tracking, also pass:
// click — "1" to indicate a link click (vs. a pixel open)
// url   — the destination URL to redirect to after logging
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = "1PasvZHeHTbAaiM1oI0Xe9pxyx-MgwDTF64Y-yuQACwM";
const SHEET_NAME = "Sheet1";

function doGet(e) {
  const p           = e.parameter || {};
  const isClick     = p.click === "1";
  const trackingId  = p.id  || String(Date.now());
  const districtId  = p.d   || "0";
  const repEmail    = p.r   || "";
  const template    = p.t   || "";
  const destUrl     = p.url || "";     // only present for click events
  const now         = new Date().toISOString();
  const dateStr     = now.split("T")[0];

  // ── Log to Activity Sheet (best-effort, never block the response) ──────────
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    if (sheet) {
      // Columns: activity_id, district_id, district_name, type, date,
      //          notes, full_notes, source, rep_email, director_name, dedup_id, logged_at
      if (isClick) {
        // Unique dedup key: trackingId + the destination URL slug
        // so multiple clicks on different links in the same email each get logged.
        const urlSlug  = destUrl.replace(/https?:\/\//,"").replace(/[^a-zA-Z0-9]/g,"_").slice(0,40);
        const dedupKey = trackingId + "_" + urlSlug;
        sheet.appendRow([
          "click_" + dedupKey,    // activity_id
          districtId,             // district_id
          "",                     // district_name
          "email_click",          // type
          dateStr,                // date
          "Link clicked: " + destUrl.slice(0, 120),  // notes
          template,               // full_notes (template name)
          "pixel",                // source
          repEmail,               // rep_email
          "",                     // director_name
          dedupKey,               // dedup_id
          now,                    // logged_at
        ]);
      } else {
        sheet.appendRow([
          "open_" + trackingId,   // activity_id
          districtId,             // district_id
          "",                     // district_name
          "email_open",           // type
          dateStr,                // date
          "Email opened",         // notes
          template,               // full_notes
          "pixel",                // source
          repEmail,               // rep_email
          "",                     // director_name
          trackingId,             // dedup_id
          now,                    // logged_at
        ]);
      }
    }
  } catch (err) {
    console.error("tracking error:", err);
  }

  // ── Respond ───────────────────────────────────────────────────────────────
  if (isClick && destUrl) {
    // Redirect the recipient to the real destination URL
    return HtmlService
      .createHtmlOutput(
        '<html><head><meta http-equiv="refresh" content="0;url=' +
        destUrl.replace(/"/g, "&quot;") +
        '"></head><body>Redirecting…</body></html>'
      )
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Pixel open — return a minimal 200 OK (enough for the email client to
  // register the image as "loaded" and log the open)
  return HtmlService
    .createHtmlOutput(
      '<html><head><meta http-equiv="refresh" content="0;url=data:image/gif;base64,' +
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' +
      '"></head><body></body></html>'
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
