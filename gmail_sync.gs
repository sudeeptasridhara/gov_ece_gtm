/**
 * gmail_sync.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Syncs sent Gmail emails to a Google Sheet ("Email Activity Log") so that
 * outreach to district contacts is automatically tracked without manual entry.
 *
 * Columns written to the sheet:
 *   A  Rep Email         – authenticated sender's Gmail address
 *   B  Recipient Email   – To: address of the sent message
 *   C  Subject           – email subject line
 *   D  Date Sent         – timestamp of the sent message
 *   E  Thread ID         – Gmail thread ID (used for deduplication)
 *   F  Reply Received    – TRUE if the thread has >1 message
 *   G  Reply Date        – date of the first reply (if any)
 *
 * Deduplication key: Thread ID + Recipient Email  (columns E + B)
 *
 * Setup: run setup() once to install the hourly trigger.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── CONFIGURATION ─────────────────────────────────────────────────────────────

/**
 * Name of the Google Sheet that receives the activity log rows.
 * Create a spreadsheet with this exact name (or change this constant to match).
 */
var SHEET_NAME = "Email Activity Log";

/**
 * Tab name inside the spreadsheet where district contact emails live.
 * Put district email addresses in column A of this tab, one per row,
 * with a header in row 1 (e.g. "Email"). Add all district director emails here.
 *
 * Alternatively, replace getDistrictEmails() below with a hardcoded array
 * if you prefer to manage the list directly in this script.
 */
var CONTACTS_TAB = "District Contacts";

/**
 * How many days back to look for sent emails on each run.
 * Keep this slightly larger than your trigger interval to avoid gaps
 * if a run is delayed. 2 days is safe for an hourly trigger.
 */
var LOOKBACK_DAYS = 2;


// ── MAIN SYNC FUNCTION ────────────────────────────────────────────────────────

/**
 * Searches Gmail Sent items for emails sent to any district contact,
 * then writes new rows to the activity log sheet.
 * This is the function that runs on the hourly trigger.
 */
function syncSentEmails() {
  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateLogSheet(ss);
  var existingKeys = getExistingKeys(sheet);
  var districtEmails = getDistrictEmails(ss);

  if (districtEmails.length === 0) {
    Logger.log("No district emails found in '%s' tab. Add emails and re-run.", CONTACTS_TAB);
    return;
  }

  var repEmail = Session.getActiveUser().getEmail();
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  var afterDate = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy/MM/dd");

  var newRows = [];

  for (var i = 0; i < districtEmails.length; i++) {
    var recipientEmail = districtEmails[i].toLowerCase().trim();
    if (!recipientEmail) continue;

    // Search sent mail for this specific recipient within lookback window
    var query = "in:sent to:" + recipientEmail + " after:" + afterDate;
    var threads;
    try {
      threads = GmailApp.search(query, 0, 50);
    } catch (e) {
      Logger.log("Error searching for %s: %s", recipientEmail, e.message);
      continue;
    }

    for (var t = 0; t < threads.length; t++) {
      var thread = threads[t];
      var threadId = thread.getId();
      var dedupeKey = threadId + "|" + recipientEmail;

      // Skip if already logged
      if (existingKeys[dedupeKey]) continue;

      var messages = thread.getMessages();
      var sentMessage = null;

      // Find the first sent message in this thread to this recipient
      for (var m = 0; m < messages.length; m++) {
        var msg = messages[m];
        var toField = msg.getTo().toLowerCase();
        if (toField.indexOf(recipientEmail) !== -1) {
          sentMessage = msg;
          break;
        }
      }

      if (!sentMessage) continue;

      var subject = sentMessage.getSubject();
      var dateSent = sentMessage.getDate();

      // Check for replies: any message not from the rep counts as a reply
      var replyReceived = false;
      var replyDate = "";
      for (var r = 0; r < messages.length; r++) {
        var replyMsg = messages[r];
        var fromField = replyMsg.getFrom().toLowerCase();
        if (fromField.indexOf(repEmail.toLowerCase()) === -1 &&
            replyMsg.getDate() > dateSent) {
          replyReceived = true;
          replyDate = Utilities.formatDate(
            replyMsg.getDate(),
            Session.getScriptTimeZone(),
            "yyyy-MM-dd HH:mm"
          );
          break;
        }
      }

      newRows.push([
        repEmail,
        recipientEmail,
        subject,
        Utilities.formatDate(dateSent, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"),
        threadId,
        replyReceived,
        replyDate,
      ]);

      // Track in-memory so we don't double-write within this run
      existingKeys[dedupeKey] = true;
    }
  }

  if (newRows.length > 0) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newRows.length, 7).setValues(newRows);
    Logger.log("Wrote %s new rows.", newRows.length);
  } else {
    Logger.log("No new sent emails to log.");
  }
}


// ── SETUP ─────────────────────────────────────────────────────────────────────

/**
 * Run this function ONCE from the Apps Script editor to install the
 * hourly time-based trigger. After running, you can verify the trigger
 * exists under Triggers (clock icon) in the left sidebar.
 */
function setup() {
  // Remove any existing syncSentEmails triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncSentEmails") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Install a new hourly trigger
  ScriptApp.newTrigger("syncSentEmails")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("✅ Hourly trigger installed for syncSentEmails.");

  // Also initialise the spreadsheet and sheet headers on first run
  var ss = getOrCreateSpreadsheet();
  getOrCreateLogSheet(ss);
  Logger.log("✅ Spreadsheet '%s' is ready.", SHEET_NAME);
}


// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Returns the spreadsheet named SHEET_NAME, creating it if it doesn't exist.
 */
function getOrCreateSpreadsheet() {
  var files = DriveApp.getFilesByName(SHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  var ss = SpreadsheetApp.create(SHEET_NAME);
  Logger.log("Created new spreadsheet: %s", ss.getUrl());
  return ss;
}

/**
 * Returns (or creates) the "Log" tab inside the spreadsheet.
 * Writes the header row if the sheet is brand new.
 */
function getOrCreateLogSheet(ss) {
  var sheet = ss.getSheetByName("Log");
  if (!sheet) {
    sheet = ss.insertSheet("Log");
    sheet.appendRow([
      "Rep Email",
      "Recipient Email",
      "Subject",
      "Date Sent",
      "Thread ID",
      "Reply Received",
      "Reply Date",
    ]);
    // Freeze header row and auto-resize columns
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 7);
    sheet.getRange(1, 1, 1, 7)
      .setFontWeight("bold")
      .setBackground("#4f46e5")
      .setFontColor("#ffffff");
  }
  return sheet;
}

/**
 * Reads all existing Thread ID + Recipient Email combinations from the sheet
 * and returns them as an object keyed by "threadId|recipientEmail" for O(1)
 * deduplication lookups.
 */
function getExistingKeys(sheet) {
  var keys = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return keys; // only header row

  // Column E = Thread ID (index 5), Column B = Recipient Email (index 2)
  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < data.length; i++) {
    var threadId = data[i][4]; // col E
    var recipientEmail = (data[i][1] || "").toString().toLowerCase().trim(); // col B
    if (threadId && recipientEmail) {
      keys[threadId + "|" + recipientEmail] = true;
    }
  }
  return keys;
}

/**
 * Reads district contact emails from the CONTACTS_TAB tab of the spreadsheet.
 * Expects column A to contain email addresses (row 1 = header, skipped).
 * Returns a flat array of email strings.
 */
function getDistrictEmails(ss) {
  var tab = ss.getSheetByName(CONTACTS_TAB);
  if (!tab) {
    // Create the tab with instructions if it doesn't exist
    tab = ss.insertSheet(CONTACTS_TAB);
    tab.appendRow(["Email", "District Name", "Director Name"]);
    tab.setFrozenRows(1);
    tab.getRange(1, 1, 1, 3)
      .setFontWeight("bold")
      .setBackground("#4f46e5")
      .setFontColor("#ffffff");
    Logger.log(
      "Created '%s' tab. Paste district contact emails into column A (starting row 2).",
      CONTACTS_TAB
    );
    return [];
  }

  var lastRow = tab.getLastRow();
  if (lastRow < 2) return [];

  var values = tab.getRange(2, 1, lastRow - 1, 1).getValues();
  return values
    .map(function(row) { return (row[0] || "").toString().trim(); })
    .filter(function(email) { return email.indexOf("@") !== -1; });
}
