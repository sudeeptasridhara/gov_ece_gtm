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
 *
 * Routes:
 *   ?action=granola&token=<bearer>&cursor=<optional>
 *     Server-side proxy for the Granola Public API. The browser can't call
 *     public-api.granola.ai directly because of CORS, so we proxy the request
 *     here. Returns Granola's JSON response unchanged.
 *
 *   (no params — default)
 *     Returns all activity-log rows as JSON for the dashboard to ingest.
 */
function doGet(e) {
  var output;
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === "granola") {
      output = ContentService
        .createTextOutput(JSON.stringify(proxyGranolaNotes(e.parameter)))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      output = ContentService
        .createTextOutput(JSON.stringify(buildPayload()))
        .setMimeType(ContentService.MimeType.JSON);
    }
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
 * Proxy a request to Granola's Public API (public-api.granola.ai/v1/notes).
 * Browsers can't call the Granola Public API directly because of CORS, so
 * the dashboard sends the bearer token here and we make the call server-side.
 *
 * Params:
 *   token   — required. The Granola Personal API key (sent in Authorization header).
 *   cursor  — optional. Pagination cursor from a previous response.
 *   pageSize — optional. Defaults to 30 (Granola's max).
 *
 * Returns:
 *   { notes: [...], hasMore, cursor } on success — same shape Granola returns.
 *   { error, status, body } on failure — so the dashboard can surface it.
 */
function proxyGranolaNotes(params) {
  var token = (params && params.token) || "";
  if (!token) return { error: "missing_token", notes: [], hasMore: false, cursor: null, _proxy: "granola_v1" };

  var url = "https://public-api.granola.ai/v1/notes";
  var qs = [];
  qs.push("page_size=" + encodeURIComponent(params.pageSize || "30"));
  if (params.cursor)        qs.push("cursor="         + encodeURIComponent(params.cursor));
  if (params.created_after) qs.push("created_after="  + encodeURIComponent(params.created_after));
  if (qs.length) url += "?" + qs.join("&");

  var resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
      },
      muteHttpExceptions: true,
      followRedirects: true,
    });
  } catch (err) {
    // Most common cause: script.external_request OAuth scope not authorized.
    // The script owner needs to run authorizeExternalFetch() once from the
    // editor and approve the permission prompt.
    return {
      error: "fetch_failed",
      message: String(err),
      hint: "Run the authorizeExternalFetch() function once in the Apps Script editor and approve the script.external_request permission, then redeploy.",
      notes: [],
      hasMore: false,
      cursor: null,
      _proxy: "granola_v1",
    };
  }

  var status = resp.getResponseCode();
  var body = resp.getContentText();
  if (status < 200 || status >= 300) {
    return { error: "http_" + status, status: status, body: body.slice(0, 500), notes: [], hasMore: false, cursor: null, _proxy: "granola_v1" };
  }

  try {
    var parsed = JSON.parse(body);
    // Tag the response so the dashboard can verify the proxy is actually
    // deployed (vs. the GAS endpoint silently returning the activity log
    // because the old script is still installed).
    parsed._proxy = "granola_v1";
    return parsed;
  } catch (err) {
    return { error: "parse_failed", message: String(err), body: body.slice(0, 500), notes: [], hasMore: false, cursor: null, _proxy: "granola_v1" };
  }
}

/**
 * One-time setup. Run this function manually from the Apps Script editor to
 * trigger the script.external_request permission prompt. Without this scope,
 * UrlFetchApp.fetch (used by proxyGranolaNotes) throws a permission error.
 *
 * Steps for the script owner:
 *   1. Open this script in the Apps Script editor
 *   2. Select `authorizeExternalFetch` from the function dropdown at the top
 *   3. Click Run
 *   4. When prompted, click Review permissions, choose your account, click
 *      Advanced → Go to <project name> (unsafe), then Allow
 *   5. The execution log should show "external fetch authorized"
 *   6. Redeploy (Manage deployments → Edit → New version → Deploy)
 */
function authorizeExternalFetch() {
  var resp = UrlFetchApp.fetch("https://www.google.com/", { muteHttpExceptions: true });
  Logger.log("external fetch authorized — status " + resp.getResponseCode());
  return resp.getResponseCode();
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

    // Unsubscribes and bounces must be returned even if district_id is 0
    // (can happen if the districtId param was missing when the row was written).
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

    if (type === "bounce") {
      activities.push({
        id:         String(row[0] || (Date.now() + "_" + i)),
        districtId: distId || 0,
        district:   String(row[2] || "").trim(),   // col C — may contain the email
        type:       "bounce",
        date:       String(row[4] || "").trim(),
        notes:      String(row[5] || "").trim(),   // col F — may contain the email
        source:     "gmail_bounce",
        repEmail:   String(row[8] || "").trim(),
        loggedAt:   String(row[11] || "").trim(),
      });
      continue;
    }

    // Pass through team-shared meta-rows even when district_id is 0. These rows
    // hold custom email templates, custom sequences, and template overrides
    // created by any rep — without them, reps fetching via this proxy never
    // see templates created by their teammates. The dashboard parser keys
    // these on `type` and reads the template id from district_name (col C),
    // the JSON payload from full_notes (col G), and the timestamp from
    // logged_at (col L), so we expose all of those.
    if (
      type === "custom_template" ||
      type === "custom_template_deleted" ||
      type === "custom_sequence" ||
      type === "custom_sequence_deleted" ||
      type === "template_override" ||
      type === "district_note" ||
      type === "stage_update" ||
      type === "mailer_sent"
    ) {
      activities.push({
        id:           String(row[0] || (Date.now() + "_" + i)),
        districtId:   distId || 0,
        district:     String(row[2] || "").trim(),   // col C — template/sequence id, or district name
        type:         type,
        date:         String(row[4] || "").trim(),
        notes:        String(row[5] || "").trim(),   // col F — label / subject / stage label
        full_notes:   String(row[6] || "").trim(),   // col G — JSON payload for templates/sequences, raw stage key for stage_update
        source:       String(row[7] || "").trim(),
        repEmail:     String(row[8] || "").trim(),
        directorName: String(row[9] || "").trim(),
        dedup_id:     String(row[10] || "").trim(),  // col K — template/sequence id (used by dashboard to key these rows)
        loggedAt:     String(row[11] || "").trim(),
      });
      continue;
    }

    // Skip remaining rows that are missing a district_id (defensive)
    if (!distId) continue;

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
