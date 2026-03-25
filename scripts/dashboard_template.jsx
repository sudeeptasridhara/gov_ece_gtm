// ─── INTEGRATION CONFIG ───────────────────────────────────────────────────────
// Fill these in once in GitHub → scripts/dashboard_template.jsx, then run the
// GitHub Action to rebuild. See setup instructions in the README.
const GOOGLE_CLIENT_ID = "642445271504-vr3au2pic0ma5aekadpq4icrv9t9eekj.apps.googleusercontent.com";
const SLACK_WEBHOOK_URL = ""; // e.g. "https://hooks.slack.com/services/T.../B.../xxx"

// ─── EMAIL HELPERS ────────────────────────────────────────────────────────────
const EC_BANNER_URL = "https://sudeeptasridhara.github.io/gov_ece_gtm/assets/ec-banner.png";
// PDF attached to Summer Bridge emails — upload ec-overview.pdf to your GitHub Pages assets/ folder
const EC_OVERVIEW_PDF_URL = "https://sudeeptasridhara.github.io/gov_ece_gtm/assets/ec-overview.pdf";
// Unsubscribe landing page + Google Form logger
const UNSUB_PAGE = "https://sudeeptasridhara.github.io/gov_ece_gtm/unsubscribe.html";

// Parse "Subject: ..." off the first line of a generated email body
function parseEmailParts(fullBody) {
  const lines = fullBody.split("\n");
  const subject = lines[0].replace(/^Subject:\s*/i, "").trim();
  const body = lines.slice(2).join("\n").trim();
  return { subject, body };
}

// Strip HTML tags — used for Slack and plain-text preview
function stripHtml(html) {
  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n").trim();
}

// Build a base64url-encoded RFC 2822 HTML message for the Gmail API
function buildRawEmail(to, subject, htmlBody) {
  const utf8Subject = "=?utf-8?B?" + btoa(unescape(encodeURIComponent(subject))) + "?=";
  const raw = [
    "To: " + to,
    "Subject: " + utf8Subject,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    htmlBody,
  ].join("\r\n");
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Build a multipart RFC 2822 message with an HTML body + PDF attachment
async function buildRawEmailWithAttachment(to, subject, htmlBody, pdfUrl, pdfFileName) {
  const boundary = "==Boundary_" + Math.random().toString(36).slice(2, 14);
  const utf8Subject = "=?utf-8?B?" + btoa(unescape(encodeURIComponent(subject))) + "?=";
  // Base64-encode the HTML body (76-char line wrapping per RFC 2045)
  const htmlB64 = btoa(unescape(encodeURIComponent(htmlBody))).match(/.{1,76}/g).join("\r\n");

  // Fetch PDF and convert to base64
  let pdfB64 = null;
  try {
    const resp = await fetch(pdfUrl);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      pdfB64 = btoa(bin).match(/.{1,76}/g).join("\r\n");
    }
  } catch (e) {
    console.warn("EC Overview PDF fetch failed — sending without attachment:", e);
  }

  if (!pdfB64) {
    // Fall back to regular email without attachment
    return buildRawEmail(to, subject, htmlBody);
  }

  const raw =
    "To: " + to + "\r\n" +
    "Subject: " + utf8Subject + "\r\n" +
    "MIME-Version: 1.0\r\n" +
    'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n' +
    "\r\n" +
    "--" + boundary + "\r\n" +
    "Content-Type: text/html; charset=utf-8\r\n" +
    "Content-Transfer-Encoding: base64\r\n" +
    "\r\n" +
    htmlB64 + "\r\n" +
    "\r\n" +
    "--" + boundary + "\r\n" +
    "Content-Type: application/pdf\r\n" +
    "Content-Transfer-Encoding: base64\r\n" +
    'Content-Disposition: attachment; filename="' + pdfFileName + '"\r\n' +
    "\r\n" +
    pdfB64 + "\r\n" +
    "\r\n" +
    "--" + boundary + "--";

  // raw is all ASCII (subject is encoded, body+PDF are base64), so btoa works directly
  return btoa(raw)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// HTML email building blocks
const S = {
  wrap:  'font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333333;line-height:1.6;max-width:600px;margin:0;padding:0;',
  p:     'margin:0 0 14px 0;',
  a:     'color:#5046e5;text-decoration:none;font-weight:600;',
  ul:    'margin:0 0 14px 0;padding-left:22px;',
  li:    'margin-bottom:10px;',
  sig:   'margin-top:20px;padding-top:16px;border-top:2px solid #5046e5;font-size:13px;color:#555555;',
};

function ep(text) { return `<p style="${S.p}">${text}</p>`; }
function ea(href, label) { return `<a href="${href}" style="${S.a}">${label}</a>`; }

function emailImage() {
  return `<img src="${EC_BANNER_URL}" alt="Experience Preschool — brightwheel" width="580" style="width:100%;max-width:580px;display:block;margin:24px 0;border-radius:6px;" />`;
}

function emailSignature() {
  return `<div style="${S.sig}">Best,<br><strong style="color:#222;">Christie Cooley</strong><br>Head of District Partnerships | brightwheel<br>${ea("mailto:christie.cooley@mybrightwheel.com","christie.cooley@mybrightwheel.com")} | 678-464-1018</div>`;
}

function buildUnsubUrl(name, email, district) {
  return `${UNSUB_PAGE}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&district=${encodeURIComponent(district)}`;
}

function buildHtmlEmail(subject, bodyHtml, unsubUrl, includeImage = true) {
  const unsubFooter = unsubUrl
    ? `<div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#b0b7c3;text-align:center;">Don't want to receive these emails?&nbsp;<a href="${unsubUrl}" style="color:#b0b7c3;text-decoration:underline;">Unsubscribe</a></div>`
    : "";
  const imageBlock = includeImage ? emailImage() : "";
  const html = `<!DOCTYPE html><html><body style="${S.wrap}">${bodyHtml}${imageBlock}${emailSignature()}${unsubFooter}</body></html>`;
  return `Subject: ${subject}\n\n${html}`;
}

// ─── PRIORITY SCORING ALGORITHM ──────────────────────────────────────────────
function calculatePriorityScore(d) {
  let score = 0;
  const currentYear = 2026;
  const age = currentYear - d.curriculumAdoptionYear;

  // Tier base (max 50 pts)
  if (d.priorityTier === "Tier 1") score += 50;
  else if (d.priorityTier === "Tier 2") score += 35;
  else if (d.priorityTier === "Tier 3") score += 20;

  // Curriculum age bonus (max 25 pts)
  if (age >= 8) score += 25;
  else if (age >= 6) score += 18;
  else if (age >= 4) score += 12;
  else if (age >= 3) score += 6;

  // Buying signals (max 15 pts)
  score += Math.min(d.buyingSignals.length * 3, 15);

  // New leadership bonus (10 pts)
  if (d.newLeadership) score += 10;

  return Math.round(Math.min(score, 100));
}

function getPriorityLabel(score) {
  if (score >= 75) return { label: "🔥 Hot", color: "bg-red-100 text-red-700 border border-red-300" };
  if (score >= 55) return { label: "🌡️ Warm", color: "bg-orange-100 text-orange-700 border border-orange-300" };
  if (score >= 35) return { label: "💧 Cool", color: "bg-blue-100 text-blue-700 border border-blue-300" };
  return { label: "❄️ Cold", color: "bg-gray-100 text-gray-500 border border-gray-200" };
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

function buildContextPersonalization(district) {
  // Pull the richest context snippets for email personalization
  const ctx = district.districtContext || [];
  const signals = district.buyingSignals || [];

  // Prefer strategic context, then funding, then website
  const strategic = ctx.find((c) => c.type === "strategic");
  const funding    = ctx.find((c) => c.type === "funding");
  const website    = ctx.find((c) => c.type === "website");

  // Check signals for useful hooks
  const hasSummer    = signals.some((s) => s.toLowerCase().includes("summer"));
  const hasGrant     = signals.some((s) => s.toLowerCase().includes("grant") || s.toLowerCase().includes("funding"));
  const hasLeadership = signals.some((s) => s.toLowerCase().includes("contact change") || s.toLowerCase().includes("appointed"));

  let hook = "";

  if (strategic) {
    hook = `I came across ${district.district}'s recent strategic priorities around early childhood — it sounds like readiness outcomes are a real focus right now.`;
  } else if (hasSummer) {
    hook = `I noticed ${district.district} has an upcoming summer program — brightwheel's Experience Preschool is designed for exactly that kind of 4–8 week bridge program, with lessons pre-packaged by the day.`;
  } else if (hasGrant) {
    const grantEntry = funding || ctx.find((c) => c.type === "funding");
    if (grantEntry) {
      hook = `I saw that ${district.district} recently received additional early childhood funding — this feels like a great moment to make sure those dollars go as far as possible for VPK students.`;
    } else {
      hook = `With new early childhood funding flowing to districts across Florida, this feels like a timely moment to connect around VPK support.`;
    }
  } else if (website) {
    hook = `I was exploring ${district.district}'s early childhood program page and it's clear your team is investing meaningfully in VPK readiness.`;
  } else if (hasLeadership) {
    hook = `I understand there may have been some recent changes on your early childhood leadership team — I wanted to reach out as you're getting settled.`;
  } else {
    hook = `brightwheel's Experience Preschool is a flexible, play-based curriculum designed to support VPK-to-Kindergarten transitions, with lessons pre-packaged and organized by the day so your team isn't starting from scratch.`;
  }

  return { hook, hasSummer, hasGrant, hasLeadership };
}

// Detect whether a district already uses EC (brightwheel's curriculum)
function districtAlreadyUsesEC(district) {
  const vendor = (district.curriculumVendor || "").toLowerCase();
  const curric = (district.curriculum || "").toLowerCase();
  return vendor.includes("ec") || vendor.includes("experience") ||
         curric.includes("ec") || curric.includes("experience curriculum") ||
         curric.includes("brightwheel");
}

// Detect whether a district has federal funding signals
function districtHasFederalFunding(district) {
  const signals = (district.buyingSignals || []).join(" ").toLowerCase();
  const ctx     = (district.districtContext || []).map((c) => c.summary).join(" ").toLowerCase();
  const notes   = (district.notes || "").toLowerCase();
  return ["title i", "head start", "federal", "esser", "idea", "preschool development grant"]
    .some((kw) => signals.includes(kw) || ctx.includes(kw) || notes.includes(kw));
}

// Returns the right contact object for a given template.
// Summer Bridge emails use summerBridgeContact if available; all others use the main director.
function resolveContact(district, template) {
  const isSummerBridgeTemplate = template === "summerBridge" || template === "summerBridgeShort";
  if (isSummerBridgeTemplate && district.summerBridgeContact) {
    return {
      name:  district.summerBridgeContact.fullName,
      email: district.summerBridgeContact.email,
      isSummerBridge: true,
    };
  }
  return {
    name:  district.director,
    email: district.email,
    isSummerBridge: false,
  };
}

function generateEmail(district, template) {
  const contact = resolveContact(district, template);

  const stateCode = district.state || "FL";
  const STATE_NAMES = { FL: "Florida", AL: "Alabama" };
  const stateName = STATE_NAMES[stateCode] || stateCode;

  const isSummerBridgeTemplate = template === "summerBridge" || template === "summerBridgeShort";
  let greetingName;
  if (isSummerBridgeTemplate && district.summerBridgeContact) {
    greetingName = district.summerBridgeContact.firstName;
  } else if (district.callToConfirm) {
    greetingName = district.director;
  } else {
    greetingName = district.director.split(" ")[0];
  }
  const helloGreeting = ep(`Hello ${greetingName},`);
  const hiGreeting    = ep(`Hi ${greetingName},`);

  const calendlyLink = ep(ea("https://mybrightwheel.chilipiper.com/me/christie-cooley/meeting-with-christie-cooley", "Schedule time with me →"));

  // Build a per-recipient unsubscribe URL so clicks are logged against the right contact
  const unsubRecipientName = (isSummerBridgeTemplate && district.summerBridgeContact)
    ? district.summerBridgeContact.fullName
    : district.director;
  const unsubRecipientEmail = (isSummerBridgeTemplate && district.summerBridgeContact)
    ? district.summerBridgeContact.email
    : district.email;
  const unsubUrl = buildUnsubUrl(unsubRecipientName, unsubRecipientEmail, district.district);

  const templates = {
    // ── Original Email (all states) ───────────────────────────────────────────
    original: buildHtmlEmail(
      `Improve Kindergarten Readiness Scores`,
      hiGreeting +
      ep(`Many districts are looking for ways to increase Kindergarten readiness scores and support students transitioning into Kindergarten.`) +
      ep(`Brightwheel's Experience Preschool is a flexible, play-based curriculum designed to support 4–8 week summer programs that help incoming Kindergarten students build the skills measured in readiness assessments. Because lessons are pre-packaged and organized by the day, many districts use it for summer programs.`) +
      ep(`${ea("https://drive.google.com/file/d/1T0MH4mV0OvG5JmZgU8qK-5EF7xcSUIpO/view", "Click here to learn more")} if your program is planning summer readiness or transition programming.`) +
      ep(`I'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.`) +
      calendlyLink,
      unsubUrl,
      false
    ),

    // ── Summer Long (all states) ──────────────────────────────────────────────
    summerLong: buildHtmlEmail(
      `Improve Kindergarten Readiness with Play-Based Summer Learning`,
      helloGreeting +
      ep(`The summer before kindergarten is one of the most critical windows in a child's educational journey.`) +
      ep(`Experience Curriculum, powered by brightwheel, is the perfect solution for ${stateName}'s summer programs. Everything teachers need is delivered in a ready-to-use kit, including lesson plans, materials, and student supplies for a classroom of 12.`) +
      ep(`At $249 for 4 weeks and $399 for 8 weeks, Experience Curriculum is priced to address the budgetary challenges many programs are facing.`) +
      ep(`For ${stateName}'s summer programs, Experience Curriculum is a strong fit:`) +
      `<ul style="${S.ul}">
        <li style="${S.li}"><strong>Aligned to ${stateName}'s Standards for Early Learning and Development;</strong> emergent literacy instruction is grounded in the science of reading and built into every lesson</li>
        <li style="${S.li}"><strong>Easy to Implement:</strong> Whether your staff includes seasoned veterans or teachers just finding their footing, Experience Curriculum is ready to run from day one with access to free onboarding &amp; training.</li>
        <li style="${S.li}"><strong>Built-in progress monitoring:</strong> Student observations and attendance documentation are integrated through the Brightwheel app.</li>
      </ul>` +
      ep(`${ea("https://drive.google.com/file/d/1T0MH4mV0OvG5JmZgU8qK-5EF7xcSUIpO/view", "Click here to learn more")} if your program is planning summer readiness or transition programming for VPK students.`) +
      ep(`I'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.`) +
      calendlyLink,
      unsubUrl,
      false
    ),

    // ── Summer Short (all states) ─────────────────────────────────────────────
    summerShort: buildHtmlEmail(
      `Improve Kindergarten Readiness with Play-Based Summer Learning`,
      hiGreeting +
      ep(`Are you planning for the summer transition to Kindergarten?`) +
      ep(`Experience Curriculum, powered by brightwheel, is the perfect solution.`) +
      `<ul style="${S.ul}">
        <li style="${S.li}">Everything teachers need is delivered in a ready-to-use kit, including lesson plans, materials, and student supplies for a classroom of 12</li>
        <li style="${S.li}">It's aligned to ${stateName}'s Standards for Early Learning and Development</li>
        <li style="${S.li}">Progress monitoring ties directly into the Brightwheel app, so there's minimal setup for teachers</li>
        <li style="${S.li}">Free online professional development</li>
      </ul>` +
      ep(`Pricing is $249 for 4-week programs or $399 for 8-week programs.`) +
      ep(`Happy to send additional materials or jump on a quick call if it's helpful. Schedule time with me at the link below or just reply and we can find a time.`) +
      calendlyLink,
      unsubUrl,
      false
    ),

    // ── FL Summer Bridge (Long) ───────────────────────────────────────────────
    summerBridge: buildHtmlEmail(
      `Let's simplify your Summer Bridge program`,
      helloGreeting +
      ep(`The summer before kindergarten is one of the most critical windows in a child's educational journey.`) +
      ep(`Experience Curriculum, powered by brightwheel, is the perfect solution for Florida's Summer Bridge Program. Everything teachers need is delivered in a ready-to-use kit, including lesson plans, materials, and student supplies for a classroom of 12.`) +
      ep(`At $249 for 4 weeks and $399 for 8 weeks, Experience Curriculum is priced to address the budgetary challenges many programs are facing.`) +
      ep(`For Summer Bridge, Experience Curriculum is a strong fit:`) +
      `<ul style="${S.ul}">
        <li style="${S.li}"><strong>Aligned to Florida's Early Learning and Developmental Standards;</strong> emergent literacy instruction is grounded in the science of reading and built into every lesson</li>
        <li style="${S.li}"><strong>Easy to Implement:</strong> Whether your staff includes seasoned veterans or teachers just finding their footing, Experience Curriculum is ready to run from day one with access to free onboarding &amp; training.</li>
        <li style="${S.li}"><strong>Built-in progress monitoring:</strong> Student observations and attendance documentation are integrated through the Brightwheel app.</li>
      </ul>` +
      ep(`${ea("https://drive.google.com/file/d/1T0MH4mV0OvG5JmZgU8qK-5EF7xcSUIpO/view", "Click here to learn more")} if your program is planning summer readiness or transition programming for VPK students.`) +
      ep(`I'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.`) +
      calendlyLink,
      unsubUrl,
      false  // no banner image
    ),

    // ── FL Summer Bridge (Short) ──────────────────────────────────────────────
    summerBridgeShort: buildHtmlEmail(
      `Experience Curriculum Simplifies Summer`,
      hiGreeting +
      ep(`Are you planning for summer transition to Kindergarten?`) +
      ep(`Experience Curriculum, powered by brightwheel, is the perfect solution.`) +
      `<ul style="${S.ul}">
        <li style="${S.li}">Everything teachers need is delivered in a ready-to-use kit, including lesson plans, materials, and student supplies for a classroom of 12</li>
        <li style="${S.li}">It's aligned to Florida's Early Learning and Developmental Standards</li>
        <li style="${S.li}">Progress monitoring ties directly into the Brightwheel app, so there's minimal setup for teachers</li>
        <li style="${S.li}">Free online professional development</li>
      </ul>` +
      ep(`Pricing is $249 for 4 week programs or $399 for 8 week programs.`) +
      ep(`Happy to send additional materials or jump on a quick call if it's helpful. Schedule time with me at the link below or just reply and we can find a time.`) +
      calendlyLink,
      unsubUrl,
      false  // no banner image
    ),
  };

  return templates[template] || "";
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function BrightwheelDashboard() {
  const [districts, setDistricts] = useState(() =>
    INITIAL_DISTRICTS.map((d) => ({ ...d, priority: calculatePriorityScore(d) })).sort(
      (a, b) => b.priority - a.priority
    )
  );

  const [activeTab, setActiveTab] = useState("prospects");
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCurriculum, setFilterCurriculum] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [modalTab, setModalTab] = useState("overview");
  const [approvalQueue, setApprovalQueue] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [newActivity, setNewActivity] = useState({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });
  const [notification, setNotification] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("summerLong");
  const [emailPreview, setEmailPreview] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showSummerBridge, setShowSummerBridge] = useState(false);

  // ── GMAIL OAUTH ──
  const [gmailToken, setGmailToken] = useState(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const pendingDraftRef = useRef(null);

  const [emailPickerId, setEmailPickerId] = useState(null); // must be declared before the useEffect below

  // Close the email template picker when clicking anywhere outside it
  useEffect(() => {
    if (!emailPickerId) return;
    const close = () => setEmailPickerId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [emailPickerId]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      setGisReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => setGisReady(true);
    document.head.appendChild(s);
  }, []);

  const connectGmail = (afterConnect) => {
    if (!window.google) { showNotif("Google Sign-In not loaded yet — try again in a moment", "red"); return; }
    if (afterConnect) pendingDraftRef.current = afterConnect;
    window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/gmail.send",
      callback: (resp) => {
        if (resp.access_token) {
          setGmailToken(resp.access_token);
          setGmailConnected(true);
          showNotif("Gmail connected ✓");
          if (pendingDraftRef.current) {
            pendingDraftRef.current(resp.access_token);
            pendingDraftRef.current = null;
          }
        }
      },
    }).requestAccessToken();
  };

  const sendEmail = async (item, token) => {
    const useToken = token || gmailToken;
    if (!useToken) { connectGmail((t) => sendEmail(item, t)); return; }
    const { subject, body } = parseEmailParts(item.body);
    const raw = buildRawEmail(item.to, subject, body);
    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: "Bearer " + useToken, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      if (res.ok) {
        rejectEmail(item.id);
        showNotif("✅ Email sent — " + item.directorName);
      } else if (res.status === 401) {
        setGmailToken(null); setGmailConnected(false);
        showNotif("Gmail session expired — reconnecting...", "red");
        connectGmail((t) => sendEmail(item, t));
      } else {
        showNotif("Gmail error " + res.status + " — check console", "red");
      }
    } catch (e) {
      showNotif("Gmail request failed: " + e.message, "red");
    }
  };

  const sendAllEmails = async () => {
    if (!gmailToken && GOOGLE_CLIENT_ID) { connectGmail((t) => { /* sends will fire from pending */ }); }
    for (const item of [...approvalQueue]) {
      await sendEmail(item, gmailToken);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  // ── BULK SELECTION ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTemplate, setBulkTemplate] = useState("summerLong");

  const toggleSelect = (id) =>
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const clearSelection = () => setSelectedIds(new Set());

  const showNotif = (msg, color = "green") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── FILTERED DISTRICTS ──
  const filtered = useMemo(() => {
    return districts.filter((d) => {
      const matchSearch =
        d.district.toLowerCase().includes(search.toLowerCase()) ||
        d.director.toLowerCase().includes(search.toLowerCase()) ||
        d.county.toLowerCase().includes(search.toLowerCase());
      const matchPriority =
        filterPriority === "all" ||
        (filterPriority === "hot" && d.priority >= 75) ||
        (filterPriority === "warm" && d.priority >= 55 && d.priority < 75) ||
        (filterPriority === "cool" && d.priority >= 35 && d.priority < 55) ||
        (filterPriority === "cold" && d.priority < 35);
      const matchState = filterState === "all" || (d.state || "FL") === filterState;
      const matchCurriculum =
        filterCurriculum === "all" || d.curriculumVendor === filterCurriculum;
      const matchStatus = filterStatus === "all" || d.status === filterStatus;
      return matchSearch && matchPriority && matchState && matchCurriculum && matchStatus;
    });
  }, [districts, search, filterState, filterPriority, filterCurriculum, filterStatus]);

  // ── BULK SELECTION DERIVED ── (must come after filtered)
  const allVisibleSelected = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));
  const someVisibleSelected = filtered.some((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => { const s = new Set(prev); filtered.forEach((d) => s.delete(d.id)); return s; });
    } else {
      setSelectedIds((prev) => { const s = new Set(prev); filtered.forEach((d) => s.add(d.id)); return s; });
    }
  };

  const bulkQueue = (template) => {
    const isFLOnly = template === "summerBridge" || template === "summerBridgeShort";
    const toQueue = districts.filter((d) => selectedIds.has(d.id) && (!isFLOnly || (d.state || "FL") === "FL"));
    toQueue.forEach((d) => queueEmail(d, template, true)); // silent=true — suppress per-item toasts
    showNotif(`📧 ${toQueue.length} email${toQueue.length !== 1 ? "s" : ""} added to Send Queue ✓`);
    clearSelection();
  };

  // ── STATS ──
  const stats = useMemo(() => ({
    total: districts.length,
    hot: districts.filter((d) => d.priority >= 75).length,
    warm: districts.filter((d) => d.priority >= 55 && d.priority < 75).length,
    contacted: districts.filter((d) => d.status !== "not contacted").length,
    queue: approvalQueue.length,
  }), [districts, approvalQueue]);

  const updateDistrict = (id, updates) => {
    setDistricts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    if (selectedDistrict?.id === id) setSelectedDistrict((prev) => ({ ...prev, ...updates }));
  };

  const addActivity = (district) => {
    if (!newActivity.notes) return;
    const act = { ...newActivity, id: Date.now(), district: district.district, directorName: district.director };
    const updatedActivities = [...(district.activities || []), act];
    updateDistrict(district.id, { activities: updatedActivities, status: newActivity.type === "meeting" ? "meeting scheduled" : district.status });
    setActivityLog((prev) => [act, ...prev]);
    setNewActivity({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });
    showNotif("Activity logged ✓");
  };

  const queueEmail = (district, template, silent = false) => {
    const body = generateEmail(district, template);
    const contact = resolveContact(district, template);
    const item = {
      id: Date.now() + Math.random(), // unique even when called rapidly in bulk
      district: district.district,
      districtId: district.id,
      to: contact.email,
      directorName: contact.name,
      isSummerBridgeContact: contact.isSummerBridge,
      template,
      body,
      status: "pending",
      createdAt: new Date().toLocaleString(),
    };
    setApprovalQueue((prev) => {
      // Skip if this district+template combo is already queued
      if (prev.find((x) => x.districtId === district.id && x.template === template)) return prev;
      return [item, ...prev];
    });
    updateDistrict(district.id, { status: "reached out" });
    if (!silent) showNotif(`📧 Queued — ${district.director}`);
  };

  const approveEmail = (queueItem) => {
    setApprovalQueue((prev) => prev.filter((x) => x.id !== queueItem.id));
    showNotif(`✅ Approved & sent to Gmail drafts — ${queueItem.directorName}`);
  };

  const rejectEmail = (id) => {
    setApprovalQueue((prev) => prev.filter((x) => x.id !== id));
    showNotif("Email removed from queue.", "red");
  };

  const CURRICULUM_VENDORS = [...new Set(INITIAL_DISTRICTS.map((d) => d.curriculumVendor))];
  const STATUSES = ["not contacted", "reached out", "responded", "meeting scheduled", "proposal sent", "closed won", "closed lost", "unsubscribed"];

  const statusColor = (s) => {
    if (s === "closed won") return "text-green-600 font-semibold";
    if (s === "closed lost") return "text-red-500";
    if (s === "unsubscribed") return "text-gray-400 line-through";
    if (s === "meeting scheduled") return "text-purple-600 font-semibold";
    if (s === "proposal sent") return "text-blue-600";
    if (s === "responded") return "text-teal-600";
    if (s === "reached out") return "text-orange-600";
    return "text-gray-400";
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-sm text-gray-800">
      {/* NOTIFICATION */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium transition-all ${notification.color === "red" ? "bg-red-500" : "bg-green-600"}`}>
          {notification.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">bw</div>
          <div>
            <h1 className="text-base font-bold text-gray-900">brightwheel · PreK Sales Intelligence</h1>
            <p className="text-xs text-gray-400">Early Childhood Director Outreach</p>
          </div>
        </div>
        <div className="flex gap-4 text-center">
          {[
            { label: "Total Districts", val: stats.total, color: "text-gray-700" },
            { label: "🔥 Hot Leads", val: stats.hot, color: "text-red-600" },
            { label: "🌡️ Warm Leads", val: stats.warm, color: "text-orange-500" },
            { label: "Contacted", val: stats.contacted, color: "text-indigo-600" },
            { label: "Send Queue", val: stats.queue, color: "text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
        {[
          { id: "prospects", label: "📋 Prospects" },
          { id: "outreach", label: "📤 Outreach Planner" },
          { id: "templates", label: "✉️ Email Templates" },
          { id: "activity", label: "📞 Activity Log" },
          { id: "approval", label: `📤 Send Queue ${stats.queue > 0 ? `(${stats.queue})` : ""}` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-4">
        {/* ── PROSPECTS TAB ── */}
        {activeTab === "prospects" && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search district, director, county..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {[
                { label: "State", val: filterState, setter: setFilterState, opts: [["all","All States"],["FL","🌴 Florida"],["AL","Alabama"]] },
                { label: "Priority", val: filterPriority, setter: setFilterPriority, opts: [["all","All Priorities"],["hot","🔥 Hot"],["warm","🌡️ Warm"],["cool","💧 Cool"],["cold","❄️ Cold"]] },
                { label: "Curriculum", val: filterCurriculum, setter: setFilterCurriculum, opts: [["all","All Curricula"], ...CURRICULUM_VENDORS.map(v => [v, v])] },
                { label: "Status", val: filterStatus, setter: setFilterStatus, opts: [["all","All Statuses"], ...STATUSES.map(s => [s, s])] },
              ].map((f) => (
                <select
                  key={f.label}
                  value={f.val}
                  onChange={(e) => f.setter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
              <span className="text-xs text-gray-400 ml-2">{filtered.length} results</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                        title={allVisibleSelected ? "Deselect all" : "Select all visible"}
                      />
                    </th>
                    {["Priority", "District", "Director", "Curriculum", "Adopted", "Age", "Enrollment", "Signals", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => {
                    const p = getPriorityLabel(d.priority);
                    const age = 2026 - d.curriculumAdoptionYear;
                    return (
                      <tr key={d.id} className={`border-t border-gray-100 hover:bg-indigo-50 transition-colors ${selectedIds.has(d.id) ? "bg-indigo-50 border-l-2 border-l-indigo-400" : i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-3 py-2.5 w-8">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${p.color}`}>{p.label}</span>
                            <span className="text-gray-400 text-xs">{d.priority}/100</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-900 flex items-center gap-1.5">
                            {d.county} County
                            {d.state && d.state !== "FL" && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0 rounded font-semibold">{d.state}</span>}
                          </div>
                          <div className="text-gray-400 text-xs truncate max-w-32">{d.district}</div>
                          {d.lastUpdated && <div className="text-green-600 text-xs mt-0.5">🔄 {d.lastUpdated}</div>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{d.director}</div>
                          <div className="text-gray-400 truncate max-w-36">{d.email}</div>
                          <div className="text-gray-400">{d.phone}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{d.curriculum}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">{d.curriculumAdoptionYear}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-bold ${age >= 6 ? "text-red-600" : age >= 4 ? "text-orange-500" : "text-gray-500"}`}>{age}y</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">{d.enrollment.toLocaleString()}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-1">
                            {d.buyingSignals.length > 0 && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-xs">{d.buyingSignals.length} signal{d.buyingSignals.length > 1 ? "s" : ""}</span>
                            )}
                            {d.boardNotes && d.boardNotes.length > 0 && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs">📋 {d.boardNotes.length} board note{d.boardNotes.length > 1 ? "s" : ""}</span>
                            )}
                            {d.districtContext && d.districtContext.length > 0 && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-xs">🔍 {d.districtContext.length} intel</span>
                            )}
                            {d.buyingSignals.length === 0 && (!d.boardNotes || d.boardNotes.length === 0) && (!d.districtContext || d.districtContext.length === 0) && <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={d.status}
                            onChange={(e) => updateDistrict(d.id, { status: e.target.value })}
                            className={`text-xs border-0 bg-transparent focus:outline-none cursor-pointer ${statusColor(d.status)}`}
                          >
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 items-center relative">
                            <button
                              onClick={() => { setSelectedDistrict(d); setModalTab("overview"); }}
                              className="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700"
                            >
                              View
                            </button>
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEmailPickerId(emailPickerId === d.id ? null : d.id); }}
                                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 flex items-center gap-0.5"
                              >
                                ✉️ <span className="text-white/70">▾</span>
                              </button>
                              {emailPickerId === d.id && (
                                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-44 py-1 text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {[
                                    { label: "📧 Original Email", key: "original" },
                                    { label: "☀️ Summer Long", key: "summerLong" },
                                    { label: "☀️ Summer Short", key: "summerShort" },
                                    ...((d.state || "FL") === "FL" ? [
                                      { label: "🌴 FL Summer Bridge (Long)", key: "summerBridge" },
                                      { label: "🌴 FL Summer Bridge (Short)", key: "summerBridgeShort" },
                                    ] : []),
                                  ].map((t) => (
                                    <button
                                      key={t.key}
                                      onClick={() => { queueEmail(d, t.key); setEmailPickerId(null); }}
                                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 transition-colors font-medium"
                                    >
                                      {t.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400">No districts match your filters.</div>
              )}
            </div>

            {/* ── BULK ACTION BAR ── */}
            {selectedIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4">
                <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 flex-wrap">
                  {/* Count + clear */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{selectedIds.size}</span>
                    <span className="text-sm font-medium">{selectedIds.size === 1 ? "district" : "districts"} selected</span>
                    <button onClick={clearSelection} className="text-gray-400 hover:text-white text-xs ml-1 underline">Clear</button>
                  </div>

                  <div className="flex-1" />

                  {/* Standard queue buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 mr-1">Queue for all:</span>
                    {[
                      { label: "📧 Original", key: "original", color: "bg-indigo-600 hover:bg-indigo-500" },
                      { label: "☀️ Summer Long", key: "summerLong", color: "bg-indigo-600 hover:bg-indigo-500" },
                      { label: "☀️ Summer Short", key: "summerShort", color: "bg-indigo-600 hover:bg-indigo-500" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => bulkQueue(t.key)}
                        className={`text-xs text-white px-3 py-1.5 rounded-lg font-medium transition-colors ${t.color}`}
                      >{t.label}</button>
                    ))}

                    {/* FL Summer Bridge CTAs — only shown when FL districts are selected */}
                    {districts.some((d) => selectedIds.has(d.id) && (d.state || "FL") === "FL") && (
                      <>
                        <button
                          onClick={() => bulkQueue("summerBridge")}
                          className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors border border-green-500"
                        >
                          🌴 SB Long
                        </button>
                        <button
                          onClick={() => bulkQueue("summerBridgeShort")}
                          className="text-xs bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors border border-green-400"
                        >
                          🌴 SB Short
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── OUTREACH PLANNER TAB ── */}
        {activeTab === "outreach" && (
          <div>
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Outreach Planner</h2>
              <p className="text-xs text-gray-500 mt-1">Recommended 4-touch outreach sequence per district. Priority-sorted.</p>
            </div>
            <div className="grid gap-4">
              {districts.filter((d) => d.priority >= 55).slice(0, 20).map((d) => {
                const p = getPriorityLabel(d.priority);
                const age = 2026 - d.curriculumAdoptionYear;
                const touches = [
                  { label: "📧 Original Email", template: "original", done: d.activities?.some((a) => a.type === "email") },
                  { label: "☀️ Summer Long Email", template: "summerLong", done: false },
                  { label: "☀️ Summer Short Email", template: "summerShort", done: false },
                  { label: "LinkedIn Connect + Note", template: "linkedin", done: false },
                ];
                return (
                  <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.color}`}>{p.label}</span>
                          <span className="font-semibold text-gray-900">{d.district}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{d.director} · {d.email} · {d.phone}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Current: <span className="text-indigo-600">{d.curriculum}</span> (adopted {d.curriculumAdoptionYear} — <span className="font-semibold text-red-500">{age} yrs old</span>)</div>
                      </div>
                      <span className={`text-xs ${statusColor(d.status)}`}>{d.status}</span>
                    </div>
                    {d.buyingSignals.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {d.buyingSignals.map((s, i) => (
                          <span key={i} className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-xs">⚡ {s}</span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                      {touches.map((t, i) => (
                        <div key={i} className={`rounded-lg border p-2 ${t.done ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                          <div className="text-xs font-medium text-gray-700 mb-1">Step {i + 1}</div>
                          <div className="text-xs text-gray-500 mb-2">{t.label}</div>
                          {t.template === "linkedin" ? (
                            <button
                              onClick={() => { setSelectedDistrict(d); setEmailPreview(generateEmail(d, "linkedin")); setShowEmailPreview(true); }}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                            >
                              Copy Message
                            </button>
                          ) : (
                            <button
                              onClick={() => queueEmail(d, t.template)}
                              className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                            >
                              Queue Email
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── EMAIL TEMPLATES TAB ── */}
        {activeTab === "templates" && (
          <div className="max-w-4xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Email Templates</h2>
              <p className="text-xs text-gray-500 mt-1">Preview and customize outreach templates. Select a district to auto-personalize.</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Select District</label>
                <select
                  onChange={(e) => setSelectedDistrict(districts.find((d) => d.id === parseInt(e.target.value)) || null)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="">— Choose a district —</option>
                  {districts.slice(0, 30).map((d) => <option key={d.id} value={d.id}>{d.county} — {d.director}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="original">📧 Original Email</option>
                  <option value="summerLong">☀️ Summer Long</option>
                  <option value="summerShort">☀️ Summer Short</option>
                  <option value="summerBridge">🌴 FL Summer Bridge (Long)</option>
                  <option value="summerBridgeShort">🌴 FL Summer Bridge (Short)</option>
                </select>
              </div>
            </div>
            {selectedDistrict && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-900">Preview — {selectedDistrict.director} at {selectedDistrict.county} County</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard?.writeText(generateEmail(selectedDistrict, selectedTemplate)); showNotif("Copied to clipboard ✓"); }}
                      className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >Copy</button>
                    <button
                      onClick={() => queueEmail(selectedDistrict, selectedTemplate)}
                      className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                    >Add to Send Queue →</button>
                  </div>
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 leading-relaxed font-sans">
                  {generateEmail(selectedDistrict, selectedTemplate)}
                </pre>
              </div>
            )}
            {!selectedDistrict && (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
                Select a district above to preview a personalized email template.
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY LOG TAB ── */}
        {activeTab === "activity" && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Activity Log</h2>
              <p className="text-xs text-gray-500 mt-1">Track all calls, emails, and LinkedIn touchpoints. Open a district to log an activity.</p>
            </div>
            {activityLog.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
                <p className="font-medium">No activities yet.</p>
                <p className="text-xs mt-1">Open a district from the Prospects tab and log a call, email, or note.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {activityLog.map((a) => (
                  <div key={a.id} className="border-b border-gray-100 last:border-b-0 px-4 py-3 flex gap-3 items-start">
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                      a.type === "email" ? "bg-blue-100 text-blue-600" :
                      a.type === "call" ? "bg-green-100 text-green-600" :
                      a.type === "linkedin" ? "bg-indigo-100 text-indigo-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {a.type === "email" ? "✉️" : a.type === "call" ? "📞" : a.type === "linkedin" ? "🔗" : "📝"}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-800">{a.district}</span>
                        <span className="text-xs text-gray-400">{a.date}</span>
                      </div>
                      <span className="text-xs text-gray-400 capitalize">{a.type} · {a.directorName}</span>
                      <p className="text-xs text-gray-600 mt-1">{a.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── APPROVAL QUEUE TAB ── */}
        {activeTab === "approval" && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Send Queue</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Send emails directly from Gmail — no copy-paste needed.
                  </p>
                </div>
                {/* Gmail connection badge */}
                {GOOGLE_CLIENT_ID && (
                  <button
                    onClick={() => !gmailConnected && connectGmail()}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border flex items-center gap-1.5 ${gmailConnected ? "bg-green-50 text-green-700 border-green-200 cursor-default" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 cursor-pointer"}`}
                  >
                    {gmailConnected ? "✅ Gmail connected" : "🔑 Connect Gmail"}
                  </button>
                )}
              </div>
              {/* Bulk action buttons */}
              {approvalQueue.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    onClick={sendAllEmails}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded-lg font-semibold"
                  >
                    📤 Send All ({approvalQueue.length})
                  </button>
                </div>
              )}
            </div>
            {approvalQueue.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
                <p className="font-medium">Queue is empty.</p>
                <p className="text-xs mt-1">Queue emails from the Prospects or Outreach Planner tabs, then send them here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {approvalQueue.map((item) => {
                  const templateLabel =
                    item.template === "original" ? "📧 Original Email" :
                    item.template === "summerBridge" ? "🌴 FL Summer Bridge (Long)" :
                    item.template === "summerBridgeShort" ? "🌴 FL Summer Bridge (Short)" :
                    item.template === "summerLong" ? "☀️ Summer Long" :
                    item.template === "summerShort" ? "☀️ Summer Short" :
                    item.template.replace(/(\d)/, " #$1");
                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-purple-50 border-b border-purple-100 px-4 py-3 flex justify-between items-start gap-2 flex-wrap">
                        <div>
                          <span className="font-semibold text-purple-800">{item.district}</span>
                          {item.isSummerBridgeContact && <span className="ml-2 text-xs bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">🌴 SB contact</span>}
                          <div className="text-xs text-purple-500 mt-0.5">
                            {templateLabel} · To: <span className="font-medium">{item.directorName}</span> &lt;{item.to}&gt;
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 flex-wrap">
                          <button
                            onClick={() => sendEmail(item)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
                          >
                            📤 Send
                          </button>
                          <button
                            onClick={() => rejectEmail(item.id)}
                            className="bg-red-50 text-red-500 border border-red-200 text-xs px-3 py-1.5 rounded-lg hover:bg-red-100"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap p-4 leading-relaxed font-sans bg-white max-h-52 overflow-y-auto">
                        {item.body}
                      </pre>
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                        Queued: {item.createdAt}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DISTRICT DETAIL MODAL ── */}
      {selectedDistrict && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedDistrict(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityLabel(selectedDistrict.priority).color}`}>
                    {getPriorityLabel(selectedDistrict.priority).label} · {selectedDistrict.priority}/100
                  </span>
                  {selectedDistrict.newLeadership && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">🆕 New Leadership</span>}
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-1">{selectedDistrict.district}</h2>
                {selectedDistrict.lastUpdated && (
                  <span className="inline-block mt-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                    🔄 Auto-updated {selectedDistrict.lastUpdated}
                  </span>
                )}
                <p className="text-sm text-gray-500">{selectedDistrict.address}</p>
              </div>
              <button onClick={() => setSelectedDistrict(null)} className="text-gray-400 hover:text-gray-700 text-xl font-light mt-1">✕</button>
            </div>

            {/* Modal Tabs */}
            <div className="border-b border-gray-200 px-6 flex gap-1">
              {["overview", "buying signals", "board notes", "district intel", "outreach", "log activity"].map((t) => (
                <button
                  key={t}
                  onClick={() => setModalTab(t)}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 capitalize transition-colors ${modalTab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-700"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="p-6">
              {modalTab === "overview" && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Director Contact</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedDistrict.director}</span></div>
                      <div><span className="text-gray-500">Title:</span> {selectedDistrict.title}</div>
                      <div><span className="text-gray-500">Email:</span> <a href={`mailto:${selectedDistrict.email}`} className="text-indigo-600 hover:underline">{selectedDistrict.email}</a></div>
                      <div><span className="text-gray-500">Phone:</span> {selectedDistrict.phone}</div>
                      <div><span className="text-gray-500">LinkedIn:</span> {selectedDistrict.linkedin ? <a href={`https://${selectedDistrict.linkedin}`} target="_blank" className="text-blue-500 hover:underline">View Profile</a> : <span className="text-gray-300">Not found</span>}</div>
                    </div>
                    {selectedDistrict.summerBridgeContact && (
                      <div className="mt-4 pt-3 border-t border-dashed border-green-200">
                        <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">🌴 Summer Bridge Contact</h4>
                        <div className="space-y-1.5 text-sm">
                          <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedDistrict.summerBridgeContact.fullName}</span></div>
                          {selectedDistrict.summerBridgeContact.title && <div><span className="text-gray-500">Title:</span> {selectedDistrict.summerBridgeContact.title}</div>}
                          <div><span className="text-gray-500">Email:</span> <a href={`mailto:${selectedDistrict.summerBridgeContact.email}`} className="text-green-600 hover:underline">{selectedDistrict.summerBridgeContact.email}</a></div>
                        </div>
                        <p className="text-xs text-green-600 mt-2 italic">FL Summer Bridge emails go to this contact. All other emails go to the director above.</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Curriculum Profile</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-500">Current:</span> <span className="font-medium text-indigo-700">{selectedDistrict.curriculum}</span></div>
                      <div><span className="text-gray-500">Vendor:</span> {selectedDistrict.curriculumVendor}</div>
                      <div><span className="text-gray-500">Adopted:</span> {selectedDistrict.curriculumAdoptionYear} <span className="text-red-500 font-medium">({2026 - selectedDistrict.curriculumAdoptionYear} years ago)</span></div>
                      <div><span className="text-gray-500">Enrollment:</span> {selectedDistrict.enrollment.toLocaleString()}</div>
                      <div><span className="text-gray-500">Status:</span>
                        <select
                          value={selectedDistrict.status}
                          onChange={(e) => updateDistrict(selectedDistrict.id, { status: e.target.value })}
                          className={`ml-2 text-xs border border-gray-200 rounded px-2 py-0.5 ${statusColor(selectedDistrict.status)}`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {selectedDistrict.recentNews.length > 0 && (
                    <div className="col-span-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent News</h3>
                      {selectedDistrict.recentNews.map((n, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-700 mb-1">
                          <span className="text-indigo-400 mt-0.5">📰</span>{n}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="col-span-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</h3>
                    <textarea
                      value={selectedDistrict.notes}
                      onChange={(e) => updateDistrict(selectedDistrict.id, { notes: e.target.value })}
                      placeholder="Add notes about this district..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 h-24 resize-none"
                    />
                  </div>
                  {selectedDistrict.activities?.length > 0 && (
                    <div className="col-span-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact History</h3>
                      {selectedDistrict.activities.map((a) => (
                        <div key={a.id} className="flex gap-2 items-start text-xs text-gray-600 border-l-2 border-indigo-200 pl-3 mb-2">
                          <span className="font-medium capitalize text-indigo-600">{a.type}</span>
                          <span className="text-gray-400">{a.date}</span>
                          <span>— {a.notes}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {modalTab === "buying signals" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Why Now — Buying Signals</h3>
                  {selectedDistrict.buyingSignals.length === 0 ? (
                    <p className="text-gray-400 text-sm">No specific buying signals identified yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDistrict.buyingSignals.map((s, i) => (
                        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                          <span className="text-amber-500 text-lg mt-0.5">⚡</span>
                          <div>
                            <p className="text-sm font-medium text-amber-800">{s}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Brightwheel Displacement Angle</h4>
                    <p className="text-sm text-indigo-700">
                      {selectedDistrict.curriculumAdoptionYear <= 2019
                        ? `${selectedDistrict.district} has been on ${selectedDistrict.curriculum} for ${2026 - selectedDistrict.curriculumAdoptionYear} years. This is prime displacement territory — pitch the full-platform angle: lesson plans + family engagement + billing + assessment, all in one app at a lower total cost.`
                        : `Position brightwheel as the modern alternative that grows with them. Emphasize the digital family engagement integration and the Florida VPK compliance alignment out of the box.`}
                    </p>
                  </div>
                </div>
              )}


              {modalTab === "board notes" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Board Meeting Notes</h3>
                  <p className="text-xs text-gray-400 mb-4">Auto-populated weekly from public board meeting records and local news. Additive only — no entries are ever removed.</p>
                  {(!selectedDistrict.boardNotes || selectedDistrict.boardNotes.length === 0) ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                      <p className="font-medium text-sm">No board notes yet.</p>
                      <p className="text-xs mt-1">The weekly GitHub Action will populate this when relevant board meetings are found.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...(selectedDistrict.boardNotes || [])].sort((a,b) => b.date.localeCompare(a.date)).map((note, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">{note.date}</span>
                            {note.source && <a href={note.source} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">Source ↗</a>}
                          </div>
                          <p className="text-sm text-gray-700">{note.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {modalTab === "district intel" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">District Intelligence</h3>
                  <p className="text-xs text-gray-400 mb-4">Auto-populated weekly from district websites, strategic plans, and funding sources. Used to personalize outreach emails.</p>
                  {(!selectedDistrict.districtContext || selectedDistrict.districtContext.length === 0) ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                      <p className="font-medium text-sm">No context captured yet.</p>
                      <p className="text-xs mt-1">The weekly GitHub Action will populate this from district websites, strategic plans, and funding news.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...(selectedDistrict.districtContext || [])].sort((a,b) => b.date.localeCompare(a.date)).map((ctx, i) => {
                        const typeColor = {
                          strategic: "bg-purple-50 border-purple-200 text-purple-700",
                          funding:   "bg-green-50 border-green-200 text-green-700",
                          website:   "bg-blue-50 border-blue-200 text-blue-700",
                        }[ctx.type] || "bg-gray-50 border-gray-200 text-gray-600";
                        const typeLabel = {
                          strategic: "📋 Strategic Plan",
                          funding:   "💰 Funding",
                          website:   "🌐 District Website",
                        }[ctx.type] || ctx.type;
                        return (
                          <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>{typeLabel}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{ctx.date}</span>
                                {ctx.source && <a href={ctx.source} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">Source ↗</a>}
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{ctx.summary}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selectedDistrict.districtContext && selectedDistrict.districtContext.length > 0 && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">📧 Email personalization preview</p>
                      <p className="text-xs text-indigo-600 leading-relaxed italic">
                        "{buildContextPersonalization(selectedDistrict).hook}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {modalTab === "outreach" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Outreach Actions</h3>

                  {/* Standard sequence — all states */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: "📧 Original Email", key: "original", desc: "General outreach — Kindergarten readiness, summer programs, learn more link." },
                      { label: "☀️ Summer Long", key: "summerLong", desc: "Full pitch — state-tailored, kit details, pricing, 3 bullets, learn more link." },
                      { label: "☀️ Summer Short", key: "summerShort", desc: "Quick intro — 4 bullets, pricing, casual CTA." },
                    ].map((t) => (
                      <div key={t.key} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-700 mb-1">{t.label}</p>
                        <p className="text-xs text-gray-400 mb-2">{t.desc}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEmailPreview(generateEmail(selectedDistrict, t.key)); setShowEmailPreview(true); }}
                            className="text-xs border border-gray-200 bg-white px-2 py-1 rounded hover:bg-gray-50"
                          >Preview</button>
                          <button
                            onClick={() => { queueEmail(selectedDistrict, t.key); }}
                            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                          >Queue →</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* FL Summer Bridge — Florida districts only */}
                  {(selectedDistrict.state || "FL") === "FL" && (
                    <div className="border-t border-dashed border-gray-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">🌴 FL Summer Bridge</span>
                          <span className="text-xs text-gray-400">Florida districts only</span>
                        </div>
                        <button
                          onClick={() => setShowSummerBridge((v) => !v)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showSummerBridge ? "bg-green-500" : "bg-gray-200"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showSummerBridge ? "translate-x-4" : "translate-x-1"}`} />
                        </button>
                      </div>

                      {showSummerBridge && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-col gap-3">
                          {/* Recipient */}
                          <div className="bg-white border border-green-200 rounded p-2 text-xs text-green-800">
                            <span className="font-semibold">Sending to: </span>
                            {selectedDistrict.summerBridgeContact
                              ? <><span className="font-medium">{selectedDistrict.summerBridgeContact.fullName}</span> &lt;{selectedDistrict.summerBridgeContact.email}&gt; <span className="text-green-500">(Summer Bridge contact)</span></>
                              : <><span className="font-medium">{selectedDistrict.director}</span> &lt;{selectedDistrict.email}&gt;</>}
                          </div>
                          {/* Long version */}
                          <div className="bg-white border border-green-200 rounded p-2">
                            <p className="text-xs font-semibold text-green-800 mb-1">🌴 FL Summer Bridge (Long)</p>
                            <p className="text-xs text-green-600 mb-2">FL-specific — kit details, pricing, 3 bullets, learn more link.</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setEmailPreview(generateEmail(selectedDistrict, "summerBridge")); setShowEmailPreview(true); }}
                                className="text-xs border border-green-300 bg-white text-green-700 px-2 py-1 rounded hover:bg-green-50"
                              >Preview</button>
                              <button
                                onClick={() => { queueEmail(selectedDistrict, "summerBridge"); }}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              >Queue →</button>
                            </div>
                          </div>
                          {/* Short version */}
                          <div className="bg-white border border-green-200 rounded p-2">
                            <p className="text-xs font-semibold text-green-800 mb-1">🌴 FL Summer Bridge (Short)</p>
                            <p className="text-xs text-green-600 mb-2">Quick intro — 4 bullets, pricing, casual CTA.</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setEmailPreview(generateEmail(selectedDistrict, "summerBridgeShort")); setShowEmailPreview(true); }}
                                className="text-xs border border-green-300 bg-white text-green-700 px-2 py-1 rounded hover:bg-green-50"
                              >Preview</button>
                              <button
                                onClick={() => { queueEmail(selectedDistrict, "summerBridgeShort"); }}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              >Queue →</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {modalTab === "log activity" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Log New Activity</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Activity Type</label>
                      <select
                        value={newActivity.type}
                        onChange={(e) => setNewActivity((p) => ({ ...p, type: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                      >
                        <option value="email">✉️ Email Sent</option>
                        <option value="call">📞 Phone Call</option>
                        <option value="linkedin">🔗 LinkedIn</option>
                        <option value="meeting">📅 Meeting</option>
                        <option value="note">📝 Note</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
                      <input
                        type="date"
                        value={newActivity.date}
                        onChange={(e) => setNewActivity((p) => ({ ...p, date: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                      />
                    </div>
                  </div>
                  <textarea
                    value={newActivity.notes}
                    onChange={(e) => setNewActivity((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Notes about this contact (outcome, next steps, etc.)..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-3"
                  />
                  <button
                    onClick={() => addActivity(selectedDistrict)}
                    disabled={!newActivity.notes}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Log Activity
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowEmailPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Email Preview</h3>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard?.writeText(emailPreview); showNotif("Copied!"); }} className="text-xs border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50">Copy</button>
                <button onClick={() => setShowEmailPreview(false)} className="text-gray-400 hover:text-gray-700 text-xl font-light">✕</button>
              </div>
            </div>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap p-6 font-sans leading-relaxed">{emailPreview}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
