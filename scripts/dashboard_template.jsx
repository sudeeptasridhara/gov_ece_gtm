// ─── INTEGRATION CONFIG ───────────────────────────────────────────────────────
// Fill these in once in GitHub → scripts/dashboard_template.jsx, then run the
// GitHub Action to rebuild. See setup instructions in the README.
const GOOGLE_CLIENT_ID = "642445271504-vr3au2pic0ma5aekadpq4icrv9t9eekj.apps.googleusercontent.com";
const SLACK_WEBHOOK_URL = ""; // e.g. "https://hooks.slack.com/services/T.../B.../xxx"

// ─── EMAIL HELPERS ────────────────────────────────────────────────────────────
// Unsubscribe landing page + Google Form logger
const UNSUB_PAGE = "https://bw-gov.github.io/gov_ece_gtm/unsubscribe.html";
// Learn-more redirect — routes through GitHub Pages so Gmail doesn't show a Drive attachment preview
const LEARN_MORE_URL = "https://bw-gov.github.io/gov_ece_gtm/learn-more.html";
// brightwheel logo shown in email signature — upload bw-logo.png to assets/ folder in the repo
const BW_LOGO_URL = "https://bw-gov.github.io/gov_ece_gtm/assets/bw-logo.png";

// ─── REP PROFILES ─────────────────────────────────────────────────────────────
// Add reps here; key = their brightwheel email address
const REP_PROFILES = {
  "christie.cooley@mybrightwheel.com": {
    name: "Christie Cooley",
    title: "Head of District Partnerships",
    email: "christie.cooley@mybrightwheel.com",
    phone: "678-464-1018",
    calendly: "https://mybrightwheel.chilipiper.com/me/christie-cooley/meeting-with-christie-cooley",
    color: "bg-purple-100 text-purple-700",
    initials: "CC",
  },
  "eric.truog@mybrightwheel.com": {
    name: "Eric Truog",
    title: "Director of Business Operations",
    email: "eric.truog@mybrightwheel.com",
    phone: "",
    calendly: "", // add link when available
    color: "bg-blue-100 text-blue-700",
    initials: "ET",
  },
  "kevin.elston@mybrightwheel.com": {
    name: "Kevin Elston",
    title: "District Partnerships",
    email: "kevin.elston@mybrightwheel.com",
    phone: "",
    calendly: "", // add link when available
    color: "bg-green-100 text-green-700",
    initials: "KE",
  },
  "eric.bernstein@mybrightwheel.com": {
    name: "Eric Bernstein",
    title: "District Partnerships",
    email: "eric.bernstein@mybrightwheel.com",
    phone: "",
    calendly: "", // add link when available
    color: "bg-orange-100 text-orange-700",
    initials: "EB",
  },
};
const DEFAULT_REP = REP_PROFILES["christie.cooley@mybrightwheel.com"];
// Map each state to its assigned rep email
const STATE_REP_EMAIL = {
  // Christie Cooley
  FL: "christie.cooley@mybrightwheel.com",
  AL: "christie.cooley@mybrightwheel.com",
  GA: "christie.cooley@mybrightwheel.com",
  MI: "christie.cooley@mybrightwheel.com",
  // Eric Truog
  ID: "eric.truog@mybrightwheel.com",
  // Kevin Elston
  NV: "kevin.elston@mybrightwheel.com",
  NM: "kevin.elston@mybrightwheel.com",
  // Eric Bernstein
  CA: "eric.bernstein@mybrightwheel.com",
  OR: "eric.bernstein@mybrightwheel.com",
  WA: "eric.bernstein@mybrightwheel.com",
};

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

function emailSignature(rep) {
  if (!rep) {
    // No one logged in — generic brightwheel signature
    return `<div style="${S.sig}"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;padding-right:12px;"><img src="${BW_LOGO_URL}" alt="brightwheel" width="36" height="36" style="display:block;border-radius:6px;" /></td><td style="vertical-align:middle;font-size:13px;color:#555555;">Best,<br><strong style="color:#222;">brightwheel</strong><br>District Partnerships Team<br>${ea("mailto:partnerships@mybrightwheel.com","partnerships@mybrightwheel.com")}</td></tr></table></div>`;
  }
  const phoneStr = rep.phone ? ` | ${rep.phone}` : "";
  return `<div style="${S.sig}"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;padding-right:12px;"><img src="${BW_LOGO_URL}" alt="brightwheel" width="36" height="36" style="display:block;border-radius:6px;" /></td><td style="vertical-align:middle;font-size:13px;color:#555555;">Best,<br><strong style="color:#222;">${rep.name}</strong><br>${rep.title} | brightwheel<br>${ea("mailto:"+rep.email,rep.email)}${phoneStr}</td></tr></table></div>`;
}

function buildUnsubUrl(name, email, district) {
  return `${UNSUB_PAGE}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&district=${encodeURIComponent(district)}`;
}

function buildHtmlEmail(subject, bodyHtml, unsubUrl, rep) {
  const unsubFooter = unsubUrl
    ? `<div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#b0b7c3;text-align:center;">Don't want to receive these emails?&nbsp;<a href="${unsubUrl}" style="color:#b0b7c3;text-decoration:underline;">Unsubscribe</a></div>`
    : "";
  const html = `<!DOCTYPE html><html><body style="${S.wrap}">${bodyHtml}${emailSignature(rep)}${unsubFooter}</body></html>`;
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

function generateEmail(district, template, rep) {
  // Use the explicitly passed rep (may be null = not logged in → generic signature)
  const r = rep !== undefined ? rep : null;
  const contact = resolveContact(district, template);

  const stateCode = district.state || "FL";
  const STATE_NAMES = { FL: "Florida", AL: "Alabama", ID: "Idaho", NV: "Nevada", CA: "California", OR: "Oregon", NM: "New Mexico" };
  const stateName = STATE_NAMES[stateCode] || stateCode;

  const isSummerBridgeTemplate = template === "summerBridge" || template === "summerBridgeShort";
  let greetingName;
  if (isSummerBridgeTemplate && district.summerBridgeContact) {
    greetingName = district.summerBridgeContact.firstName;
  } else {
    greetingName = district.director.split(" ")[0];
  }
  const helloGreeting = ep(`Hello ${greetingName},`);
  const hiGreeting    = ep(`Hi ${greetingName},`);

  const calendlyLink = r && r.calendly
    ? ep(ea(r.calendly, "Schedule time with me →"))
    : ep(`Happy to find a time — just reply and we can schedule a quick connect.`);

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
      ep(`${ea(LEARN_MORE_URL, "Click here to learn more")} if your program is planning summer readiness or transition programming.`) +
      ep(`I'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.`) +
      calendlyLink,
      unsubUrl,
      r,
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
      ep(`${ea(LEARN_MORE_URL, "Click here to learn more")} if your program is planning summer readiness or transition programming for VPK students.`) +
      ep(`I'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.`) +
      calendlyLink,
      unsubUrl,
      r,
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
      r,
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
      ep(`${ea(LEARN_MORE_URL, "Click here to learn more")} if your program is planning summer readiness or transition programming for VPK students.`) +
      ep(`I'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.`) +
      calendlyLink,
      unsubUrl,
      r,
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
      r,
    ),
  };

  return templates[template] || "";
}

// ─── PERSONALIZED EMAIL GENERATION ───────────────────────────────────────────

// Returns true if the district has enough intel to generate a personalized draft
function hasPersonalizedEmail(district) {
  return (
    (Array.isArray(district.districtContext) && district.districtContext.length > 0) ||
    (Array.isArray(district.boardNotes) && district.boardNotes.length > 0) ||
    (Array.isArray(district.buyingSignals) && district.buyingSignals.length > 0)
  );
}

// Builds a personalized outreach email from the district's most recent intel
function generatePersonalizedEmail(district, rep) {
  const r = rep !== undefined ? rep : null;
  if (!district.email) return "";

  const greetingName = district.director.split(" ")[0];
  const hiGreeting = ep(`Hi ${greetingName},`);
  const calendlyLink = r && r.calendly
    ? ep(ea(r.calendly, "Schedule time with me →"))
    : ep(`Happy to find a time — just reply and I'll send over a few options.`);
  const unsubUrl = buildUnsubUrl(district.director, district.email, district.district);

  // Gather all intel (context + board notes) sorted newest first
  const allIntel = [
    ...(district.districtContext || []).map(c => ({ ...c, _kind: "context" })),
    ...(district.boardNotes || []).map(n => ({ ...n, _kind: "board" })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const signals = district.buyingSignals || [];
  const topIntel = allIntel[0];
  const shortName = district.district.includes(" — ")
    ? district.district.split(" — ").slice(1).join(" — ")
    : district.district;

  let subject, openingPara, bridgePara;

  if (topIntel && topIntel._kind === "board") {
    const snippet = topIntel.summary.length > 150
      ? topIntel.summary.slice(0, 150) + "…"
      : topIntel.summary;
    subject = `Reaching out — ${shortName} early childhood programs`;
    openingPara = ep(`I came across a recent update from ${shortName}'s board meeting (${topIntel.date}): <em style="color:#555;">"${snippet}"</em> — and wanted to connect around what support might be available for your early childhood programs.`);
    bridgePara = ep(`brightwheel's Experience Preschool is a flexible, play-based curriculum built for PreK-to-Kindergarten transitions. Lessons are pre-packaged and organized by the day, so teachers can run effective programs with minimal prep.`);
  } else if (topIntel && topIntel._kind === "context") {
    const typeLabel = topIntel.type === "strategic"
      ? "strategic plan"
      : topIntel.type === "funding"
      ? "recent funding update"
      : "early childhood programs";
    const subjectSuffix = topIntel.type === "strategic"
      ? "early childhood alignment"
      : topIntel.type === "funding"
      ? "making the most of new funding"
      : "PreK readiness support";
    const snippet = topIntel.summary.length > 150
      ? topIntel.summary.slice(0, 150) + "…"
      : topIntel.summary;
    subject = `${shortName} + brightwheel — ${subjectSuffix}`;
    openingPara = ep(`I came across ${shortName}'s ${typeLabel} and noted: <em style="color:#555;">"${snippet}"</em> — it sounds like early childhood outcomes are a genuine focus right now.`);
    bridgePara = ep(`brightwheel's Experience Preschool is a flexible, play-based curriculum built for PreK-to-Kindergarten transitions. Because lessons are pre-packaged and organized by the day, it's easy for teachers to implement and helps districts hit readiness targets without a heavy lift.`);
  } else if (signals.length > 0) {
    subject = `Reaching out: ${shortName} PreK readiness`;
    openingPara = ep(`I noticed a timely signal for ${shortName} — ${signals[0]} — and wanted to follow up about what support might be available for your early childhood programs.`);
    bridgePara = ep(`brightwheel's Experience Preschool is a flexible, play-based curriculum built for PreK-to-Kindergarten transitions, with lessons pre-packaged and organized by the day.`);
  } else {
    return "";
  }

  return buildHtmlEmail(
    subject,
    hiGreeting +
    openingPara +
    bridgePara +
    ep(`I'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.`) +
    calendlyLink,
    unsubUrl,
    r,
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function BrightwheelDashboard() {
  const [districts, setDistricts] = useState(() =>
    INITIAL_DISTRICTS.map((d) => ({ ...d, priority: calculatePriorityScore(d) })).sort(
      (a, b) => b.priority - a.priority
    )
  );

  const [activeTab, setActiveTab] = useState("overview");
  const [overviewFilterState, setOverviewFilterState] = useState("all");
  const [overviewFilterRep, setOverviewFilterRep] = useState("all");
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCurriculum, setFilterCurriculum] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("priority"); // priority | enrollment | tier | adoptionYear | lastUpdated
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

  // ── DISTRICT INFO TAB ──
  const [diInfoState, setDiInfoState] = useState("all");
  const [diInfoSearch, setDiInfoSearch] = useState("");
  const [diInfoSelectedId, setDiInfoSelectedId] = useState(null);
  const [diInfoEmailTemplate, setDiInfoEmailTemplate] = useState("original");
  const [diInfoShowResults, setDiInfoShowResults] = useState(false);

  // ── CONTACT TRACKING ──
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilterState, setContactFilterState] = useState("all");
  const [contactFilterRep, setContactFilterRep] = useState("all");
  const [expandedContactId, setExpandedContactId] = useState(null);
  const [inlineActivity, setInlineActivity] = useState({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });

  // ── GMAIL SYNC ──
  const [syncedMsgIds, setSyncedMsgIds] = useState(new Set()); // dedup Gmail message IDs
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // ── GMAIL OAUTH ──
  const [gmailToken, setGmailToken] = useState(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailUser, setGmailUser] = useState(null); // logged-in email, used to pick rep profile
  const [gisReady, setGisReady] = useState(false);
  const pendingDraftRef = useRef(null);

  // Rep profile for the currently logged-in user — null if not signed in or unrecognized
  const currentRep = (gmailUser && REP_PROFILES[gmailUser]) || null;

  const [emailPickerId, setEmailPickerId] = useState(null); // must be declared before the useEffect below

  // ── LOAD PERSISTED ACTIVITY LOG ON STARTUP ──────────────────────────────────
  // The daily scheduled task writes data/activity_log.json. Fetch it here so
  // activities survive page refreshes and are pre-populated without a manual sync.
  useEffect(() => {
    fetch("https://bw-gov.github.io/gov_ece_gtm/data/activity_log.json?_=" + Date.now())
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null)
      .then((log) => {
        if (!log || !Array.isArray(log.activities) || log.activities.length === 0) return;
        // Pre-populate synced IDs so browser sync doesn't re-log these
        setSyncedMsgIds(new Set(log.activities.map((a) => a.gmailMsgId).filter(Boolean)));
        setLastSyncTime(log.lastSynced ? new Date(log.lastSynced).toLocaleTimeString() : null);
        // Merge activities into district state
        setDistricts((prev) => {
          const updated = [...prev];
          log.activities.forEach((activity) => {
            const idx = updated.findIndex((d) => d.id === activity.districtId);
            if (idx === -1) return;
            const d = updated[idx];
            if ((d.activities || []).some((a) => a.gmailMsgId && a.gmailMsgId === activity.gmailMsgId)) return;
            const newStatus = activity.source === "gmail_reply"
              ? (d.status === "reached out" || d.status === "not contacted" ? "responded" : d.status)
              : (d.status === "not contacted" ? "reached out" : d.status);
            updated[idx] = { ...d, activities: [...(d.activities || []), activity], status: newStatus };
          });
          return updated;
        });
        setActivityLog((prev) => [...log.activities, ...prev]);
      });
  }, []); // runs once on mount

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
          // Identify the logged-in user to select the right rep signature
          fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
            headers: { Authorization: "Bearer " + resp.access_token },
          }).then((r) => r.json()).then((profile) => {
            if (profile.emailAddress) setGmailUser(profile.emailAddress);
          }).catch(() => {});
          // Auto-sync Gmail activity on connect
          setTimeout(() => syncGmailActivity(resp.access_token), 800);
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
        // Auto-log the send as an activity on the district
        const sentActivity = {
          id: Date.now(),
          type: "email",
          date: new Date().toISOString().split("T")[0],
          notes: `Sent "${item.template}" email via dashboard to ${item.to}`,
          district: item.district,
          directorName: item.directorName,
          source: "dashboard",
        };
        setDistricts((prev) => prev.map((d) => {
          if (d.id !== item.districtId) return d;
          const already = (d.activities || []).some((a) => a.source === "dashboard" && a.notes === sentActivity.notes && a.date === sentActivity.date);
          if (already) return d;
          return { ...d, activities: [...(d.activities || []), sentActivity], status: d.status === "not contacted" ? "reached out" : d.status };
        }));
        setActivityLog((prev) => [sentActivity, ...prev]);
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

  const draftEmail = async (item, token) => {
    const useToken = token || gmailToken;
    if (!useToken) { connectGmail((t) => draftEmail(item, t)); return; }
    const { subject, body } = parseEmailParts(item.body);
    const raw = buildRawEmail(item.to, subject, body);
    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
        method: "POST",
        headers: { Authorization: "Bearer " + useToken, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { raw } }),
      });
      if (res.ok) {
        rejectEmail(item.id);
        showNotif("📋 Draft saved — " + item.directorName);
      } else if (res.status === 401) {
        setGmailToken(null); setGmailConnected(false);
        showNotif("Gmail session expired — reconnecting...", "red");
        connectGmail((t) => draftEmail(item, t));
      } else {
        showNotif("Gmail draft error " + res.status, "red");
      }
    } catch (e) {
      showNotif("Draft failed: " + e.message, "red");
    }
  };

  const sendAllEmails = async () => {
    if (!gmailToken && GOOGLE_CLIENT_ID) { connectGmail((t) => { /* sends will fire from pending */ }); }
    for (const item of [...approvalQueue]) {
      await sendEmail(item, gmailToken);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  // ── GMAIL ACTIVITY SYNC ───────────────────────────────────────────────────
  // Searches Gmail Sent (for emails sent outside the dashboard) and Inbox
  // (for replies from district contacts). Logs new findings as activities.
  const syncGmailActivity = async (token) => {
    const useToken = token || gmailToken;
    if (!useToken) { connectGmail((t) => syncGmailActivity(t)); return; }
    setGmailSyncing(true);

    // Build a fast lookup: email address → district
    const emailToDistrict = {};
    districts.forEach((d) => {
      if (d.email) emailToDistrict[d.email.toLowerCase().trim()] = d;
      if (d.summerBridgeContact?.email) emailToDistrict[d.summerBridgeContact.email.toLowerCase().trim()] = d;
    });

    // Gmail API helper
    const gmailGet = async (path) => {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        headers: { Authorization: "Bearer " + useToken },
      });
      if (!res.ok) throw new Error(`Gmail API ${res.status}`);
      return res.json();
    };

    // Search Gmail and return message stubs
    const searchMessages = async (query, maxResults = 100) => {
      try {
        const data = await gmailGet(`messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
        return data.messages || [];
      } catch { return []; }
    };

    // Fetch minimal metadata for a message (To, From, Subject, Date headers only)
    const getMeta = async (id) => {
      try {
        const data = await gmailGet(`messages/${id}?format=metadata&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
        const h = {};
        (data.payload?.headers || []).forEach(({ name, value }) => { h[name.toLowerCase()] = value; });
        return { id: data.id, threadId: data.threadId, headers: h };
      } catch { return null; }
    };

    // Look back 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const afterStr = `${cutoff.getFullYear()}/${String(cutoff.getMonth()+1).padStart(2,"0")}/${String(cutoff.getDate()).padStart(2,"0")}`;

    let newActivities = [];
    const newSyncedIds = new Set(syncedMsgIds);

    try {
      // ── PASS 1: Sent emails (catches sends outside the dashboard) ──────────
      const sentMsgs = await searchMessages(`in:sent after:${afterStr}`, 200);
      for (const stub of sentMsgs) {
        if (newSyncedIds.has(stub.id)) continue;
        const msg = await getMeta(stub.id);
        if (!msg) continue;
        const toHeader = (msg.headers.to || "").toLowerCase();
        // Check if To: contains any district email
        const matchedDistrict = Object.entries(emailToDistrict).find(([email]) => toHeader.includes(email));
        if (!matchedDistrict) { newSyncedIds.add(stub.id); continue; }
        const [recipEmail, district] = matchedDistrict;
        // Check if already logged for this district+day+type
        const dateStr = msg.headers.date ? new Date(msg.headers.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
        const subject = msg.headers.subject || "(no subject)";
        const activity = {
          id: stub.id, // use Gmail message ID so it's always unique
          type: "email",
          date: dateStr,
          notes: `Sent "${subject}" to ${recipEmail} (Gmail)`,
          district: district.district,
          directorName: district.director,
          source: "gmail_sent",
          gmailMsgId: stub.id,
        };
        newActivities.push({ districtId: district.id, activity });
        newSyncedIds.add(stub.id);
        await new Promise(r => setTimeout(r, 50)); // gentle rate limit
      }

      // ── PASS 2: Inbox replies from district contacts ─────────────────────
      // Build search: from any district email
      const allEmails = Object.keys(emailToDistrict);
      // Chunk into groups of 30 to keep query length manageable
      const chunks = [];
      for (let i = 0; i < allEmails.length; i += 30) chunks.push(allEmails.slice(i, i + 30));

      for (const chunk of chunks) {
        const fromQuery = `in:inbox after:${afterStr} from:(${chunk.join(" OR ")})`;
        const replyMsgs = await searchMessages(fromQuery, 50);
        for (const stub of replyMsgs) {
          if (newSyncedIds.has(stub.id)) continue;
          const msg = await getMeta(stub.id);
          if (!msg) continue;
          const fromHeader = (msg.headers.from || "").toLowerCase();
          const matchedDistrict = Object.entries(emailToDistrict).find(([email]) => fromHeader.includes(email));
          if (!matchedDistrict) { newSyncedIds.add(stub.id); continue; }
          const [replyEmail, district] = matchedDistrict;
          const dateStr = msg.headers.date ? new Date(msg.headers.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
          const subject = msg.headers.subject || "(no subject)";
          const activity = {
            id: stub.id,
            type: "note",
            date: dateStr,
            notes: `↩️ Reply received: "${subject}" from ${replyEmail}`,
            district: district.district,
            directorName: district.director,
            source: "gmail_reply",
            gmailMsgId: stub.id,
          };
          newActivities.push({ districtId: district.id, activity, isReply: true });
          newSyncedIds.add(stub.id);
          await new Promise(r => setTimeout(r, 50));
        }
      }
    } catch (e) {
      showNotif("Sync error: " + e.message, "red");
      setGmailSyncing(false);
      return;
    }

    // Apply all new activities to district state
    if (newActivities.length > 0) {
      setDistricts((prev) => {
        const updated = [...prev];
        newActivities.forEach(({ districtId, activity, isReply }) => {
          const idx = updated.findIndex(d => d.id === districtId);
          if (idx === -1) return;
          const d = updated[idx];
          // Skip if this gmailMsgId already logged
          if ((d.activities || []).some(a => a.gmailMsgId === activity.gmailMsgId)) return;
          const newStatus = isReply
            ? (d.status === "reached out" || d.status === "not contacted" ? "responded" : d.status)
            : (d.status === "not contacted" ? "reached out" : d.status);
          updated[idx] = { ...d, activities: [...(d.activities || []), activity], status: newStatus };
        });
        return updated;
      });
      setActivityLog((prev) => [...newActivities.map(x => x.activity), ...prev]);
    }

    setSyncedMsgIds(newSyncedIds);
    setLastSyncTime(new Date().toLocaleTimeString());
    setGmailSyncing(false);
    const sentCount = newActivities.filter(a => a.activity.source === "gmail_sent").length;
    const replyCount = newActivities.filter(a => a.activity.source === "gmail_reply").length;
    showNotif(newActivities.length === 0
      ? "Gmail sync complete — no new activity found"
      : `Gmail sync: ${sentCount} sent email${sentCount !== 1 ? "s" : ""} + ${replyCount} repl${replyCount !== 1 ? "ies" : "y"} logged ✓`
    );
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

  // ── FILTERED + SORTED DISTRICTS ──
  const filtered = useMemo(() => {
    const results = districts.filter((d) => {
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
    return results.sort((a, b) => {
      if (sortBy === "enrollment") return (b.enrollment || 0) - (a.enrollment || 0);
      if (sortBy === "tier") {
        const tierNum = (t) => t === "Tier 1" ? 1 : t === "Tier 2" ? 2 : 3;
        return tierNum(a.priorityTier) - tierNum(b.priorityTier);
      }
      if (sortBy === "adoptionYear") return (a.curriculumAdoptionYear || 9999) - (b.curriculumAdoptionYear || 9999);
      if (sortBy === "lastUpdated") return (b.lastUpdated || "").localeCompare(a.lastUpdated || "");
      if (sortBy === "status") return a.status.localeCompare(b.status);
      // default: priority score descending
      return (b.priority || 0) - (a.priority || 0);
    });
  }, [districts, search, filterState, filterPriority, filterCurriculum, filterStatus, sortBy]);

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
    const contact = resolveContact(district, template);
    if (!contact.email) {
      showNotif(`⚠️ No email on file for ${district.director || district.district} — skipped`, "red");
      return;
    }
    const body = template === "personalized"
      ? generatePersonalizedEmail(district, currentRep)
      : generateEmail(district, template, currentRep);
    if (!body) {
      showNotif(`⚠️ Not enough intel to personalize email for ${district.district}`, "red");
      return;
    }
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
        <div className="flex items-center gap-6">
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
          {/* Logged-in rep indicator / sign-in button */}
          {currentRep ? (
            <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${currentRep.color}`}>
                {currentRep.initials}
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700">{currentRep.name}</div>
                <div className="text-xs text-gray-400">{currentRep.title}</div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => connectGmail()}
              className="flex items-center gap-2 pl-4 border-l border-gray-200 hover:opacity-80 transition-opacity cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 group-hover:border-indigo-400 flex items-center justify-center text-xs font-bold text-gray-400 group-hover:text-indigo-500 transition-colors">
                G
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-indigo-600">Sign in with Gmail</div>
                <div className="text-xs text-gray-400">to personalize emails &amp; send</div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
        {[
          { id: "overview", label: "🏠 Overview" },
          { id: "prospects", label: "📋 Prospects" },
          { id: "contacts", label: "👥 Contact Tracking" },
          { id: "districtinfo", label: "🏫 District Info" },
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
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (() => {
          const STATE_NAMES_OV = { FL: "🌴 Florida", AL: "Alabama", ID: "Idaho", NV: "Nevada", CA: "🌊 California", OR: "🌲 Oregon", NM: "New Mexico", GA: "Georgia", MI: "Michigan" };
          const repEmail = overviewFilterRep === "all" ? null : overviewFilterRep;
          const stateFilter = overviewFilterState === "all" ? null : overviewFilterState;

          const ovDistricts = districts.filter((d) => {
            const matchState = !stateFilter || (d.state || "FL") === stateFilter;
            const matchRep = !repEmail || STATE_REP_EMAIL[d.state || "FL"] === repEmail;
            return matchState && matchRep;
          });

          // ── Stats ──
          const total = ovDistricts.length;
          const tier1 = ovDistricts.filter(d => d.priorityTier === "Tier 1").length;
          const tier2 = ovDistricts.filter(d => d.priorityTier === "Tier 2").length;
          const contacted = ovDistricts.filter(d => d.status !== "not contacted").length;
          const notContacted = ovDistricts.filter(d => d.status === "not contacted").length;
          const hot = ovDistricts.filter(d => d.priority >= 75).length;
          const warm = ovDistricts.filter(d => d.priority >= 55 && d.priority < 75).length;
          const inProgress = ovDistricts.filter(d => ["responded","meeting scheduled","proposal sent"].includes(d.status)).length;
          const won = ovDistricts.filter(d => d.status === "closed won").length;

          // ── Pending contacts (not contacted, ordered by priority) ──
          const pending = ovDistricts
            .filter(d => d.status === "not contacted" && d.email)
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .slice(0, 20);

          // ── Weekly intel news (districtContext + boardNotes updated in last 7 days) ──
          const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const cutoff = sevenDaysAgo.toISOString().split("T")[0];
          const newsItems = [];
          ovDistricts.forEach(d => {
            const distName = d.district.includes(" — ") ? d.district.split(" — ").slice(1).join(" — ") : d.district;
            const repInfo = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]];
            const stateLabel = STATE_NAMES_OV[d.state || "FL"] || d.state;
            if (Array.isArray(d.boardNotes)) {
              d.boardNotes.filter(n => n.date >= cutoff).forEach(n => {
                newsItems.push({ distName, stateLabel, repInfo, type: "board", summary: n.summary, source: n.source, date: n.date, districtId: d.id });
              });
            }
            if (Array.isArray(d.districtContext)) {
              d.districtContext.filter(n => n.date >= cutoff).forEach(n => {
                newsItems.push({ distName, stateLabel, repInfo, type: "intel", summary: n.summary, source: n.source, date: n.date, districtId: d.id });
              });
            }
          });
          newsItems.sort((a, b) => b.date.localeCompare(a.date));

          const statCards = [
            { label: "Total Districts", val: total, color: "text-gray-800", bg: "bg-gray-50" },
            { label: "Tier 1 + 2", val: tier1 + tier2, color: "text-indigo-700", bg: "bg-indigo-50" },
            { label: "🔥 Hot Leads", val: hot, color: "text-red-600", bg: "bg-red-50" },
            { label: "🌡 Warm Leads", val: warm, color: "text-orange-500", bg: "bg-orange-50" },
            { label: "Not Yet Contacted", val: notContacted, color: "text-gray-600", bg: "bg-gray-50" },
            { label: "Contacted", val: contacted, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "In Progress", val: inProgress, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Closed Won", val: won, color: "text-green-600", bg: "bg-green-50" },
          ];

          return (
            <div>
              {/* ── Filters ── */}
              <div className="flex flex-nowrap gap-3 mb-5 items-center">
                <select value={overviewFilterState} onChange={e => setOverviewFilterState(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="all">All States</option>
                  <option value="FL">🌴 Florida</option>
                  <option value="AL">Alabama</option>
                  <option value="ID">Idaho</option>
                  <option value="NV">Nevada</option>
                  <option value="CA">🌊 California</option>
                  <option value="OR">🌲 Oregon</option>
                  <option value="NM">New Mexico</option>
                  <option value="GA">Georgia</option>
                  <option value="MI">Michigan</option>
                </select>
                <select value={overviewFilterRep} onChange={e => setOverviewFilterRep(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="all">All Reps</option>
                  {Object.values(REP_PROFILES).map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
                </select>
                <span className="text-xs text-gray-400">{total} districts</span>
              </div>

              {/* ── Stat Cards ── */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {statCards.map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* ── Pipeline by State ── */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Pipeline by State</h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-2 font-medium text-gray-500">State</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">Rep</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">Districts</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">Tier 1+2</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">Not Contacted</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">In Progress</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">Won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(STATE_NAMES_OV)
                        .filter(s => !stateFilter || s === stateFilter)
                        .filter(s => !repEmail || STATE_REP_EMAIL[s] === repEmail)
                        .map(s => {
                          const sd = ovDistricts.filter(d => (d.state || "FL") === s);
                          if (sd.length === 0) return null;
                          const repProf = REP_PROFILES[STATE_REP_EMAIL[s]];
                          return (
                            <tr key={s} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2.5 font-medium text-gray-800">{STATE_NAMES_OV[s]}</td>
                              <td className="px-4 py-2.5">
                                {repProf ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${repProf.color}`}>{repProf.name}</span> : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-600">{sd.length}</td>
                              <td className="px-4 py-2.5 text-right text-indigo-600">{sd.filter(d => d.priorityTier === "Tier 1" || d.priorityTier === "Tier 2").length}</td>
                              <td className="px-4 py-2.5 text-right text-gray-500">{sd.filter(d => d.status === "not contacted").length}</td>
                              <td className="px-4 py-2.5 text-right text-purple-600">{sd.filter(d => ["responded","meeting scheduled","proposal sent"].includes(d.status)).length}</td>
                              <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{sd.filter(d => d.status === "closed won").length}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* ── Pending to Contact ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">⏳ Pending to Contact</h3>
                    <span className="text-xs text-gray-400">Top {pending.length} by priority · has email</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {pending.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">All districts have been contacted! 🎉</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {pending.map(d => {
                          const name = d.district.includes(" — ") ? d.district.split(" — ").slice(1).join(" — ") : d.district;
                          const repProf = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]];
                          const tierColor = d.priorityTier === "Tier 1" ? "bg-red-50 text-red-600" : d.priorityTier === "Tier 2" ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-500";
                          return (
                            <div key={d.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedDistrict(d); setModalTab("overview"); }}>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-gray-800 truncate">{name}</div>
                                <div className="text-xs text-gray-400 truncate">{d.director} · {STATE_NAMES_OV[d.state || "FL"]}</div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tierColor}`}>{d.priorityTier}</span>
                                {repProf && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${repProf.color}`}>{repProf.initials}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Weekly Intel News ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">📰 Intel This Week</h3>
                    <span className="text-xs text-gray-400">Last 7 days · {newsItems.length} update{newsItems.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-[520px] overflow-y-auto">
                    {newsItems.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">No intel updates in the past 7 days.</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {newsItems.map((item, i) => (
                          <div key={i} className="px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => { const d = districts.find(x => x.id === item.districtId); if (d) { setSelectedDistrict(d); setModalTab(item.type === "board" ? "board notes" : "district intel"); } }}>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.type === "board" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                                  {item.type === "board" ? "📋 Board" : "🔍 Intel"}
                                </span>
                                <span className="text-xs font-semibold text-gray-800">{item.distName}</span>
                                <span className="text-xs text-gray-400">{item.stateLabel}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {item.repInfo && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${item.repInfo.color}`}>{item.repInfo.initials}</span>}
                                <span className="text-xs text-gray-400 whitespace-nowrap">{item.date}</span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{item.summary}</p>
                            {item.source && <a href={item.source} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline mt-0.5 inline-block" onClick={e => e.stopPropagation()}>Source ↗</a>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── PROSPECTS TAB ── */}
        {activeTab === "prospects" && (
          <div>
            {/* Filters */}
            <div className="flex flex-nowrap gap-3 mb-4 items-center overflow-x-auto pb-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search district, director, county..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-shrink-0 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {[
                { label: "State", val: filterState, setter: setFilterState, opts: [["all","All States"],["FL","🌴 Florida"],["AL","Alabama"],["ID","Idaho"],["NV","Nevada"],["CA","🌊 California"],["OR","🌲 Oregon"],["NM","New Mexico"]] },
                { label: "Priority", val: filterPriority, setter: setFilterPriority, opts: [["all","All Priorities"],["hot","🔥 Hot"],["warm","🌡️ Warm"],["cool","💧 Cool"],["cold","❄️ Cold"]] },
                { label: "Curriculum", val: filterCurriculum, setter: setFilterCurriculum, opts: [["all","All Curricula"], ...CURRICULUM_VENDORS.map(v => [v, v])] },
                { label: "Status", val: filterStatus, setter: setFilterStatus, opts: [["all","All Statuses"], ...STATUSES.map(s => [s, s])] },
              ].map((f) => (
                <select
                  key={f.label}
                  value={f.val}
                  onChange={(e) => f.setter(e.target.value)}
                  style={{ maxWidth: "180px" }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
              <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-gray-200 pl-3 ml-1">
                <span className="text-xs text-gray-400 whitespace-nowrap">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ maxWidth: "160px" }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="priority">⚡ Priority Score</option>
                  <option value="enrollment">🏫 District Size</option>
                  <option value="tier">🏆 Tier</option>
                  <option value="adoptionYear">📅 Adoption Year (oldest)</option>
                  <option value="lastUpdated">🔄 Recently Updated</option>
                  <option value="status">📊 Status</option>
                </select>
              </div>
              <span className="text-xs text-gray-400 ml-1 flex-shrink-0 whitespace-nowrap">{filtered.length} results</span>
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
                    {[
                      { h: "Priority" }, { h: "District" }, { h: "Director" }, { h: "Curriculum" },
                      { h: "Adopted" }, { h: "Age" }, { h: "Enrollment" },
                      { h: "Signals", style: { minWidth: "220px" } },
                      { h: "Status" }, { h: "Actions" },
                    ].map(({ h, style }) => (
                      <th key={h} className="px-3 py-3 text-left font-medium" style={style}>{h}</th>
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
                          {(() => { const rep = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]]; return rep ? <span className={`text-xs px-1.5 py-0 rounded font-semibold mt-0.5 inline-block ${rep.color}`}>{rep.initials}</span> : null; })()}
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
                        <td className="px-3 py-2.5" style={{ minWidth: "220px" }}>
                          <div className="flex flex-wrap gap-1">
                            {d.buyingSignals.length > 0 && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-xs">⚡ {d.buyingSignals.length} signal{d.buyingSignals.length > 1 ? "s" : ""}</span>
                            )}
                            {d.boardNotes && d.boardNotes.length > 0 && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs">📋 {d.boardNotes.length} board note{d.boardNotes.length > 1 ? "s" : ""}</span>
                            )}
                            {d.districtContext && d.districtContext.length > 0 && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-xs">🔍 {d.districtContext.length} intel</span>
                            )}
                            {hasPersonalizedEmail(d) && (
                              <span className="bg-yellow-50 text-yellow-700 border border-yellow-300 px-2 py-0.5 rounded text-xs font-medium">✨ Personalized</span>
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
                                    ...(hasPersonalizedEmail(d) ? [
                                      { label: "✨ Personalized Outreach", key: "personalized" },
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

        {/* ── CONTACT TRACKING TAB ── */}
        {activeTab === "contacts" && (() => {
          const activityIcon = (type) => type === "email" ? "✉️" : type === "call" ? "📞" : type === "linkedin" ? "🔗" : type === "meeting" ? "📅" : "📝";
          const activityBg = (type) => type === "email" ? "bg-blue-100 text-blue-600" : type === "call" ? "bg-green-100 text-green-600" : type === "linkedin" ? "bg-indigo-100 text-indigo-600" : type === "meeting" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-600";

          const contactDistricts = districts.filter((d) => {
            const matchSearch = !contactSearch || d.district.toLowerCase().includes(contactSearch.toLowerCase()) || d.director.toLowerCase().includes(contactSearch.toLowerCase()) || (d.email || "").toLowerCase().includes(contactSearch.toLowerCase());
            const matchState = contactFilterState === "all" || (d.state || "FL") === contactFilterState;
            const matchRep = contactFilterRep === "all" || STATE_REP_EMAIL[d.state || "FL"] === contactFilterRep;
            return matchSearch && matchState && matchRep;
          }).slice().sort((a, b) => {
            const aLast = a.activities?.length ? a.activities[a.activities.length - 1].date : "";
            const bLast = b.activities?.length ? b.activities[b.activities.length - 1].date : "";
            if (aLast && !bLast) return -1;
            if (!aLast && bLast) return 1;
            if (aLast && bLast) return bLast.localeCompare(aLast);
            return b.priority - a.priority;
          });

          const totalContacted = districts.filter(d => d.activities?.length > 0).length;
          const totalReplied = districts.filter(d => d.status === "responded" || d.status === "meeting scheduled").length;

          return (
            <div>
              <div className="mb-4 flex flex-wrap gap-4 items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Contact Tracking</h2>
                  <p className="text-xs text-gray-500 mt-1">Full outreach history per district. Log calls, emails, and meetings. Click a row to expand.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-4 text-center">
                    <div><div className="text-lg font-bold text-indigo-600">{totalContacted}</div><div className="text-xs text-gray-400">Contacted</div></div>
                    <div><div className="text-lg font-bold text-green-600">{totalReplied}</div><div className="text-xs text-gray-400">Replied/Meeting</div></div>
                    <div><div className="text-lg font-bold text-gray-500">{districts.length - totalContacted}</div><div className="text-xs text-gray-400">Not Yet Contacted</div></div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => gmailConnected ? syncGmailActivity() : connectGmail((t) => syncGmailActivity(t))}
                      disabled={gmailSyncing}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 border transition-colors ${gmailSyncing ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 cursor-pointer"}`}
                    >
                      {gmailSyncing ? "⏳ Syncing Gmail..." : "🔄 Sync Gmail Activity"}
                    </button>
                    {lastSyncTime && <span className="text-xs text-gray-400">Last synced {lastSyncTime}</span>}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="🔍 Search district, director, email..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <select value={contactFilterState} onChange={(e) => setContactFilterState(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="all">All States</option>
                  <option value="FL">🌴 Florida</option>
                  <option value="AL">Alabama</option>
                  <option value="ID">Idaho</option>
                  <option value="NV">Nevada</option>
                  <option value="CA">🌊 California</option>
                  <option value="OR">🌲 Oregon</option>
                  <option value="NM">New Mexico</option>
                </select>
                <select value={contactFilterRep} onChange={(e) => setContactFilterRep(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="all">All Reps</option>
                  {Object.values(REP_PROFILES).map(rep => (
                    <option key={rep.email} value={rep.email}>{rep.name}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-400 self-center">{contactDistricts.length} districts</span>
              </div>

              {/* Contact Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 grid text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{gridTemplateColumns:"2fr 1.5fr 1fr 80px 100px 120px 80px"}}>
                  <span>District / Director</span>
                  <span>Contact Info</span>
                  <span>Assigned Rep</span>
                  <span>Touches</span>
                  <span>Last Contact</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>

                {contactDistricts.map((d) => {
                  const rep = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]] || DEFAULT_REP;
                  const acts = d.activities || [];
                  const lastAct = acts.length ? acts[acts.length - 1] : null;
                  const isExpanded = expandedContactId === d.id;

                  return (
                    <div key={d.id} className="border-b border-gray-100 last:border-b-0">
                      {/* Row */}
                      <div
                        className={`px-4 py-3 grid items-center gap-2 cursor-pointer hover:bg-indigo-50 transition-colors ${isExpanded ? "bg-indigo-50" : ""}`}
                        style={{gridTemplateColumns:"2fr 1.5fr 1fr 80px 100px 120px 80px"}}
                        onClick={() => setExpandedContactId(isExpanded ? null : d.id)}
                      >
                        <div>
                          <div className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                            {d.county} County
                            {d.state && d.state !== "FL" && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded font-semibold">{d.state}</span>}
                          </div>
                          <div className="text-xs text-gray-400 truncate">{d.director}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-700 truncate">{d.email || <span className="text-gray-300">No email</span>}</div>
                          <div className="text-xs text-gray-400">{d.phone}</div>
                        </div>
                        <div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${rep.color}`}>{rep.initials} {rep.name.split(" ")[0]}</span>
                        </div>
                        <div className="text-center">
                          {acts.length > 0
                            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{acts.length} touch{acts.length > 1 ? "es" : ""}</span>
                            : <span className="text-xs text-gray-300">—</span>}
                        </div>
                        <div>
                          {lastAct
                            ? <div><div className="text-xs font-medium text-gray-700">{lastAct.date}</div><div className="text-xs text-gray-400 capitalize">{activityIcon(lastAct.type)} {lastAct.type}</div></div>
                            : <span className="text-xs text-gray-300">Never</span>}
                        </div>
                        <div>
                          <select
                            value={d.status}
                            onChange={(e) => { e.stopPropagation(); updateDistrict(d.id, { status: e.target.value }); }}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs border-0 bg-transparent focus:outline-none cursor-pointer ${statusColor(d.status)}`}
                          >
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-1 items-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedContactId(isExpanded ? null : d.id); setInlineActivity({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" }); }}
                            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                          >
                            {isExpanded ? "▲" : "+ Log"}
                          </button>
                        </div>
                      </div>

                      {/* Expanded: history + log form */}
                      {isExpanded && (
                        <div className="border-t border-indigo-100 bg-indigo-50/40 px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Left: Timeline */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact History</h4>
                              {acts.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No contact logged yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {[...acts].reverse().map((a) => (
                                    <div key={a.id} className="flex gap-3 items-start">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${activityBg(a.type)}`}>
                                        {activityIcon(a.type)}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-gray-700 capitalize">{a.type}</span>
                                          <span className="text-xs text-gray-400">{a.date}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-0.5">{a.notes}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Right: Log new activity */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Log New Activity</h4>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <select
                                  value={inlineActivity.type}
                                  onChange={(e) => setInlineActivity(p => ({ ...p, type: e.target.value }))}
                                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                                >
                                  <option value="email">✉️ Email Sent</option>
                                  <option value="call">📞 Phone Call</option>
                                  <option value="linkedin">🔗 LinkedIn</option>
                                  <option value="meeting">📅 Meeting</option>
                                  <option value="note">📝 Note</option>
                                </select>
                                <input
                                  type="date"
                                  value={inlineActivity.date}
                                  onChange={(e) => setInlineActivity(p => ({ ...p, date: e.target.value }))}
                                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                                />
                              </div>
                              <textarea
                                value={inlineActivity.notes}
                                onChange={(e) => setInlineActivity(p => ({ ...p, notes: e.target.value }))}
                                placeholder="Outcome, next steps, replied, left voicemail..."
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs h-16 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-2 bg-white"
                              />
                              <button
                                onClick={() => {
                                  if (!inlineActivity.notes) return;
                                  const act = { ...inlineActivity, id: Date.now(), district: d.district, directorName: d.director };
                                  const updated = [...(d.activities || []), act];
                                  updateDistrict(d.id, { activities: updated, status: inlineActivity.type === "meeting" ? "meeting scheduled" : d.status });
                                  setActivityLog(prev => [act, ...prev]);
                                  setInlineActivity({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });
                                  showNotif("Activity logged ✓");
                                }}
                                disabled={!inlineActivity.notes}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-40"
                              >
                                Log Activity
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {contactDistricts.length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-sm">No districts match your filters.</div>
                )}
              </div>
            </div>
          );
        })()}

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
                <div className="flex gap-2 mt-3 flex-wrap items-center">
                  <button
                    onClick={sendAllEmails}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded-lg font-semibold"
                  >
                    📤 Send All ({approvalQueue.length})
                  </button>
                  <button
                    onClick={async () => { for (const item of [...approvalQueue]) { await draftEmail(item, gmailToken); await new Promise(r => setTimeout(r, 300)); } }}
                    className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs px-3 py-2 rounded-lg font-semibold"
                  >
                    📋 Draft All ({approvalQueue.length})
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`Remove all ${approvalQueue.length} emails from the queue?`)) setApprovalQueue([]); }}
                    className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 text-xs px-3 py-2 rounded-lg font-semibold ml-auto"
                  >
                    🗑 Clear Queue
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
                    item.template === "personalized" ? "✨ Personalized Outreach" :
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
                            onClick={() => draftEmail(item)}
                            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs px-3 py-1.5 rounded-lg font-semibold"
                          >
                            📋 Draft
                          </button>
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
                      <div className="bg-white max-h-64 overflow-y-auto border-t border-gray-100">
                        <iframe
                          srcDoc={parseEmailParts(item.body).body}
                          title="Email preview"
                          className="w-full border-0"
                          style={{ minHeight: "220px" }}
                          sandbox="allow-same-origin"
                        />
                      </div>
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

        {/* ── DISTRICT INFO TAB ── */}
        {activeTab === "districtinfo" && (() => {
          const diDistricts = districts.filter(d => {
            const matchState = diInfoState === "all" || (d.state || "FL") === diInfoState;
            const matchSearch = !diInfoSearch ||
              d.district.toLowerCase().includes(diInfoSearch.toLowerCase()) ||
              d.director.toLowerCase().includes(diInfoSearch.toLowerCase()) ||
              (d.county || "").toLowerCase().includes(diInfoSearch.toLowerCase());
            return matchState && matchSearch;
          });

          const selectedDi = diInfoSelectedId ? districts.find(d => d.id === diInfoSelectedId) : null;

          const diTemplateOptions = selectedDi ? [
            { label: "📧 Original Email", key: "original" },
            { label: "☀️ Summer Long", key: "summerLong" },
            { label: "☀️ Summer Short", key: "summerShort" },
            ...((selectedDi.state || "FL") === "FL" ? [
              { label: "🌴 FL Summer Bridge (Long)", key: "summerBridge" },
              { label: "🌴 FL Summer Bridge (Short)", key: "summerBridgeShort" },
            ] : []),
            ...(hasPersonalizedEmail(selectedDi) ? [
              { label: "✨ Personalized Outreach", key: "personalized" },
            ] : []),
          ] : [];

          const repForDi = selectedDi ? REP_PROFILES[STATE_REP_EMAIL[selectedDi.state || "FL"]] : null;
          const STATE_NAMES_DI = { FL: "Florida", AL: "Alabama", ID: "Idaho", NV: "Nevada", CA: "California", OR: "Oregon", NM: "New Mexico" };

          return (
            <div>
              <div className="mb-4">
                <h2 className="text-base font-bold text-gray-900">District Info</h2>
                <p className="text-xs text-gray-500 mt-1">Search any district to see its full profile, intel, and available email drafts.</p>
              </div>

              {/* Search controls */}
              <div className="flex gap-3 mb-5 items-start flex-wrap">
                <select
                  value={diInfoState}
                  onChange={e => { setDiInfoState(e.target.value); setDiInfoSelectedId(null); setDiInfoSearch(""); }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="all">All States</option>
                  <option value="FL">🌴 Florida</option>
                  <option value="AL">Alabama</option>
                  <option value="ID">Idaho</option>
                  <option value="NV">Nevada</option>
                  <option value="CA">🌊 California</option>
                  <option value="OR">🌲 Oregon</option>
                  <option value="NM">New Mexico</option>
                </select>

                <div className="relative" style={{ width: "380px" }}>
                  <input
                    value={diInfoSearch}
                    onChange={e => { setDiInfoSearch(e.target.value); setDiInfoShowResults(true); setDiInfoSelectedId(null); }}
                    onFocus={() => setDiInfoShowResults(true)}
                    onBlur={() => setTimeout(() => setDiInfoShowResults(false), 180)}
                    placeholder="🔍 Type to search district, director, or county..."
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  {diInfoShowResults && diInfoSearch && !selectedDi && diDistricts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-64 overflow-y-auto">
                      {diDistricts.slice(0, 25).map(d => {
                        const shortN = d.district.includes(" — ") ? d.district.split(" — ").slice(1).join(" — ") : d.district;
                        const repP = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]];
                        return (
                          <div
                            key={d.id}
                            className="px-3 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-b-0"
                            onMouseDown={() => { setDiInfoSelectedId(d.id); setDiInfoSearch(shortN); setDiInfoShowResults(false); setDiInfoEmailTemplate("original"); }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-gray-800 truncate">{shortN}</div>
                                <div className="text-xs text-gray-400">{d.director} · {d.county} County</div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {d.state && d.state !== "FL" && <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded font-semibold">{d.state}</span>}
                                {repP && <span className={`text-xs px-1.5 py-0 rounded-full font-semibold ${repP.color}`}>{repP.initials}</span>}
                                {hasPersonalizedEmail(d) && <span className="text-yellow-500 text-xs" title="Personalized email available">✨</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {diDistricts.length > 25 && (
                        <div className="px-3 py-2 text-xs text-gray-400 text-center bg-gray-50">Showing 25 of {diDistricts.length} — type more to narrow</div>
                      )}
                    </div>
                  )}
                  {diInfoSearch && !selectedDi && (
                    <div className="text-xs text-gray-400 mt-1">{diDistricts.length} match{diDistricts.length !== 1 ? "es" : ""}</div>
                  )}
                </div>

                {selectedDi && (
                  <button
                    onClick={() => { setDiInfoSelectedId(null); setDiInfoSearch(""); }}
                    className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-lg"
                  >✕ Clear</button>
                )}
              </div>

              {/* District profile */}
              {selectedDi ? (() => {
                const age = 2026 - selectedDi.curriculumAdoptionYear;
                const pLabel = getPriorityLabel(selectedDi.priority);

                return (
                  <div className="space-y-4">
                    {/* Header card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pLabel.color}`}>{pLabel.label} · {selectedDi.priority}/100</span>
                            {selectedDi.priorityTier && <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">{selectedDi.priorityTier}</span>}
                            {selectedDi.newLeadership && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">🆕 New Leadership</span>}
                            {hasPersonalizedEmail(selectedDi) && (
                              <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs px-2 py-0.5 rounded-full font-medium">✨ Personalized email available</span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">{selectedDi.district}</h3>
                          <p className="text-sm text-gray-400 mt-0.5">{selectedDi.county} County · {STATE_NAMES_DI[selectedDi.state || "FL"] || selectedDi.state || "Florida"}</p>
                          {selectedDi.lastUpdated && <span className="inline-block mt-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">🔄 Updated {selectedDi.lastUpdated}</span>}
                        </div>
                        {repForDi && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${repForDi.color}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${repForDi.color}`}>{repForDi.initials}</div>
                            <div>
                              <div className="text-xs font-semibold">{repForDi.name}</div>
                              <div className="text-xs opacity-70">Assigned rep</div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Director Contact</h4>
                          <div className="space-y-1.5 text-sm">
                            <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedDi.director}</span></div>
                            {selectedDi.title && <div><span className="text-gray-500">Title:</span> {selectedDi.title}</div>}
                            <div><span className="text-gray-500">Email:</span> {selectedDi.email ? <a href={`mailto:${selectedDi.email}`} className="text-indigo-600 hover:underline">{selectedDi.email}</a> : <span className="text-gray-300">—</span>}</div>
                            <div><span className="text-gray-500">Phone:</span> {selectedDi.phone || <span className="text-gray-300">—</span>}</div>
                            {selectedDi.linkedin && <div><span className="text-gray-500">LinkedIn:</span> <a href={`https://${selectedDi.linkedin}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs">View Profile ↗</a></div>}
                          </div>
                          {selectedDi.summerBridgeContact && (
                            <div className="mt-3 pt-2 border-t border-dashed border-green-200">
                              <h5 className="text-xs font-semibold text-green-700 mb-1">🌴 Summer Bridge Contact</h5>
                              <div className="space-y-1 text-xs">
                                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedDi.summerBridgeContact.fullName}</span></div>
                                <div><span className="text-gray-500">Email:</span> <a href={`mailto:${selectedDi.summerBridgeContact.email}`} className="text-green-600 hover:underline">{selectedDi.summerBridgeContact.email}</a></div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Curriculum Profile</h4>
                          <div className="space-y-1.5 text-sm">
                            <div><span className="text-gray-500">Curriculum:</span> <span className="font-medium text-indigo-700">{selectedDi.curriculum}</span></div>
                            <div><span className="text-gray-500">Vendor:</span> {selectedDi.curriculumVendor}</div>
                            <div><span className="text-gray-500">Adopted:</span> {selectedDi.curriculumAdoptionYear} <span className={`font-medium ${age >= 6 ? "text-red-500" : age >= 4 ? "text-orange-500" : "text-gray-500"}`}>({age} yrs ago)</span></div>
                            <div><span className="text-gray-500">Enrollment:</span> {selectedDi.enrollment?.toLocaleString()}</div>
                            <div><span className="text-gray-500">Status:</span> <span className={`ml-1 font-medium ${statusColor(selectedDi.status)}`}>{selectedDi.status}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Buying Signals */}
                    {selectedDi.buyingSignals && selectedDi.buyingSignals.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">⚡ Buying Signals</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedDi.buyingSignals.map((s, i) => (
                            <span key={i} className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-lg text-xs font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Board Notes */}
                    {selectedDi.boardNotes && selectedDi.boardNotes.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📋 Board Notes <span className="text-gray-300 font-normal normal-case ml-1">({selectedDi.boardNotes.length})</span></h4>
                        <div className="space-y-2 max-h-52 overflow-y-auto">
                          {[...selectedDi.boardNotes].sort((a, b) => b.date.localeCompare(a.date)).map((n, i) => (
                            <div key={i} className="flex items-start justify-between gap-2 bg-blue-50/50 rounded-lg px-3 py-2">
                              <div className="flex-1">
                                <span className="text-xs font-semibold text-gray-600">{n.date}</span>
                                <p className="text-xs text-gray-700 mt-0.5">{n.summary}</p>
                              </div>
                              {n.source && <a href={n.source} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline flex-shrink-0 mt-0.5">↗</a>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* District Intel */}
                    {selectedDi.districtContext && selectedDi.districtContext.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">🔍 District Intel <span className="text-gray-300 font-normal normal-case ml-1">({selectedDi.districtContext.length})</span></h4>
                        <div className="space-y-2 max-h-52 overflow-y-auto">
                          {[...selectedDi.districtContext].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((ctx, i) => {
                            const typeColor = {
                              strategic: "bg-purple-50 text-purple-700",
                              funding: "bg-green-50 text-green-700",
                              website: "bg-blue-50 text-blue-700",
                            }[ctx.type] || "bg-gray-100 text-gray-600";
                            const typeLabel = { strategic: "📋 Strategic", funding: "💰 Funding", website: "🌐 Website" }[ctx.type] || ctx.type;
                            return (
                              <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeColor}`}>{typeLabel}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{ctx.date}</span>
                                    {ctx.source && <a href={ctx.source} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">↗</a>}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-700 leading-relaxed">{ctx.summary}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Contact History */}
                    {selectedDi.activities && selectedDi.activities.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📞 Contact History <span className="text-gray-300 font-normal normal-case ml-1">({selectedDi.activities.length} touch{selectedDi.activities.length !== 1 ? "es" : ""})</span></h4>
                        <div className="space-y-2">
                          {[...selectedDi.activities].reverse().slice(0, 5).map((a, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs bg-gray-50 rounded px-3 py-2">
                              <span className="text-gray-400 flex-shrink-0 mt-0.5 w-20">{a.date}</span>
                              <span className="font-medium capitalize text-indigo-600 flex-shrink-0 w-14">{a.type}</span>
                              <span className="text-gray-600">{a.notes}</span>
                            </div>
                          ))}
                          {selectedDi.activities.length > 5 && (
                            <div className="text-xs text-gray-400 pl-3">+ {selectedDi.activities.length - 5} more — see Contact Tracking tab</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Email Drafts */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">✉️ Email Drafts</h4>
                      {!selectedDi.email ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">⚠️ No email address on file for this district — cannot draft or queue.</p>
                      ) : (
                        <div>
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <select
                              value={diInfoEmailTemplate}
                              onChange={e => setDiInfoEmailTemplate(e.target.value)}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              {diTemplateOptions.map(t => (
                                <option key={t.key} value={t.key}>{t.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const body = diInfoEmailTemplate === "personalized"
                                  ? generatePersonalizedEmail(selectedDi, currentRep)
                                  : generateEmail(selectedDi, diInfoEmailTemplate, currentRep);
                                if (!body) { showNotif("⚠️ No email body generated", "red"); return; }
                                setEmailPreview(body);
                                setShowEmailPreview(true);
                              }}
                              className="text-xs border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium"
                            >Preview</button>
                            <button
                              onClick={() => queueEmail(selectedDi, diInfoEmailTemplate)}
                              className="text-xs bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 font-medium"
                            >Add to Send Queue →</button>
                          </div>
                          {diInfoEmailTemplate === "personalized" && hasPersonalizedEmail(selectedDi) && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 leading-relaxed">
                              ✨ This email is customized based on the most recent intel for {selectedDi.district.includes(" — ") ? selectedDi.district.split(" — ").slice(1).join(" — ") : selectedDi.district} — referencing board notes, district context, or buying signals in the opening paragraph and subject line.
                            </div>
                          )}
                          {!hasPersonalizedEmail(selectedDi) && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
                              No intel on file yet for personalized outreach. Once board notes, district context, or buying signals are added, a ✨ Personalized option will appear here.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-16 text-center text-gray-400">
                  <div className="text-4xl mb-3">🏫</div>
                  <p className="font-medium text-sm">Search for a district above to see its full profile</p>
                  <p className="text-xs mt-1">{districts.length} districts in the database · type to search</p>
                </div>
              )}
            </div>
          );
        })()}

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
                            onClick={() => { setEmailPreview(generateEmail(selectedDistrict, t.key, currentRep)); setShowEmailPreview(true); }}
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
                                onClick={() => { setEmailPreview(generateEmail(selectedDistrict, "summerBridge", currentRep)); setShowEmailPreview(true); }}
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
                                onClick={() => { setEmailPreview(generateEmail(selectedDistrict, "summerBridgeShort", currentRep)); setShowEmailPreview(true); }}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center rounded-t-2xl flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Email Preview</h3>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard?.writeText(stripHtml(emailPreview)); showNotif("Copied!"); }} className="text-xs border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50">Copy text</button>
                <button onClick={() => setShowEmailPreview(false)} className="text-gray-400 hover:text-gray-700 text-xl font-light">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl">
              <iframe
                srcDoc={emailPreview}
                title="Email Preview"
                className="w-full h-full border-0"
                style={{ minHeight: "500px" }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
