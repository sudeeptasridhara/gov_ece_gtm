/**
 * activity_log_api.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Apps Script web app that serves the shared activity log sheet as JSON
 * so the dashboard can show all team activity to anyone who opens it — no
 * Gmail sign-in required.
 *
 * Deploy steps (do this once):
 *   1. Go to script.google.com → New project → paste this entire file
 *   2. Click Deploy → New Deployment
 *      - Type: Web app
 *      - Execute as: Me  (your Google account — the one with edit access to the sheet)
 *      - Who has access: Anyone
 *   3. Click Deploy → copy the Web app URL  (looks like https://script.google.com/macros/s/AKfyc.../exec)
 *   4. Paste that URL as ACTIVITY_WEBAPP_URL in scripts/dashboard_template.jsx
 *   5. Rebuild: python scripts/build_html.py
 *
 * The web app returns JSON in this shape:
 *   { "lastSynced": "<ISO timestamp>", "activities": [ { ...activity }, ... ] }
 *
 * Any time you log an activity in the dashboard (Gmail, Granola, or a manual
 * note), it writes a row to the sheet. This script reads those rows live, so
 * every page load reflects the current state of the sheet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// The same Sheet ID as ACTIVITY_SHEET_ID in dashboard_template.jsx
var SHEET_ID = "1PasvZHeHTbAaiM1oI0Xe9pxyx-MgwDTF64Y-yuQACwM";
var SHEET_TAB = "Sheet1";

// Column order must match SHEET_COLS in dashboard_template.jsx
var COLS = [
  "activity_id",   // A
  "district_id",   // B
  "district_name", // C
  "type",          // D
  "date",          // E
  "notes",         // F
  "full_notes",    // G  (Granola transcript text)
  "source",        // H
  "rep_email",     // I
  "director_name", // J
  "dedup_id",      // K
  "logged_at",     // L
];

/**
 * HTTP POST handler — called by unsubscribe.html when a contact opts out.
 * Writes an unsubscribe row to the activity sheet so the dashboard can
 * detect it on next load and suppress future sends to that email address.
 *
 * Expected form-encoded body params: name, email, district, districtId
 */
function doPost(e) {
  try {
    var name       = e.parameter.name       || "";
    var email      = (e.parameter.email     || "").toLowerCase().trim();
    var district   = e.parameter.district   || "";
    var districtId = parseInt(e.parameter.districtId) || 0;

    if (!email) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: "no email" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_TAB);
    var now   = new Date();

    var row = [
      String(now.getTime()),                    // activity_id
      String(districtId),                       // district_id
      district,                                 // district_name
      "unsubscribe",                            // type
      Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd"), // date
      email,                                    // notes  — stores the unsubscribed email
      "",                                       // full_notes
      "unsubscribe_form",                       // source
      "",                                       // rep_email
      name,                                     // director_name
      email,                                    // dedup_id
      now.toISOString(),                        // logged_at
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTTP GET handler — called when the web app URL is fetched.
 * Returns all activity rows as JSON with CORS headers so the
 * dashboard (served from GitHub Pages) can read it in the browser.
 */
function doGet(e) {
  var output;
  try {
    output = ContentService
      .createTextOutput(JSON.stringify(buildPayload()))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    output = ContentService
      .createTextOutput(JSON.stringify({
        error: err.message,
        lastSynced: new Date().toISOString(),
        activities: [],
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return output;
}

/**
 * Reads Sheet1 and returns the activity_log.json-compatible payload.
 */
function buildPayload() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_TAB);

  if (!sheet || sheet.getLastRow() < 2) {
    return { lastSynced: new Date().toISOString(), activities: [] };
  }

  var numRows = sheet.getLastRow() - 1; // exclude header
  var data = sheet.getRange(2, 1, numRows, COLS.length).getValues();
  var activities = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var type   = String(row[3] || "note").trim();
    var src    = String(row[7] || "manual").trim();
    var distId = parseInt(row[1]);

    // Unsubscribes must be returned even if district_id is 0 (can happen if
    // the districtId param was missing when the row was written).
    if (type === "unsubscribe") {
      // Email address may be in district_name (col C) or notes (col F) depending
      // on how the row was originally written — expose both so the dashboard can
      // find the email regardless of which column it landed in.
      activities.push({
        id:         String(row[0] || (Date.now() + "_" + i)),
        districtId: distId || 0,
        district:   String(row[2] || "").trim(),   // col C — may contain the email
        type:       "unsubscribe",
        date:       String(row[4] || "").trim(),
        notes:      String(row[5] || "").trim(),   // col F — may contain the email
        source:     "unsubscribe_form",
        repEmail:   String(row[8] || "").trim(),
        loggedAt:   String(row[11] || "").trim(),
      });
      continue;
    }

    // Skip meta-rows (stage changes, mailer confirmations) and blank rows
    if (!distId) continue;
    if (type === "stage_update" || type === "mailer_sent") continue;

    var dedupId = String(row[10] || "").trim();

    var activity = {
      id:           String(row[0] || (Date.now() + "_" + i)),
      districtId:   distId,
      district:     String(row[2] || "").trim(),
      type:         type,
      date:         String(row[4] || "").trim(),
      notes:        String(row[5] || "").trim(),
      source:       src,
      repEmail:     String(row[8] || "").trim(),
      directorName: String(row[9] || "").trim(),
      loggedAt:     String(row[11] || "").trim(),
    };

    // Attach the right dedup field depending on source
    if (dedupId) {
      if (src === "granola") {
        activity.granolaDocId = dedupId;
        var fullNotes = String(row[6] || "").trim();
        if (fullNotes) activity.granolaNotesText = fullNotes;
      } else {
        // gmail_sent, gmail_reply, dashboard sends — all keyed by message/thread id
        activity.gmailMsgId = dedupId;
      }
    }

    activities.push(activity);
  }

  return {
    lastSynced: new Date().toISOString(),
    activities: activities,
  };
}
