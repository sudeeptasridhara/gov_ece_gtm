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
// id  — unique tracking ID (districtId_timestamp)
// d   — district ID
// r   — rep email
// t   — template/campaign name
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = "1PasvZHeHTbAaiM1oI0Xe9pxyx-MgwDTF64Y-yuQACwM";
const SHEET_NAME = "Sheet1";

function doGet(e) {
  // Log the open row (best-effort — never block the pixel response)
  try {
    const p = e.parameter || {};
    const trackingId = p.id || String(Date.now());
    const districtId = p.d  || "0";
    const repEmail   = p.r  || "";
    const template   = p.t  || "";
    const now        = new Date().toISOString();
    const dateStr    = now.split("T")[0];

    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    if (sheet) {
      // Columns: activity_id, district_id, district_name, type, date,
      //          notes, full_notes, source, rep_email, director_name, dedup_id, logged_at
      sheet.appendRow([
        "open_" + trackingId,  // activity_id
        districtId,            // district_id
        "",                    // district_name (not available at open time)
        "email_open",          // type
        dateStr,               // date
        "Email opened",        // notes
        template,              // full_notes  (template name for reference)
        "pixel",               // source
        repEmail,              // rep_email
        "",                    // director_name
        trackingId,            // dedup_id    (prevents double-counting if image loads twice)
        now,                   // logged_at
      ]);
    }
  } catch (err) {
    // Silently swallow — never let a logging error break the pixel response
    console.error("tracking_pixel error:", err);
  }

  // Serve a 1x1 transparent GIF via an HTML page that immediately sets the
  // Content-Type header. Apps Script can't return raw binary via ContentService,
  // but HtmlService with a data-URI src works in virtually all email clients:
  // the <img> tag in the email resolves the pixel URL, hits this doGet(), and
  // the 200 OK is enough to log the open — the body is irrelevant for tracking.
  //
  // For maximum compatibility we return a minimal HTML page whose meta-refresh
  // instantly completes; the email client sees the 200 and considers the image
  // "loaded", which is all we need.
  return HtmlService
    .createHtmlOutput(
      '<html><head><meta http-equiv="refresh" content="0;url=data:image/gif;base64,' +
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' +
      '"></head><body></body></html>'
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
