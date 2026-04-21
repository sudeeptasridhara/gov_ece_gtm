---
name: gov-edu-contact-scraping
description: >
  Use this skill whenever the task involves finding, researching, or enriching contact information
  for early childhood education directors, curriculum directors, preschool coordinators, or similar
  district-level administrators in the United States. Triggers include: "find the contact for",
  "look up the director at", "enrich this district list", "who runs early childhood at",
  "find email for", "scrape district website", "research contacts for outreach", or any task
  combining school districts + contact discovery + early childhood / PreK / ECE roles.
  Also use when given a list of districts and asked to find named contacts, emails, or phone numbers
  for early learning or curriculum leadership. This skill should trigger proactively any time
  district-level contact enrichment is the goal, even if the user does not say "scrape" explicitly.
---

# Gov/Edu District Contact Scraping Skill

This skill guides Claude through finding, validating, and recording contact information for
early childhood education decision-makers at the district level across U.S. public school
districts, primarily for Gov/Edu outbound sales outreach (Brightwheel Experience Curriculum).

---

## Target Persona

The primary target is the person who owns early childhood curriculum decisions at the district
level. Job titles vary significantly by district size and state. Prioritize in this order:

1. Director of Early Childhood Education / Early Learning
2. Director of Curriculum and Instruction (PreK or K-12)
3. Coordinator of Early Childhood Programs
4. Director of Federal Programs (if Title I or Head Start funds ECE)
5. Superintendent (only for very small districts with no dedicated ECE staff)

Do not target principals or school-level staff unless: (a) the state DOE's official Pre-K or ECE sub-grantee contact list explicitly names a principal as the district's program contact, or (b) the district is small enough that no district-level ECE staff exists and the principal runs the Pre-K program directly. In both cases, record the principal's title exactly as listed and note the exception in the Notes column. Do not target state agency employees.

---

## Research Workflow


> **State DOE Pre-K contact list check (do this first for Nevada, FL, GA, AL, NM, and OR):** Several state DOEs publish an official list of district-level contacts for their state Pre-K or ECE sub-grantee programs. These lists take precedence over staff directory titles — a principal or coordinator named there is the correct outreach target even if a "Director of ECE" also exists. Always check the relevant state DOE Pre-K professionals page before defaulting to a staff directory search:
> - Nevada: https://doe.nv.gov/offices/oeld/ece-professionals/nevada-ready-state-pre-k-professionals
> - Florida: https://www.fldoe.org/schools/early-learning/
> - Georgia: https://decal.ga.gov/
> - Alabama: https://www.alabamaachieves.org/


### Step 1: Identify the district's official web presence

For each district, run a web search using this pattern:

```
"[District Name] [State] school district early childhood director"
```

Also try:
```
"[District Name] [State] site:*.k12.[state abbreviation].us"
```

If the NCES district ID (LEAID) is available, use it to confirm identity via NCES CCD:
```
https://nces.ed.gov/ccd/districtsearch/
```

Confirm you have the correct district before proceeding. Districts with similar names in
the same state are common, especially in FL, GA, AL, and MI.

---

### Step 2: Search the district website for staff directories

Navigate the official district website (*.k12.[state].us or similar). Look for:

- "Staff Directory" or "Department Directory" pages
- "Curriculum and Instruction" department pages
- "Early Childhood" or "Pre-K" program pages
- "Departments > Instruction" or "Departments > Student Services"

Common URL patterns to try directly if navigation is unclear:
- `/departments/early-childhood`
- `/departments/curriculum`
- `/staff`
- `/about/staff-directory`

If a staff directory is available, extract: full name, title, email, phone (if listed).

---

### Step 3: Targeted Google search if directory not found

If the district website does not have a staff directory or the relevant contact is not listed:

```
"[District Name] [State] early childhood director" email
"[District Name] [State] director curriculum instruction" site:*.k12.*.us
"[District Name] [State] preschool coordinator" email
```

Also search LinkedIn:
```
"[District Name] [State]" "early childhood" director site:linkedin.com
```

Note: LinkedIn profiles often do not show emails. Record the name and title, and flag for
manual enrichment or Apollo.io lookup.

---

### Step 4: Research additional district context

After finding the contact, gather the following additional data points. Each requires
targeted research beyond the staff directory.

**District enrollment:**
Available from NCES CCD directly. Use the LEAID or district name at:
```
https://nces.ed.gov/ccd/districtsearch/
```
Record total district enrollment (not school-level). For districts in FL/GA/AL/MI,
the state DOE data portal is often more current than NCES.

**Current curriculum:**
Actively search for the specific curriculum or instructional program the district uses for
PreK/ECE. This is a required research step -- do not skip it or leave it blank without
running all four search paths below.

Search in this order:
1. District website: look for pages titled "curriculum", "instructional materials",
   "approved programs", "pre-k program", or "early childhood." Search the site directly:
   `"[District Name]" "curriculum" site:*.k12.*.us`
2. Board minutes: curriculum purchases and adoptions are frequently voted on. Search:
   `"[District Name]" "board minutes" "curriculum" "preschool" OR "pre-k"`
3. State DOE instructional materials lists (e.g., Florida DOE approved materials list,
   Georgia DOE curriculum adoption). These are public and often searchable by district.
4. General news search:
   `"[District Name]" "preschool" OR "pre-k" "Creative Curriculum" OR "HighScope" OR "Frog Street" OR "Handwriting Without Tears" OR "CKLA" OR "Opening the World of Learning"`

Common ECE curriculum programs to recognize: Creative Curriculum (Teaching Strategies),
HighScope, Frog Street, Opening the World of Learning (OWL), CKLA (Core Knowledge),
Handwriting Without Tears, Little Learners Love Literacy, Savvas/Pearson PreK, McGraw-Hill
Wonders PreK.

Record the curriculum name and publisher (e.g., "Creative Curriculum by Teaching Strategies").
If none of the four search paths surface a result, leave the cell blank.

**Adoption date:**
If curriculum is identified, attempt to find when it was adopted. Primary sources:
- Board meeting minutes referencing the curriculum purchase or adoption vote
- District press releases or news articles
- State DOE approval records

Record year only if available (e.g., "2021"). Leave blank if not found.

**Buying signals:**
Actively search for evidence that the district is evaluating, replacing, or expanding its
ECE curriculum, or investing in early childhood more broadly. This field should be as
specific and sourced as possible -- vague signals are not useful. If nothing is found,
write "None found" rather than leaving blank.

Signal categories to search for:

1. **Curriculum review or replacement**: Board minutes or agendas referencing a curriculum
   review committee, pilot program, RFP for instructional materials, or curriculum adoption
   vote. These are the strongest signals.

2. **Strategic plan / district improvement plan**: References to early childhood, school
   readiness, literacy, or PreK expansion as a named goal. Check the district's strategic
   plan or continuous improvement plan (often posted as a PDF on the district website).

3. **Grant awards**: Preschool Development Grant (PDG), Title I set-aside for PreK, Head
   Start expansion grants, or state ECE grants. These signal budget available for curriculum.
   Search: `"[District Name]" "preschool development grant" OR "PDG" OR "early childhood grant"`

4. **PreK expansion**: News or board minutes about adding classrooms, new school sites,
   or increased PreK enrollment targets.

5. **Job postings**: Open roles for ECE Director, Curriculum Coordinator, or Instructional
   Coach signal staffing growth or turnover (potential new decision-maker).
   Search: `"[District Name]" "early childhood" job posting site:indeed.com OR site:schoolspring.com`

6. **Accreditation or program quality review**: References to NAEYC accreditation,
   Quality Rating and Improvement System (QRIS) participation, or program audits.

Search patterns to run:
```
"[District Name]" "board minutes" "curriculum" "early childhood"
"[District Name]" "board agenda" "pre-k" OR "preschool" "curriculum"
"[District Name]" "strategic plan" "early childhood" OR "pre-k" OR "school readiness"
"[District Name]" "preschool development grant" OR "PDG"
"[District Name]" "early childhood" "pilot" OR "RFP" OR "request for proposal"
"[District Name]" "early childhood" "expand" OR "new classrooms" OR "enrollment"
```

Record each signal in this format:
`[Signal type] | [Brief description] | [Source: URL or document name] | [Date if known]`

Examples:
- `Strategic plan | PreK expansion listed as 2025 priority goal | district.k12.fl.us/strategic-plan | 2024`
- `Board minutes | Curriculum review committee approved for ECE program | board minutes Feb 2025 | Feb 2025`
- `Grant | $450K PDG-R grant awarded for PreK expansion | ed.gov | Sep 2023`
- `Job posting | ECE Director role posted (new hire or turnover signal) | Indeed | Mar 2025`

If multiple signals exist, separate them with a line break within the cell. Do not truncate.

**District mailing address:**
Find the district's central office address from the official website or NCES CCD.
Record as street, city, state, ZIP.

---

### Step 5: Validate and record findings

For each contact found, record the following fields. Leave any cell blank if the
information was not found -- do not write "not found", "N/A", or any placeholder text.
The only exception is Buying Signals, which should be left blank (not "None found") if
nothing surfaces.

| Field | Notes |
|---|---|
| District Name | Official NCES name preferred |
| NCES LEAID | 7-digit district ID from CCD |
| State | 2-letter abbreviation |
| County | County the district is in (from NCES or district website) |
| District Enrollment | Total students, from NCES CCD or state DOE |
| District Address | Central office street address, city, state, ZIP |
| Contact First Name | |
| Contact Last Name | |
| Title | Exact title as listed, not normalized |
| Email | Bare email address only (e.g. jsmith@district.k12.fl.us). Nothing else in this cell. |
| Email Confidence | High / Medium / Low (see below). Leave blank if no email found. |
| Phone | Direct line or main office; only if confirmed |
| Current Curriculum | Name and publisher if found |
| Adoption Year | Year curriculum was adopted, if found |
| Buying Signals | Structured notes per format in Step 4; leave blank if nothing found |
| Source URL | The specific page where contact info was found |
| Notes | See note guidance below |

**Email Confidence levels** (separate column from Notes):
- **High**: Email found directly on official district website next to this person's name
- **Medium**: Email found in a search result, cached page, or secondary source (not the district site itself)
- **Low**: Email inferred from district pattern confirmed by 2+ other staff on same domain

**Notes column -- what belongs here:**
Record anything that affects how this contact should be treated in outreach or Salesforce.
Be specific. Examples of strong notes:
- "District routes ECE through Escambia County RESA; this contact is at the RESA, not the district itself"
- "Superintendent listed as ECE contact; district has no dedicated ECE staff (<300 students)"
- "Two people share the early childhood director title; second contact: Jane Smith, jsmith@district.k12.al.us"
- "Phone listed is main office, not direct line; ask for [Name] by name"
- "Email format inferred from 3 confirmed staff: first.last@district.k12.fl.us"
- "Position was posted as open on Indeed as of March 2025; may be in transition"
- "District is part of a consortium with [District B]; shared curriculum decision-making possible"

Do not use the Notes column for buying signals (those go in Buying Signals) or for
email confidence (that goes in Email Confidence).

---

### Step 6: Handling common edge cases

**Small districts (< 500 students):** Often no dedicated ECE staff. Target superintendent
directly. If no ECE director is identified, note this in the Notes column rather than
adding placeholder text to the name/title fields.

**Multi-district county offices:** Some districts in AL and GA route ECE through a Regional
Education Service Agency (RESA) or county board. Find the RESA contact if the district
itself has no ECE staff, and note the routing in the Notes column.

**Name-only results (no email):** Record the name and title. Leave the Email and Email
Confidence cells blank and note "Email needed -- check Apollo.io" in the Notes column.
Do not fabricate email formats unless the district's email pattern is confirmed from at
least two other named staff (in which case use Email Confidence: Low).

**Guessing email format:** Only use inferred email formats if:
1. The district's format is confirmed (e.g., `first.last@[district].k12.[state].us`)
2. At least 2 other staff emails from the same domain confirm the pattern
3. Set Email Confidence to Low and note the inferred pattern in the Notes column

---

## Output Format

**Default output is a Google Sheet (.xlsx file written via openpyxl, imported to Google Sheets).**
Always produce a file unless the user explicitly asks for a markdown table or inline text.

### Column order (exact, always use this sequence)

| Col | Header |
|-----|--------|
| A | District Name |
| B | NCES LEAID |
| C | State |
| D | County |
| E | District Enrollment |
| F | District Address |
| G | Contact First Name |
| H | Contact Last Name |
| I | Title |
| J | Email |
| K | Email Confidence |
| L | Phone |
| M | Current Curriculum |
| N | Adoption Year |
| O | Buying Signals |
| P | Source URL |
| Q | Notes |

### Formatting rules

- **Header row** (row 1): Bold, white text, dark blue fill (RGB 31, 73, 125), freeze pane
- **Data rows**: Alternating white and light blue (RGB 217, 235, 247) for readability
- **Column widths**: Auto-size all columns; cap at 60 chars wide for Buying Signals and Notes
- **Text wrap**: Enable wrap for columns O (Buying Signals) and Q (Notes)
- **Empty cells**: Leave blank if data was not found. Do not write "not found", "N/A",
  "unknown", or any placeholder. Blank cells signal to the user that enrichment is needed.
- **Email column (J)**: Bare email address only (e.g. `jsmith@district.k12.fl.us`).
  No labels, no parentheses, no confidence notes, no "inferred" text. Nothing else in this cell.
- **Buying Signals (O)**: Each signal on its own line within the cell. Use the format:
  `[Type] | [Description] | [Source] | [Date]`
  Leave blank if nothing found -- do not write "None found."
- **Notes (Q)**: Full sentence notes as described in Step 5. Leave blank if nothing to add.
- **Row 3 headers, data from row 4**: Follow Brightwheel spreadsheet convention.
  Row 1: Title/label row ("Gov/Edu District Contact Research -- [State] -- [Date]")
  Row 2: Blank
  Row 3: Column headers (bold, formatted as above)
  Row 4+: Data

### Python snippet for writing the file

```python
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Contacts"

HEADERS = [
    "District Name", "NCES LEAID", "State", "County", "District Enrollment",
    "District Address", "Contact First Name", "Contact Last Name", "Title",
    "Email", "Email Confidence", "Phone", "Current Curriculum", "Adoption Year",
    "Buying Signals", "Source URL", "Notes"
]

header_fill = PatternFill("solid", fgColor="1F497D")
alt_fill = PatternFill("solid", fgColor="D9EBF7")
header_font = Font(bold=True, color="FFFFFF")
wrap = Alignment(wrap_text=True, vertical="top")

# Row 1: title
ws.cell(row=1, column=1, value=f"Gov/Edu District Contact Research")
ws.cell(row=1, column=1).font = Font(bold=True, size=12)

# Row 3: headers
for col_idx, h in enumerate(HEADERS, start=1):
    cell = ws.cell(row=3, column=col_idx, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center", vertical="center")

# Data rows starting row 4
for row_idx, record in enumerate(data, start=4):
    fill = alt_fill if row_idx % 2 == 0 else PatternFill()
    for col_idx, value in enumerate(record, start=1):
        cell = ws.cell(row=row_idx, column=col_idx, value=value)
        cell.fill = fill
        cell.alignment = wrap

# Freeze header row
ws.freeze_panes = "A4"

# Auto-width (capped)
for col_idx, _ in enumerate(HEADERS, start=1):
    col_letter = get_column_letter(col_idx)
    max_len = max(
        len(str(ws.cell(row=r, column=col_idx).value or ""))
        for r in range(3, ws.max_row + 1)
    )
    ws.column_dimensions[col_letter].width = min(max_len + 4, 60)

wb.save("district_contacts.xlsx")
```

### Grouping for batch runs (5+ districts)

Sort the output rows by Email Confidence descending (High first), then by presence of
Buying Signals (non-empty before "None found"). Do not create separate tabs -- keep all
records in one sheet so they can be filtered.

Always surface buying signals prominently. Even a single signal (e.g., a strategic plan
mention) changes outreach prioritization and should be recorded fully.

---

## State-Specific Notes

### Florida
- Most districts use the format `[district]schools.net` or `[district].k12.fl.us`
- Florida DOE maintains a district contacts page: https://www.fldoe.org/schools/early-learning/
- Voluntary PreK (VPK) is the primary ECE program; search for "VPK Director" or "Early
  Learning Coalition" as a secondary source (Early Learning Coalitions are county-level,
  not district-level, but can point to district contacts)

### Georgia
- Georgia uses `[district].k12.ga.us` consistently
- GOSA (Governor's Office of Student Achievement) has district profiles
- Search for "Bright from the Start" grant contacts as a proxy for ECE leadership

### Alabama
- Alabama uses `[district].k12.al.us`
- First Class Pre-K is the state program; district contacts often listed at
  https://www.alabamaachieves.org/
- Many rural districts route ECE through the county superintendent

### Michigan
- Michigan uses `[district].k12.mi.us` or `[district].org` for ISDs
- ISDs (Intermediate School Districts) often coordinate ECE across multiple local districts
- Great Start Readiness Program (GSRP) is the state PreK program; search for GSRP contacts

---

## What NOT to Do

- Do not contact or record information for state agency staff (e.g., state DOE employees)
- Do not record principal or school-level contacts unless the state DOE official Pre-K/ECE sub-grantee contact list names them as the program contact, or they are the only person running the program in a very small district
- Do not fabricate contacts, emails, or phone numbers
- Do not use data from unofficial third-party scrapers (e.g., schooldatahub.com) as
  the primary source; these are often outdated and unreliable for contact info
- Do not mark a contact as confirmed unless it appears on an official district or government
  source

---

## Integration Notes

- Salesforce is the system of record for all confirmed contacts (UCDB)
- Gmail is the current outreach workaround; HubSpot is unavailable
- Christie Cooley (Head of District Partnerships) is the sender name on outreach
- All contacts should ultimately map to a Salesforce Account by NCES LEAID
- Apollo.io is the intended enrichment layer for email-only lookups once contacts are named
