# Gmail Activity Sync — `gmail_sync.gs`

Automatically records every outbound email sent to a district contact into a Google Sheet so the team has a persistent, queryable log of all outreach activity — without needing to manually copy anything.

---

## What it does

An hourly Google Apps Script trigger runs `syncSentEmails()`, which:

1. Reads the list of district contact emails from the **District Contacts** tab of the spreadsheet
2. Searches the authenticated user's **Gmail Sent** folder for emails sent to those addresses in the last 2 days
3. For each matching sent message, checks whether a reply has come back (by looking for non-sender messages in the same thread)
4. Appends new rows to the **Log** tab of the spreadsheet — one row per sent message

Rows are deduplicated by **Thread ID + Recipient Email**, so re-running the script never creates duplicates.

### Columns written to the Log tab

| Column | Description |
|--------|-------------|
| **Rep Email** | The Gmail address of the person who sent the email |
| **Recipient Email** | The district contact's email address |
| **Subject** | Email subject line |
| **Date Sent** | Timestamp of the outbound message |
| **Thread ID** | Gmail thread ID — used for deduplication and linking back to Gmail |
| **Reply Received** | `TRUE` if a reply was detected in the thread |
| **Reply Date** | Date/time of the first reply, if any |

---

## How to deploy

### Step 1 — Create the Google Sheet

Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet named exactly:

```
Email Activity Log
```

> The script will find it by name. If a spreadsheet with this name already exists in your Drive it will use that one.

### Step 2 — Open Apps Script

Inside the spreadsheet, click **Extensions → Apps Script**. This opens the script editor bound to that spreadsheet.

Alternatively, go to [script.google.com](https://script.google.com), create a new standalone project, and paste the script there. If you use a standalone project, the script creates and manages its own spreadsheet automatically.

### Step 3 — Paste the script

Delete any default code in the editor, then paste the full contents of `gmail_sync.gs`.

### Step 4 — Save

Press **Cmd+S** (Mac) or **Ctrl+S** (Windows) to save. Name the project something like `BW District Email Sync`.

### Step 5 — Run `setup()` once

In the function dropdown at the top of the editor (it may say `myFunction`), select **`setup`** and click the **▶ Run** button.

You will be prompted to grant permissions:
- **View and manage your Gmail** — needed to search Sent mail
- **View and manage spreadsheets** — needed to write rows
- **Connect to external services** — needed for the trigger

Accept all prompts. After running, you should see in the Logs:

```
✅ Hourly trigger installed for syncSentEmails.
✅ Spreadsheet 'Email Activity Log' is ready.
```

You only need to run `setup()` once. It installs a trigger that calls `syncSentEmails()` every hour automatically.

---

## Adding district contact emails

After running `setup()`, a **District Contacts** tab will appear in the spreadsheet with three columns:

| A: Email | B: District Name | C: Director Name |
|----------|-----------------|-----------------|
| director@polk-fl.net | Polk County Schools | Jane Smith |
| ec@shelby.k12.al.us | Shelby County Schools | John Doe |

Paste all district director email addresses into **column A** (starting row 2). Columns B and C are optional notes for your reference — the script only reads column A.

The script matches against this list on every run, so you can add new contacts at any time and they'll be picked up on the next hourly run.

---

## Verifying the trigger is active

1. In the Apps Script editor, click the **clock icon** (Triggers) in the left sidebar
2. You should see a row for `syncSentEmails` with type `Time-driven`, interval `Hour timer`, and frequency `Every hour`

To test immediately without waiting for the trigger, select `syncSentEmails` in the function dropdown and click **▶ Run**.

---

## Notes

- The script looks back **2 days** on each run (configurable via `LOOKBACK_DAYS` at the top of the file). This gives a safety buffer in case a run is delayed.
- Each team member (Christie, Eric, etc.) needs their own copy of this script running under their own Google account so their emails are captured under their rep email.
- Reply detection checks whether any message in the thread came from a sender other than the authenticated user after the original send date.
