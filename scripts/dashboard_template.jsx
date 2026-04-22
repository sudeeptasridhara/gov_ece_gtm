// ─── INTEGRATION CONFIG ───────────────────────────────────────────────────────
// Fill these in once in GitHub → scripts/dashboard_template.jsx, then run the
// GitHub Action to rebuild. See setup instructions in the README.
const GOOGLE_CLIENT_ID = "642445271504-vr3au2pic0ma5aekadpq4icrv9t9eekj.apps.googleusercontent.com";
const SLACK_WEBHOOK_URL = ""; // e.g. "https://hooks.slack.com/services/T.../B.../xxx"

// ─── SHARED ACTIVITY LOG ──────────────────────────────────────────────────────
// One Google Sheet shared across all reps — persists all logged activities.
// Setup: create a Google Sheet, share it with all reps (Editor access),
// then paste the Sheet ID from the URL (/spreadsheets/d/SHEET_ID/edit) below.
const ACTIVITY_SHEET_ID = "1PasvZHeHTbAaiM1oI0Xe9pxyx-MgwDTF64Y-yuQACwM";
const SHEET_COLS = ["activity_id","district_id","district_name","type","date","notes","full_notes","source","rep_email","director_name","dedup_id","logged_at"];

// ─── PUBLIC ACTIVITY LOG API ──────────────────────────────────────────────────
// Deploy activity_log_api.gs as a Google Apps Script web app (execute as: Me,
// access: Anyone) and paste the resulting URL below. Once set, ALL logged
// activities (Gmail, Granola, and manual notes) are visible to anyone who
// opens the dashboard — no sign-in required.
// See activity_log_api.gs for step-by-step deployment instructions.
const ACTIVITY_WEBAPP_URL = "https://script.google.com/a/macros/mybrightwheel.com/s/AKfycbzRvpSmE36rXIRdWXdcZoGyci-CrczyjJ-cZVTSpfJRCNBCOonzX1g94FAS8MKn8X6c7w/exec";

// ─── SEQUENCE STAGES ─────────────────────────────────────────────────────────
const SEQUENCE_STAGES = {
  not_started:    { label: "Not Started",    color: "bg-gray-100 text-gray-500",     dot: "bg-gray-400"    },
  email_sent:     { label: "Email Sent",     color: "bg-blue-100 text-blue-700",     dot: "bg-blue-500"    },
  mailer_queued:  { label: "Mailer Queued",  color: "bg-orange-100 text-orange-700", dot: "bg-orange-500"  },
  vm_left:        { label: "VM Left",        color: "bg-purple-100 text-purple-700", dot: "bg-purple-500"  },
  follow_up_sent: { label: "Follow-up Sent", color: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500"  },
  closing_sent:   { label: "Closing Sent",   color: "bg-teal-100 text-teal-700",     dot: "bg-teal-500"    },
  responded:      { label: "Responded ✓",    color: "bg-green-100 text-green-700",   dot: "bg-green-500"   },
  nurture:        { label: "Nurture",        color: "bg-slate-100 text-slate-500",   dot: "bg-slate-400"   },
  linkedin:       { label: "LinkedIn Sent",  color: "bg-sky-100 text-sky-600",       dot: "bg-sky-500"     },
};

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────────
// Each campaign defines a named 14-day outreach sequence with steps + trigger days.
const CAMPAIGNS = {
  summer_outreach: {
    label: "☀️ Summer Outreach",
    description: "14-day sequence to drive adoption of Experience Preschool for summer programs",
    steps: [
      { key: "email_sent",     day: 0,  label: "Initial Email",        icon: "📧", action: "Send initial outreach email",       color: "bg-blue-100 text-blue-700"    },
      { key: "mailer_queued",  day: 3,  label: "Physical Mailer",      icon: "📮", action: "Queue physical mailer",             color: "bg-orange-100 text-orange-700" },
      { key: "vm_left",        day: 5,  label: "Call + VM",            icon: "📞", action: "Call and leave voicemail",          color: "bg-purple-100 text-purple-700" },
      { key: "follow_up_sent", day: 7,  label: "Post-Call Follow-up",  icon: "✉️", action: "Send post-call follow-up email",    color: "bg-indigo-100 text-indigo-700" },
      { key: "closing_sent",   day: 12, label: "Closing Email",        icon: "🔒", action: "Send final closing email",          color: "bg-teal-100 text-teal-700"    },
      { key: "responded",      day: 14, label: "Responded ✓",          icon: "✅", action: "Schedule discovery call",           color: "bg-green-100 text-green-700"  },
      { key: "nurture",        day: 14, label: "Nurture",              icon: "🌱", action: "Move to nurture list",              color: "bg-slate-100 text-slate-500"  },
    ],
  },
};

// ─── STEP TYPES ──────────────────────────────────────────────────────────────
// Available step types for custom sequences. stageKey maps to SEQUENCE_STAGES.
const STEP_TYPES = {
  email:    { label: "Email",           icon: "📧", color: "bg-blue-100 text-blue-700",     defaultLabel: "Initial Email",     stageKey: "email_sent",     isEmail: true  },
  followup: { label: "Follow-up Email", icon: "✉️",  color: "bg-indigo-100 text-indigo-700", defaultLabel: "Follow-up Email",   stageKey: "follow_up_sent", isEmail: true  },
  closing:  { label: "Closing Email",   icon: "🔒", color: "bg-teal-100 text-teal-700",     defaultLabel: "Closing Email",     stageKey: "closing_sent",   isEmail: true  },
  call:     { label: "Call / VM",       icon: "📞", color: "bg-purple-100 text-purple-700", defaultLabel: "Call + Voicemail",  stageKey: "vm_left",        isEmail: false },
  linkedin: { label: "LinkedIn",        icon: "💼", color: "bg-sky-100 text-sky-700",       defaultLabel: "LinkedIn Outreach", stageKey: "linkedin",       isEmail: false },
  mailer:   { label: "Physical Mailer", icon: "📮", color: "bg-orange-100 text-orange-700", defaultLabel: "Physical Mailer",   stageKey: "mailer_queued",  isEmail: false },
};

// Map old status strings → new stage keys (for localStorage / sheet migration)
const LEGACY_STAGE_MAP = {
  "not contacted": "not_started",
  "reached out": "email_sent",
  "responded": "responded",
  "meeting scheduled": "responded",
  "proposal sent": "closing_sent",
  "closed won": "responded",
  "closed lost": "nurture",
  "unsubscribed": "nurture",
};

// Returns true when Day 5+ has elapsed since first outbound email and stage hasn't progressed past calling
function callWindowOpen(d) {
  if (!["email_sent", "mailer_queued"].includes(d.status || "not_started")) return false;
  const sentActs = (d.activities || []).filter(a => a.type === "email" && a.source !== "gmail_reply");
  if (!sentActs.length) return false;
  const earliest = sentActs.reduce((min, a) => a.date < min ? a.date : min, sentActs[0].date);
  const days = Math.floor((Date.now() - new Date(earliest).getTime()) / 86400000);
  return days >= 5;
}

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
    learnMoreUrl: "https://bw-gov.github.io/gov_ece_gtm/learn-more.html",
  },
  "eric.truog@mybrightwheel.com": {
    name: "Eric Truog",
    title: "Director of Business Operations",
    email: "eric.truog@mybrightwheel.com",
    phone: "",
    calendly: "", // add link when available
    color: "bg-blue-100 text-blue-700",
    initials: "ET",
    learnMoreUrl: "https://bw-gov.github.io/gov_ece_gtm/learn-more.html",
  },
  "kevin.elston@mybrightwheel.com": {
    name: "Kevin Elston",
    title: "District Partnerships",
    email: "kevin.elston@mybrightwheel.com",
    phone: "",
    calendly: "https://mybrightwheel.chilipiper.com/me/kevin-elston/meeting-with-kevin-elston",
    color: "bg-green-100 text-green-700",
    initials: "KE",
    learnMoreUrl: "https://bw-gov.github.io/gov_ece_gtm/learn-more.html",
  },
  "eric.bernstein@mybrightwheel.com": {
    name: "Eric Bernstein",
    title: "District Partnerships",
    email: "eric.bernstein@mybrightwheel.com",
    phone: "",
    calendly: "https://mybrightwheel.chilipiper.com/personal-page/eric-bernstein",
    color: "bg-orange-100 text-orange-700",
    initials: "EB",
    learnMoreUrl: "https://bw-gov.github.io/gov_ece_gtm/summer-solutions-eb.pdf",
  },
  "sudeepta.sridhara@mybrightwheel.com": {
    name: "Sudeepta Sridhara",
    title: "",
    email: "sudeepta.sridhara@mybrightwheel.com",
    phone: "",
    calendly: "",
    color: "bg-rose-100 text-rose-700",
    initials: "SS",
    learnMoreUrl: "https://bw-gov.github.io/gov_ece_gtm/learn-more.html",
  },
};
const DEFAULT_REP = REP_PROFILES["christie.cooley@mybrightwheel.com"];

// Users allowed to edit email copy
const AUTHORIZED_EDITORS = new Set([
  "christie.cooley@mybrightwheel.com",
  "eric.truog@mybrightwheel.com",
  "sudeepta.sridhara@mybrightwheel.com",
  "kevin.elston@mybrightwheel.com",
  "eric.bernstein@mybrightwheel.com",
]);

// Default plain-text bodies for each template.
// Tokens: [First Name], [State Name], [District Name], [Calendly Link], [Learn More Link]
const DEFAULT_TEMPLATE_TEXTS = {
  original: {
    label: "📧 Original Email",
    states: "All states",
    subject: "Improve Kindergarten Readiness Scores",
    body: `Hi [First Name],\n\nMany districts are looking for ways to increase Kindergarten readiness scores and support students transitioning into Kindergarten.\n\nBrightwheel's Experience Preschool is a flexible, play-based curriculum designed to support 4–8 week summer programs that help incoming Kindergarten students build the skills measured in readiness assessments. Because lessons are pre-packaged and organized by the day, many districts use it for summer programs.\n\n[Learn More Link] if your program is planning summer readiness or transition programming.\n\nI'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.\n\n[Calendly Link]`,
  },
  summerLong: {
    label: "☀️ Summer Long",
    states: "All states",
    subject: "Improve Kindergarten Readiness with Play-Based Summer Learning",
    body: `Hello [First Name],\n\nThe summer before kindergarten is one of the most critical windows in a child's educational journey.\n\nExperience Curriculum, powered by brightwheel, is the perfect solution for [State Name]'s summer programs. Everything teachers need is delivered in a ready-to-use kit, including lesson plans, materials, and student supplies for a classroom of 12.\n\nAt $249 for 4 weeks and $399 for 8 weeks, Experience Curriculum is priced to address the budgetary challenges many programs are facing.\n\nFor [State Name]'s summer programs, Experience Curriculum is a strong fit:\n• Aligned to [State Name]'s Standards for Early Learning and Development; emergent literacy instruction is grounded in the science of reading and built into every lesson\n• Easy to Implement: Whether your staff includes seasoned veterans or teachers just finding their footing, Experience Curriculum is ready to run from day one with access to free onboarding & training.\n• Built-in progress monitoring: Student observations and attendance documentation are integrated through the Brightwheel app.\n\n[Learn More Link] if your program is planning summer readiness or transition programming for VPK students.\n\nI'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.\n\n[Calendly Link]`,
  },
  summerShort: {
    label: "☀️ Summer Short",
    states: "All states",
    subject: "Improve Kindergarten Readiness with Play-Based Summer Learning",
    body: `Hi [First Name],\n\nAre you planning for the summer transition to Kindergarten?\n\nExperience Curriculum, powered by brightwheel, is the perfect solution.\n• Everything teachers need is delivered in a ready-to-use kit, including lesson plans, materials, and student supplies for a classroom of 12\n• It's aligned to [State Name]'s Standards for Early Learning and Development\n• Progress monitoring ties directly into the Brightwheel app, so there's minimal setup for teachers\n• Free online professional development\n\nPricing is $249 for 4-week programs or $399 for 8-week programs.\n\nHappy to send additional materials or jump on a quick call if it's helpful. Schedule time with me at the link below or just reply and we can find a time.\n\n[Calendly Link]`,
  },
  summerBridge: {
    label: "🌴 FL Summer Bridge (Long)",
    states: "Florida only",
    subject: "Let's simplify your Summer Bridge program",
    body: `Hello [First Name],\n\nThe summer before kindergarten is one of the most critical windows in a child's educational journey.\n\nExperience Curriculum, powered by brightwheel, is the perfect solution for Florida's Summer Bridge Program. Everything teachers need is delivered in a ready-to-use kit, including lesson plans, materials, and student supplies for a classroom of 12.\n\nAt $249 for 4 weeks and $399 for 8 weeks, Experience Curriculum is priced to address the budgetary challenges many programs are facing.\n\nFor Summer Bridge, Experience Curriculum is a strong fit:\n• Aligned to Florida's Early Learning and Developmental Standards; emergent literacy instruction is grounded in the science of reading and built into every lesson\n• Easy to Implement: Whether your staff includes seasoned veterans or teachers just finding their footing, Experience Curriculum is ready to run from day one with access to free onboarding & training.\n• Built-in progress monitoring: Student observations and attendance documentation are integrated through the Brightwheel app.\n\n[Learn More Link] if your program is planning summer readiness or transition programming for VPK students.\n\nI'd be happy to share a quick overview or send sample materials. Use the link below to schedule a quick connect.\n\n[Calendly Link]`,
  },
  summerBridgeShort: {
    label: "🌴 FL Summer Bridge (Short)",
    states: "Florida only",
    subject: "Experience Curriculum Simplifies Summer",
    body: `Hi [First Name],\n\nAre you planning for summer transition to Kindergarten?\n\nExperience Curriculum, powered by brightwheel, is the perfect solution.\n• Everything teachers need is delivered in a ready-to-use kit, including lesson plans, materials, and student supplies for a classroom of 12\n• It's aligned to Florida's Early Learning and Developmental Standards\n• Progress monitoring ties directly into the Brightwheel app, so there's minimal setup for teachers\n• Free online professional development\n\nPricing is $249 for 4 week programs or $399 for 8 week programs.\n\nHappy to send additional materials or jump on a quick call if it's helpful. Schedule time with me at the link below or just reply and we can find a time.\n\n[Calendly Link]`,
  },
};
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
  AZ: "kevin.elston@mybrightwheel.com",
  UT: "kevin.elston@mybrightwheel.com",
  CO: "kevin.elston@mybrightwheel.com",
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

function buildUnsubUrl(name, email, district, districtId) {
  return `${UNSUB_PAGE}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&district=${encodeURIComponent(district)}&districtId=${encodeURIComponent(districtId || "")}`;
}

function buildHtmlEmail(subject, bodyHtml, unsubUrl, rep) {
  const unsubFooter = unsubUrl
    ? `<div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#b0b7c3;text-align:center;">Don't want to receive these emails?&nbsp;<a href="${unsubUrl}" style="color:#b0b7c3;text-decoration:underline;">Unsubscribe</a></div>`
    : "";
  const html = `<!DOCTYPE html><html><body style="${S.wrap}">${bodyHtml}${emailSignature(rep)}${unsubFooter}</body></html>`;
  return `Subject: ${subject}\n\n${html}`;
}

// ─── GRANOLA HELPERS ─────────────────────────────────────────────────────────
// Recursively extract plain text from a ProseMirror JSON document node
function pmToText(node) {
  if (!node) return "";
  if (node.text) return node.text;
  if (Array.isArray(node.content)) {
    const sep = node.type === "paragraph" || node.type === "heading" ? "\n" : " ";
    return node.content.map(pmToText).join(sep);
  }
  return "";
}

// Strip common district name suffixes for fuzzy matching
function normalizeDistName(name) {
  return name.toLowerCase()
    .replace(/\b(school district|county school district|county schools|public schools|city schools|independent school district|unified school district|community school district|community schools|schools|district|isd|usd)\b/gi, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();
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
  score += Math.min((d.buyingSignals || []).length * 3, 15);

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
    name:  district.contactEdits?.director ?? district.director,
    email: district.contactEdits?.email ?? district.email,
    isSummerBridge: false,
  };
}

function generateEmail(district, template, rep) {
  // Use the explicitly passed rep (may be null = not logged in → generic signature)
  const r = rep !== undefined ? rep : null;
  const contact = resolveContact(district, template);

  const stateCode = district.state || "FL";
  const STATE_NAMES = { FL: "Florida", AL: "Alabama", ID: "Idaho", NV: "Nevada", CA: "California", OR: "Oregon", NM: "New Mexico", GA: "Georgia", MI: "Michigan", WA: "Washington", AZ: "Arizona", UT: "Utah", CO: "Colorado" };
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
  const unsubUrl = buildUnsubUrl(unsubRecipientName, unsubRecipientEmail, district.district, district.id);

  const templates = {
    // ── Original Email (all states) ───────────────────────────────────────────
    original: buildHtmlEmail(
      `Improve Kindergarten Readiness Scores`,
      hiGreeting +
      ep(`Many districts are looking for ways to increase Kindergarten readiness scores and support students transitioning into Kindergarten.`) +
      ep(`Brightwheel's Experience Preschool is a flexible, play-based curriculum designed to support 4–8 week summer programs that help incoming Kindergarten students build the skills measured in readiness assessments. Because lessons are pre-packaged and organized by the day, many districts use it for summer programs.`) +
      ep(`${ea(r?.learnMoreUrl || LEARN_MORE_URL, "Click here to learn more")} if your program is planning summer readiness or transition programming.`) +
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
      ep(`${ea(r?.learnMoreUrl || LEARN_MORE_URL, "Click here to learn more")} if your program is planning summer readiness or transition programming for VPK students.`) +
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
      ep(`${ea(r?.learnMoreUrl || LEARN_MORE_URL, "Click here to learn more")} if your program is planning summer readiness or transition programming for VPK students.`) +
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

// ─── OVERRIDE EMAIL GENERATION ───────────────────────────────────────────────
// Builds an HTML email from a manually edited template override.
// override must have { subject, body, _templateKey }.
// Tokens supported in subject + body: [First Name], [State Name], [District Name],
// [Calendly Link], [Learn More Link]
function generateEmailFromOverride(override, district, rep) {
  const r = rep !== undefined ? rep : null;
  const isSB = override._templateKey === "summerBridge" || override._templateKey === "summerBridgeShort";
  const greetingName = (isSB && district.summerBridgeContact)
    ? district.summerBridgeContact.firstName
    : district.director.split(" ")[0];
  const STATE_NAMES = { FL: "Florida", AL: "Alabama", ID: "Idaho", NV: "Nevada", CA: "California", OR: "Oregon", NM: "New Mexico", GA: "Georgia", MI: "Michigan", WA: "Washington", AZ: "Arizona", UT: "Utah", CO: "Colorado" };
  const stateName = STATE_NAMES[district.state || "FL"] || district.state || "FL";
  const shortName = district.district.includes(" — ") ? district.district.split(" — ").slice(1).join(" — ") : district.district;
  const calendlyHtml = r && r.calendly ? ea(r.calendly, "Schedule time with me →") : "Happy to find a time — just reply and we can schedule a quick connect.";
  const learnMoreHtml = ea(r?.learnMoreUrl || LEARN_MORE_URL, "Click here to learn more");
  const unsubName  = (isSB && district.summerBridgeContact) ? district.summerBridgeContact.fullName : district.director;
  const unsubEmail = (isSB && district.summerBridgeContact) ? district.summerBridgeContact.email : district.email;
  const unsubUrl   = buildUnsubUrl(unsubName, unsubEmail, district.district, district.id);

  const substituteTokens = (str) => str
    .replace(/\[First Name\]/g, greetingName)
    .replace(/\[State Name\]/g, stateName)
    .replace(/\[District Name\]/g, shortName)
    .replace(/\[Calendly Link\]/g, calendlyHtml)
    .replace(/\[Learn More Link\]/g, learnMoreHtml)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[color=(#[0-9a-fA-F]{3,6})\]([^\[]*)\[\/color\]/g, '<span style="color:$1">$2</span>');

  const segments = override.body.split(/\n\n+/);
  let htmlBody = "";
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const lines = trimmed.split("\n");
    const isList = lines.length > 1 && lines.every(l => /^[•\-\*]/.test(l.trim()));
    if (isList) {
      const items = lines.map(l => `<li style="${S.li}">${substituteTokens(l.replace(/^[•\-\*]\s*/, ""))}</li>`).join("");
      htmlBody += `<ul style="${S.ul}">${items}</ul>`;
    } else {
      htmlBody += ep(substituteTokens(trimmed));
    }
  }

  const subject = substituteTokens(override.subject);
  return buildHtmlEmail(subject, htmlBody, unsubUrl, r);
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
  const unsubUrl = buildUnsubUrl(district.director, district.email, district.district, district.id);

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

// ─── CONTACTS PANEL COMPONENT ─────────────────────────────────────────────────
function ContactsPanel({ district, bounces, onUpdate, onMarkBounced }) {
  const [editTarget, setEditTarget] = React.useState(null);
  const [draft, setDraft] = React.useState({});

  const mainEmail = district.contactEdits?.email ?? district.email ?? "";
  const mainPhone = district.contactEdits?.phone ?? district.phone ?? "";
  const mainName  = district.contactEdits?.director ?? district.director ?? "";
  const mainTitle = district.contactEdits?.title ?? district.title ?? "";

  const additionalContacts = district.additionalContacts || [];

  const saveMainEdit = () => {
    onUpdate({ contactEdits: { ...draft } });
    setEditTarget(null);
  };

  const saveNewContact = () => {
    if (!draft.name?.trim()) return;
    const newC = {
      id: `contact_${Date.now()}`,
      name: draft.name.trim(),
      firstName: draft.firstName?.trim() || draft.name.trim().split(" ")[0],
      title: draft.title?.trim() || "",
      email: draft.email?.trim() || "",
      phone: draft.phone?.trim() || "",
      role: draft.role?.trim() || "",
      isBounced: false,
    };
    onUpdate({ additionalContacts: [...additionalContacts, newC] });
    setEditTarget(null);
    setDraft({});
  };

  const saveContactEdit = (contactId) => {
    onUpdate({
      additionalContacts: additionalContacts.map(c =>
        c.id === contactId ? { ...c, ...draft } : c
      )
    });
    setEditTarget(null);
  };

  const deleteContact = (contactId) => {
    if (!window.confirm("Remove this contact?")) return;
    onUpdate({ additionalContacts: additionalContacts.filter(c => c.id !== contactId) });
  };

  const makePrimary = (contactId) => {
    const contact = additionalContacts.find(c => c.id === contactId);
    if (!contact) return;
    // Build the old primary as an additional contact entry (if it has a name)
    const oldPrimaryEntry = mainName ? {
      id: `contact_${Date.now()}`,
      name: mainName,
      firstName: mainName.split(" ")[0],
      title: mainTitle,
      email: mainEmail,
      phone: mainPhone,
      role: "Former Primary",
      isBounced: false,
    } : null;
    const newAdditional = additionalContacts
      .filter(c => c.id !== contactId)
      .concat(oldPrimaryEntry ? [oldPrimaryEntry] : []);
    onUpdate({
      contactEdits: { director: contact.name, title: contact.title, email: contact.email, phone: contact.phone },
      additionalContacts: newAdditional,
    });
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200";
  const labelCls = "text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-0.5";

  const ContactField = ({ label, value, href }) => (
    <div className="flex gap-1.5 items-baseline">
      <span className="text-gray-400 text-xs w-12 flex-shrink-0">{label}</span>
      {href
        ? <a href={href} className="text-indigo-600 hover:underline text-xs font-medium truncate">{value || "—"}</a>
        : <span className="text-xs font-medium text-gray-800 truncate">{value || <span className="text-gray-300">—</span>}</span>
      }
    </div>
  );

  return (
    <div className="space-y-3">

      {/* ── Main Director Contact ── */}
      <div className={`rounded-xl border overflow-hidden ${bounces.has(mainEmail.toLowerCase()) ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-white"}`}>
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">Primary Contact</span>
            {bounces.has(mainEmail.toLowerCase()) && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠️ Bounced</span>
            )}
          </div>
          {editTarget !== "main" && (
            <button
              onClick={() => { setEditTarget("main"); setDraft({ director: mainName, title: mainTitle, email: mainEmail, phone: mainPhone }); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >✏️ Edit</button>
          )}
        </div>

        {editTarget === "main" ? (
          <div className="p-4 grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Name</label><input value={draft.director || ""} onChange={e => setDraft(p => ({...p, director: e.target.value}))} className={inputCls} /></div>
            <div><label className={labelCls}>Title</label><input value={draft.title || ""} onChange={e => setDraft(p => ({...p, title: e.target.value}))} className={inputCls} /></div>
            <div><label className={labelCls}>Email</label><input value={draft.email || ""} onChange={e => setDraft(p => ({...p, email: e.target.value}))} className={inputCls} placeholder="email@district.edu" /></div>
            <div><label className={labelCls}>Phone</label><input value={draft.phone || ""} onChange={e => setDraft(p => ({...p, phone: e.target.value}))} className={inputCls} placeholder="(555) 000-0000" /></div>
            <div className="col-span-2 flex justify-between items-center pt-1">
              {mainEmail && !bounces.has(mainEmail.toLowerCase()) && (
                <button onClick={() => { onMarkBounced(mainEmail); setEditTarget(null); }}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">⚠️ Mark as bounced</button>
              )}
              {!mainEmail && <span />}
              <div className="flex gap-2">
                <button onClick={() => setEditTarget(null)} className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={saveMainEdit} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium">Save</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-1.5">
            <ContactField label="Name" value={mainName} />
            <ContactField label="Title" value={mainTitle} />
            <ContactField label="Email" value={mainEmail} href={mainEmail ? `mailto:${mainEmail}` : null} />
            <ContactField label="Phone" value={mainPhone} />
          </div>
        )}
      </div>

      {/* ── Summer Bridge Contact (read-only, shown if exists) ── */}
      {district.summerBridgeContact && (
        <div className="rounded-xl border border-green-200 bg-green-50/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-green-50 border-b border-green-100">
            <span className="text-xs font-semibold text-green-700">🌴 Summer Bridge Contact</span>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <ContactField label="Name" value={district.summerBridgeContact.fullName} />
            <ContactField label="Email" value={district.summerBridgeContact.email} href={district.summerBridgeContact.email ? `mailto:${district.summerBridgeContact.email}` : null} />
          </div>
        </div>
      )}

      {/* ── Additional Contacts ── */}
      {additionalContacts.map(c => (
        <div key={c.id} className={`rounded-xl border overflow-hidden ${bounces.has((c.email||"").toLowerCase()) ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">{c.role || "Additional Contact"}</span>
              {bounces.has((c.email||"").toLowerCase()) && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠️ Bounced</span>
              )}
            </div>
            {editTarget !== c.id && (
              <div className="flex gap-2 items-center">
                {c.email && (
                  <button
                    onClick={() => makePrimary(c.id)}
                    title="Make this the primary contact"
                    className="text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:bg-amber-50 px-2 py-0.5 rounded font-medium"
                  >⭐ Make Primary</button>
                )}
                <button onClick={() => { setEditTarget(c.id); setDraft({ name: c.name, firstName: c.firstName, title: c.title, email: c.email, phone: c.phone, role: c.role }); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">✏️ Edit</button>
                <button onClick={() => deleteContact(c.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">✕</button>
              </div>
            )}
          </div>

          {editTarget === c.id ? (
            <div className="p-4 grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Name</label><input value={draft.name || ""} onChange={e => setDraft(p => ({...p, name: e.target.value}))} className={inputCls} /></div>
              <div><label className={labelCls}>Role / Label</label><input value={draft.role || ""} onChange={e => setDraft(p => ({...p, role: e.target.value}))} className={inputCls} placeholder="e.g. VPK Coordinator" /></div>
              <div><label className={labelCls}>Title</label><input value={draft.title || ""} onChange={e => setDraft(p => ({...p, title: e.target.value}))} className={inputCls} /></div>
              <div><label className={labelCls}>First Name</label><input value={draft.firstName || ""} onChange={e => setDraft(p => ({...p, firstName: e.target.value}))} className={inputCls} /></div>
              <div><label className={labelCls}>Email</label><input value={draft.email || ""} onChange={e => setDraft(p => ({...p, email: e.target.value}))} className={inputCls} /></div>
              <div><label className={labelCls}>Phone</label><input value={draft.phone || ""} onChange={e => setDraft(p => ({...p, phone: e.target.value}))} className={inputCls} /></div>
              <div className="col-span-2 flex justify-between items-center pt-1">
                {c.email && !bounces.has(c.email.toLowerCase()) && (
                  <button onClick={() => { onMarkBounced(c.email); onUpdate({ additionalContacts: additionalContacts.map(x => x.id === c.id ? {...x, isBounced: true} : x) }); setEditTarget(null); }}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">⚠️ Mark as bounced</button>
                )}
                {!c.email && <span />}
                <div className="flex gap-2">
                  <button onClick={() => setEditTarget(null)} className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={() => saveContactEdit(c.id)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium">Save</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-1.5">
              <ContactField label="Name" value={c.name} />
              {c.title && <ContactField label="Title" value={c.title} />}
              <ContactField label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : null} />
              {c.phone && <ContactField label="Phone" value={c.phone} />}
            </div>
          )}
        </div>
      ))}

      {/* ── Add Contact Form ── */}
      {editTarget === "new" ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <span className="text-xs font-semibold text-indigo-700">Add Contact</span>
            <button onClick={() => { setEditTarget(null); setDraft({}); }} className="text-gray-400 hover:text-gray-600 text-sm font-bold">✕</button>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Name *</label><input value={draft.name || ""} onChange={e => setDraft(p => ({...p, name: e.target.value}))} className={inputCls} placeholder="Full name" autoFocus /></div>
            <div><label className={labelCls}>Role / Label</label><input value={draft.role || ""} onChange={e => setDraft(p => ({...p, role: e.target.value}))} className={inputCls} placeholder="e.g. VPK Coordinator" /></div>
            <div><label className={labelCls}>Title</label><input value={draft.title || ""} onChange={e => setDraft(p => ({...p, title: e.target.value}))} className={inputCls} /></div>
            <div><label className={labelCls}>First Name</label><input value={draft.firstName || ""} onChange={e => setDraft(p => ({...p, firstName: e.target.value}))} className={inputCls} /></div>
            <div><label className={labelCls}>Email</label><input value={draft.email || ""} onChange={e => setDraft(p => ({...p, email: e.target.value}))} className={inputCls} placeholder="email@district.edu" /></div>
            <div><label className={labelCls}>Phone</label><input value={draft.phone || ""} onChange={e => setDraft(p => ({...p, phone: e.target.value}))} className={inputCls} placeholder="(555) 000-0000" /></div>
            <div className="col-span-2 flex justify-end gap-2 pt-1">
              <button onClick={() => { setEditTarget(null); setDraft({}); }} className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
              <button disabled={!draft.name?.trim()} onClick={saveNewContact}
                className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium">Add Contact</button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setEditTarget("new"); setDraft({}); }}
          className="w-full text-xs border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 font-medium"
        >➕ Add Contact</button>
      )}
    </div>
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
  const [globalRepFilter, setGlobalRepFilter] = useState("all");
  const [ovActivityWindow, setOvActivityWindow] = useState("7d");
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCurriculum, setFilterCurriculum] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSalesforce, setFilterSalesforce] = useState("all"); // "all" | "in_sf" | "not_in_sf"
  const [filterEnrollment, setFilterEnrollment] = useState("all"); // "all" | "lt500" | "500to1k" | "1kto3k" | "3kplus"
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
  const [campaignFilter, setCampaignFilter] = useState("summer_outreach");
  const [seqStageFilter, setSeqStageFilter] = useState(null); // null = all; stage key or "not_started" = filtered

  // ── CAMPAIGN ENROLLMENTS ──
  // { [campaignKey]: { [districtId]: isoEnrollmentDate } }
  const [campaignEnrollments, setCampaignEnrollments] = useState(() => {
    try {
      const saved = localStorage.getItem('bw_campaign_enrollments_v1');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return {};
  });
  const [showEnrollPanel, setShowEnrollPanel] = useState(false);
  const [enrollSearch, setEnrollSearch] = useState("");
  const [enrollStateFilter, setEnrollStateFilter] = useState("all");
  const [enrollRepFilter, setEnrollRepFilter] = useState("all");
  const [enrollPriorityFilter, setEnrollPriorityFilter] = useState("all");
  const [enrollSelected, setEnrollSelected] = useState(new Set());

  // ── SEQUENCE TAB FILTERS ──
  const [seqStateFilter, setSeqStateFilter] = useState("all");
  const [seqRepFilter, setSeqRepFilter] = useState("all");

  // ── DISTRICT INFO TAB ──
  const [diInfoState, setDiInfoState] = useState("all");
  const [diInfoSearch, setDiInfoSearch] = useState("");
  const [diInfoSelectedId, setDiInfoSelectedId] = useState(null);
  const [diInfoEmailTemplate, setDiInfoEmailTemplate] = useState("original");
  const [diInfoContactId, setDiInfoContactId] = useState(null); // null = primary; contact.id = additional contact
  const [diInfoShowResults, setDiInfoShowResults] = useState(false);

  // ── CONTACT TRACKING ──
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilterState, setContactFilterState] = useState("all");
  // contactFilterRep removed — use globalRepFilter instead
  const [expandedContactId, setExpandedContactId] = useState(null);
  const [inlineActivity, setInlineActivity] = useState({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });

  // ── GMAIL SYNC ──
  const [syncedMsgIds, setSyncedMsgIds] = useState(new Set()); // dedup Gmail message IDs

  // ── SHARED SHEET SYNC ──
  const [sheetConnected, setSheetConnected] = useState(false);
  const [sheetSyncing, setSheetSyncing] = useState(false);

  // ── GRANOLA SYNC ──
  const [granolaToken, setGranolaToken] = useState(null);
  const [granolaConnected, setGranolaConnected] = useState(false);
  const [granolaSyncing, setGranolaSyncing] = useState(false);
  const [granolaLastSync, setGranolaLastSync] = useState(null);
  const [granolaModalOpen, setGranolaModalOpen] = useState(false);
  const [granolaTokenInput, setGranolaTokenInput] = useState("");
  const [syncedGranolaIds, setSyncedGranolaIds] = useState(new Set());
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // ── GMAIL OAUTH ──
  const [gmailToken, setGmailToken] = useState(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailUser, setGmailUser] = useState(null); // logged-in email, used to pick rep profile
  const [gisReady, setGisReady] = useState(false);
  const pendingDraftRef = useRef(null);

  // ── TEMPLATE OVERRIDES ───────────────────────────────────────────────────────
  // Editable email copy stored in localStorage + shared sheet.
  // { [templateKey]: { subject, body, lastEditedBy, lastEditedAt } }
  const [templateOverrides, setTemplateOverrides] = useState(() => {
    try { const s = localStorage.getItem("bw_template_overrides_v1"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editDraft, setEditDraft] = useState({ subject: "", body: "" });

  // ── CUSTOM EMAIL TEMPLATES ───────────────────────────────────────────────────
  // User-created templates stored in localStorage.
  // { [id]: { label, states, subject, body, createdBy, createdAt } }
  const [customTemplates, setCustomTemplates] = useState(() => {
    try { const s = localStorage.getItem("bw_custom_templates_v1"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTemplateDraft, setNewTemplateDraft] = useState({ label: "", statesArr: ["all"], subject: "", body: "" });
  const [editingCustomTemplate, setEditingCustomTemplate] = useState(null);
  const [customEditDraft, setCustomEditDraft] = useState({ label: "", statesArr: ["all"], subject: "", body: "" });
  const newTemplateBodyRef = React.useRef(null);
  const customEditBodyRef = React.useRef(null);

  // ── CUSTOM SEQUENCES ─────────────────────────────────────────────────────────
  // User-built sequences stored in localStorage.
  const [customSequences, setCustomSequences] = useState(() => {
    try { const s = localStorage.getItem("bw_custom_sequences_v1"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  const [editingSequenceId, setEditingSequenceId] = useState(null); // null = new
  const [seqDraft, setSeqDraft] = useState({ label: "", description: "", steps: [] });

  // ── SHARED DISTRICT NOTES ────────────────────────────────────────────────────
  // Persisted per-district sticky notes stored in the activity sheet as
  // type="district_note". Visible to anyone who opens the dashboard.
  // { [districtId]: { text, updatedBy, updatedAt } }
  const [districtNotes, setDistrictNotes] = useState({});
  // Local edits buffered before save (keyed by districtId)
  const [districtNoteEdits, setDistrictNoteEdits] = useState({});

  // ── UNSUBSCRIBE TRACKING ──────────────────────────────────────────────────────
  // Set of lowercase email addresses that have opted out via the unsubscribe link.
  // Populated from the shared activity sheet on startup (no login required).
  const [unsubs, setUnsubs] = useState(new Set());
  // When non-null, shows a confirmation dialog before sending to an unsub'd contact.
  // { district, template, contactEmail, contactName }
  const [unsubConfirm, setUnsubConfirm] = useState(null);

  // ── BOUNCE TRACKING ───────────────────────────────────────────────────────────
  // Set of lowercase email addresses where delivery has failed (hard bounce).
  const [bounces, setBounces] = useState(() => {
    try { const s = localStorage.getItem("bw_bounces_v1"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const [bounceConfirm, setBounceConfirm] = useState(null); // { district, template, contactEmail, contactName }

  // ── CONTACT MANAGEMENT ───────────────────────────────────────────────────────
  const [contactEditingId, setContactEditingId] = useState(null);   // districtId being edited
  const [contactEditTarget, setContactEditTarget] = useState(null); // "main" | contact.id
  const [contactDraft, setContactDraft] = useState({});
  const [contactAddingId, setContactAddingId] = useState(null);     // districtId for add form
  const [newContactDraft, setNewContactDraft] = useState({ name: "", firstName: "", title: "", email: "", phone: "", role: "" });

  // Rep profile for the currently logged-in user — null if not signed in or unrecognized
  const currentRep = (gmailUser && REP_PROFILES[gmailUser]) || null;
  const canEditEmailCopy = gmailUser && AUTHORIZED_EDITORS.has(gmailUser);

  // Merge built-in CAMPAIGNS with user-created custom sequences
  const allCampaigns = useMemo(() => ({
    ...CAMPAIGNS,
    ...Object.fromEntries(Object.entries(customSequences).map(([id, seq]) => [id, { ...seq, isCustom: true }]))
  }), [customSequences]);

  // Wrapper that uses a saved template override when available, otherwise falls
  // back to the hardcoded generateEmail function.
  const getEmailBody = (district, template, rep) => {
    if (templateOverrides[template]) {
      return generateEmailFromOverride({ ...templateOverrides[template], _templateKey: template }, district, rep);
    }
    return generateEmail(district, template, rep);
  };

  const [emailPickerId, setEmailPickerId] = useState(null); // must be declared before the useEffect below

  // ── LOCALSTORAGE PERSISTENCE ─────────────────────────────────────────────────
  // Load saved activities immediately on mount (no network / login required)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bw_gov_activities_v2');
      if (!saved) return;
      const actMap = JSON.parse(saved);
      setDistricts(prev => prev.map(d => {
        const entry = actMap[String(d.id)];
        if (!entry) return d;
        const existingIds = new Set((d.activities || []).map(a => String(a.id)));
        const fresh = (entry.activities || []).filter(a => !existingIds.has(String(a.id)));
        const status = entry.status ? (LEGACY_STAGE_MAP[entry.status] || entry.status) : d.status;
        return {
          ...d,
          activities: fresh.length ? [...(d.activities || []), ...fresh] : d.activities,
          status,
          mailerSent: entry.mailerSent || d.mailerSent || false,
          additionalContacts: entry.additionalContacts || d.additionalContacts || [],
          contactEdits: entry.contactEdits || d.contactEdits || null,
        };
      }));
    } catch(e) { console.warn('localStorage load:', e); }
  }, []);

  // Save activities to localStorage whenever district state changes
  useEffect(() => {
    try {
      const actMap = {};
      districts.forEach(d => {
        if ((d.activities || []).length > 0 || (d.status && d.status !== 'not_started') || d.mailerSent || (d.additionalContacts?.length > 0) || d.contactEdits) {
          actMap[String(d.id)] = {
            activities: d.activities || [],
            status: d.status,
            mailerSent: d.mailerSent || false,
            additionalContacts: d.additionalContacts?.length ? d.additionalContacts : undefined,
            contactEdits: d.contactEdits || undefined,
          };
        }
      });
      if (Object.keys(actMap).length > 0) {
        localStorage.setItem('bw_gov_activities_v2', JSON.stringify(actMap));
      }
    } catch(e) {}
  }, [districts]);

  // Persist campaign enrollments to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem('bw_campaign_enrollments_v1', JSON.stringify(campaignEnrollments)); } catch(e) {}
  }, [campaignEnrollments]);

  // Persist template overrides to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem("bw_template_overrides_v1", JSON.stringify(templateOverrides)); } catch(e) {}
  }, [templateOverrides]);

  // Persist custom templates to localStorage
  useEffect(() => {
    try { localStorage.setItem("bw_custom_templates_v1", JSON.stringify(customTemplates)); } catch(e) {}
  }, [customTemplates]);

  // Persist custom sequences to localStorage
  useEffect(() => {
    try { localStorage.setItem("bw_custom_sequences_v1", JSON.stringify(customSequences)); } catch(e) {}
  }, [customSequences]);

  // Persist bounces to localStorage
  useEffect(() => {
    try { localStorage.setItem("bw_bounces_v1", JSON.stringify([...bounces])); } catch(e) {}
  }, [bounces]);

  // Migrate any legacy status values to sequence stage keys
  useEffect(() => {
    setDistricts(prev => prev.map(d => {
      const migrated = LEGACY_STAGE_MAP[d.status];
      return migrated ? { ...d, status: migrated } : d;
    }));
  }, []); // runs once on mount, after localStorage load

  // ── LOAD PERSISTED ACTIVITY LOG ON STARTUP ──────────────────────────────────
  // Fetches all shared team activity so it's visible to anyone who opens the
  // dashboard — no Gmail sign-in required.
  // Priority: ACTIVITY_WEBAPP_URL (live from Google Sheet) → activity_log.json (static fallback)
  useEffect(() => {
    const url = ACTIVITY_WEBAPP_URL
      ? ACTIVITY_WEBAPP_URL
      : "https://bw-gov.github.io/gov_ece_gtm/data/activity_log.json?_=" + Date.now();
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null)
      .then((log) => {
        if (!log || !Array.isArray(log.activities) || log.activities.length === 0) return;
        // Split district notes, unsubscribes, bounces, and regular activities before merging
        const fetchedNotes = {};
        const fetchedUnsubs = new Set();
        const fetchedBounces = new Set();
        const regularActivities = [];
        log.activities.forEach((a) => {
          if (a.type === "district_note") {
            const existing = fetchedNotes[a.districtId];
            if (!existing || (a.loggedAt || "") > (existing.updatedAt || "")) {
              fetchedNotes[a.districtId] = { text: a.notes || "", updatedBy: a.repEmail || "", updatedAt: a.loggedAt || "" };
            }
          } else if (a.type === "unsubscribe") {
            // Email may be in notes (col F) or district (col C) depending on how the row was written
            const fromNotes    = (a.notes    || "").toLowerCase().trim();
            const fromDistrict = (a.district || "").toLowerCase().trim();
            const unsubEmail   = (fromNotes.includes("@") ? fromNotes : null)
                              || (fromDistrict.includes("@") ? fromDistrict : null);
            if (unsubEmail) fetchedUnsubs.add(unsubEmail);
          } else if (a.type === "bounce") {
            const fromNotes    = (a.notes    || "").toLowerCase().trim();
            const fromDistrict = (a.district || "").toLowerCase().trim();
            const bounceEmail  = (fromNotes.includes("@") ? fromNotes : null)
                              || (fromDistrict.includes("@") ? fromDistrict : null);
            if (bounceEmail) fetchedBounces.add(bounceEmail);
          } else {
            regularActivities.push(a);
          }
        });
        if (Object.keys(fetchedNotes).length > 0) setDistrictNotes(prev => ({ ...prev, ...fetchedNotes }));
        if (fetchedUnsubs.size > 0) setUnsubs(prev => new Set([...prev, ...fetchedUnsubs]));
        if (fetchedBounces.size > 0) setBounces(prev => new Set([...prev, ...fetchedBounces]));
        // Pre-populate synced IDs so browser sync doesn't re-log these
        setSyncedMsgIds(new Set(regularActivities.map((a) => a.gmailMsgId).filter(Boolean)));
        setLastSyncTime(log.lastSynced ? new Date(log.lastSynced).toLocaleTimeString() : null);
        // Merge regular activities into district state (deduped by activity id or gmailMsgId)
        setDistricts((prev) => {
          const updated = [...prev];
          regularActivities.forEach((activity) => {
            const idx = updated.findIndex((d) => d.id === activity.districtId);
            if (idx === -1) return;
            const d = updated[idx];
            const alreadyExists = (d.activities || []).some((a) =>
              (activity.id && String(a.id) === String(activity.id)) ||
              (a.gmailMsgId && activity.gmailMsgId && a.gmailMsgId === activity.gmailMsgId)
            );
            if (alreadyExists) return;
            const newStatus = activity.source === "gmail_reply"
              ? (["email_sent","mailer_queued","vm_left","not_started"].includes(d.status) ? "responded" : d.status)
              : ((d.status === "not_started" || !d.status) ? "email_sent" : d.status);
            updated[idx] = { ...d, activities: [...(d.activities || []), activity], status: newStatus };
          });
          return updated;
        });
        setActivityLog((prev) => [...regularActivities, ...prev]);
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
      scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/spreadsheets",
      prompt: "consent",
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
          // Load sheet first (populates syncedMsgIds), then run Gmail sync
          if (ACTIVITY_SHEET_ID) {
            setTimeout(() => {
              initSheet(resp.access_token)
                .then(() => loadSheetActivities(resp.access_token))
                .catch(() => {})
                .finally(() => syncGmailActivity(resp.access_token));
            }, 400);
          } else {
            setTimeout(() => syncGmailActivity(resp.access_token), 800);
          }
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
          repEmail: gmailUser || "",
        };
        setDistricts((prev) => prev.map((d) => {
          if (d.id !== item.districtId) return d;
          const already = (d.activities || []).some((a) => a.source === "dashboard" && a.notes === sentActivity.notes && a.date === sentActivity.date);
          if (already) return d;
          return { ...d, activities: [...(d.activities || []), sentActivity], status: (d.status === "not_started" || !d.status) ? "email_sent" : d.status };
        }));
        setActivityLog((prev) => [sentActivity, ...prev]);
        writeToSheet([activityToRow(item.districtId, item.district, { ...sentActivity, repEmail: gmailUser || "" })]);
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
      const effectiveEmail = (d.contactEdits?.email ?? d.email);
      if (effectiveEmail) emailToDistrict[effectiveEmail.toLowerCase().trim()] = d;
      if (d.summerBridgeContact?.email) emailToDistrict[d.summerBridgeContact.email.toLowerCase().trim()] = d;
      (d.additionalContacts || []).forEach(c => {
        if (c.email) emailToDistrict[c.email.toLowerCase().trim()] = d;
      });
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
          repEmail: gmailUser || "",
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
            repEmail: gmailUser || "",
          };
          newActivities.push({ districtId: district.id, activity, isReply: true });
          newSyncedIds.add(stub.id);
          await new Promise(r => setTimeout(r, 50));
        }
      }

      // ── PASS 3: Bounce detection ─────────────────────────────────────────
      // Search for delivery-failure emails from mailer-daemon / postmaster.
      // Match against district emails by looking at the subject line.
      const bounceQuery = `in:inbox after:${afterStr} (from:mailer-daemon OR from:postmaster) (subject:"delivery" OR subject:"undeliverable" OR subject:"failed" OR subject:"returned")`;
      const bounceMsgs = await searchMessages(bounceQuery, 50);
      const newBounceEmails = new Set();
      for (const stub of bounceMsgs) {
        if (newSyncedIds.has(stub.id)) continue;
        const msg = await getMeta(stub.id);
        if (!msg) continue;
        const subject = (msg.headers.subject || "").toLowerCase();
        // Check if any district email appears in the bounce subject
        const matchedDistrict = Object.entries(emailToDistrict).find(([email]) => subject.includes(email));
        if (!matchedDistrict) { newSyncedIds.add(stub.id); continue; }
        const [bouncedEmail, district] = matchedDistrict;
        const dateStr = msg.headers.date ? new Date(msg.headers.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
        const activity = {
          id: stub.id,
          type: "bounce",
          date: dateStr,
          notes: bouncedEmail,
          district: district.district,
          directorName: district.director,
          source: "gmail_bounce",
          gmailMsgId: stub.id,
        };
        newActivities.push({ districtId: district.id, activity });
        newBounceEmails.add(bouncedEmail.toLowerCase());
        newSyncedIds.add(stub.id);
        await new Promise(r => setTimeout(r, 50));
      }
      if (newBounceEmails.size > 0) {
        setBounces(prev => new Set([...prev, ...newBounceEmails]));
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
            ? (["email_sent","mailer_queued","vm_left","not_started"].includes(d.status) ? "responded" : d.status)
            : ((d.status === "not_started" || !d.status) ? "email_sent" : d.status);
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
    const bounceCount = newActivities.filter(a => a.activity.source === "gmail_bounce").length;
    const bounceNote  = bounceCount > 0 ? ` · ${bounceCount} bounce${bounceCount !== 1 ? "s" : ""} detected` : "";
    showNotif(newActivities.length === 0
      ? "Gmail sync complete — no new activity found"
      : `Gmail sync: ${sentCount} sent email${sentCount !== 1 ? "s" : ""} + ${replyCount} repl${replyCount !== 1 ? "ies" : "y"} logged${bounceNote} ✓`
    );
    // Persist new activities to shared sheet
    if (newActivities.length > 0) {
      const rows = newActivities.map(({ districtId, activity }) => {
        const dist = districts.find(d => d.id === districtId);
        return activityToRow(districtId, dist?.district || "", { ...activity, repEmail: gmailUser || "" });
      });
      writeToSheet(rows, useToken);
    }
  };

  // ── GRANOLA ACTIVITY SYNC ─────────────────────────────────────────────────
  // Fetches all documents from the Granola API and matches them to districts
  // by scanning meeting titles and notes for district/director names.
  const syncGranolaActivity = async (token) => {
    const useToken = token || granolaToken;
    if (!useToken) { setGranolaModalOpen(true); return; }
    setGranolaSyncing(true);

    // Build lookup maps for matching
    const normNameToDistrict = {};
    const emailDomainToDistrict = {};
    districts.forEach((d) => {
      const norm = normalizeDistName(d.district);
      if (norm.length >= 4) normNameToDistrict[norm] = d;
      if (d.email) {
        const domain = d.email.split("@")[1];
        if (domain) emailDomainToDistrict[domain.toLowerCase()] = d;
      }
    });

    // Sort normalized names longest-first so "Gwinnett County" matches before "Gwinnett"
    const normNames = Object.keys(normNameToDistrict).sort((a, b) => b.length - a.length);

    const matchDoc = (title, notesText) => {
      const haystack = (title + " " + notesText).toLowerCase();

      // 1. Normalized district name anywhere in title+notes
      for (const norm of normNames) {
        if (norm.length >= 6 && haystack.includes(norm)) return normNameToDistrict[norm];
      }
      // 2. Email domain in notes
      for (const [domain, dist] of Object.entries(emailDomainToDistrict)) {
        if (haystack.includes("@" + domain) || haystack.includes(domain)) return dist;
      }
      // 3. Director last name in meeting title (only if title looks call-like)
      const titleLower = title.toLowerCase();
      const callKeywords = ["meeting", "call", "sync", "connect", "chat", "intro", "demo"];
      if (callKeywords.some((k) => titleLower.includes(k))) {
        for (const d of districts) {
          const lastName = d.director.split(" ").pop();
          if (lastName.length >= 4 && titleLower.includes(lastName.toLowerCase())) return d;
        }
      }
      return null;
    };

    try {
      const res = await fetch("https://api.granola.ai/v2/get-documents", {
        method: "POST",
        headers: { Authorization: "Bearer " + useToken, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.status === 401) {
        setGranolaToken(null); setGranolaConnected(false);
        showNotif("Granola token expired — reconnect", "red");
        setGranolaModalOpen(true);
        setGranolaSyncing(false);
        return;
      }
      if (!res.ok) throw new Error(`Granola API ${res.status}`);

      const payload = await res.json();
      const documents = Array.isArray(payload) ? payload : (payload.documents || payload.data || []);

      let newActivities = [];
      const newSyncedIds = new Set(syncedGranolaIds);

      for (const doc of documents) {
        if (newSyncedIds.has(doc.id)) continue;
        newSyncedIds.add(doc.id);

        const title = (doc.title || "").trim();
        const notesText = pmToText(doc.last_viewed_panel || doc.notes || doc.content || null).trim();
        const dateStr = (doc.created_at || doc.createdAt || "").split("T")[0] || new Date().toISOString().split("T")[0];

        const matched = matchDoc(title, notesText);
        if (!matched) continue;

        const activity = {
          id: doc.id,
          type: "call",
          date: dateStr,
          notes: `📓 Granola: "${title}"`,
          district: matched.district,
          directorName: matched.director,
          source: "granola",
          granolaDocId: doc.id,
          granolaTitle: title,
          granolaNotesText: notesText.slice(0, 2000),
        };
        newActivities.push({ districtId: matched.id, activity });
      }

      if (newActivities.length > 0) {
        setDistricts((prev) => {
          const updated = [...prev];
          newActivities.forEach(({ districtId, activity }) => {
            const idx = updated.findIndex((d) => d.id === districtId);
            if (idx === -1) return;
            const d = updated[idx];
            if ((d.activities || []).some((a) => a.granolaDocId === activity.granolaDocId)) return;
            updated[idx] = {
              ...d,
              activities: [...(d.activities || []), activity],
              status: d.status === "not contacted" ? "reached out" : d.status,
            };
          });
          return updated;
        });
      }

      setSyncedGranolaIds(newSyncedIds);
      setGranolaLastSync(new Date().toLocaleTimeString());
      setGranolaSyncing(false);
      showNotif(
        newActivities.length === 0
          ? "Granola sync — no new matched meetings found"
          : `Granola: ${newActivities.length} meeting${newActivities.length !== 1 ? "s" : ""} matched ✓`
      );
      // Persist new activities to shared sheet
      if (newActivities.length > 0) {
        const rows = newActivities.map(({ districtId, activity }) => {
          const dist = districts.find(d => d.id === districtId);
          return activityToRow(districtId, dist?.district || "", { ...activity, repEmail: gmailUser || "" });
        });
        writeToSheet(rows);
      }
    } catch (e) {
      const isCors = e.message.toLowerCase().includes("fetch") || e.message.toLowerCase().includes("network");
      showNotif(
        isCors
          ? "Granola API blocked — check CORS or use the local sync script"
          : "Granola sync error: " + e.message,
        "red"
      );
      setGranolaSyncing(false);
    }
  };

  // ── SHARED GOOGLE SHEET HELPERS ──────────────────────────────────────────────
  // Low-level fetch wrapper for the Sheets v4 API
  const sheetFetch = async (path, opts = {}) => {
    const useToken = opts.token || gmailToken;
    if (!useToken) throw new Error("no_token");
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ACTIVITY_SHEET_ID}/${path}`, {
      method: opts.method || "GET",
      headers: { Authorization: "Bearer " + useToken, "Content-Type": "application/json" },
      ...(opts.body ? { body: opts.body } : {}),
    });
    if (res.status === 401 || res.status === 403) { const e = new Error("auth"); e.status = res.status; throw e; }
    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = j?.error?.message || JSON.stringify(j); } catch {}
      const e = new Error(`Sheets ${res.status}${detail ? ": " + detail : ""}`);
      e.status = res.status;
      throw e;
    }
    return res.json();
  };

  // Write header row on first use
  const initSheet = async (token) => {
    if (!ACTIVITY_SHEET_ID) return;
    try {
      const data = await sheetFetch("values/Sheet1!A1:L1", { token });
      if (!data.values?.[0] || data.values[0][0] !== "activity_id") {
        await sheetFetch(`values/Sheet1!A1:L1?valueInputOption=RAW`, {
          method: "PUT", token,
          body: JSON.stringify({ values: [SHEET_COLS] }),
        });
      }
      setSheetConnected(true);
    } catch (e) { console.warn("Sheet init:", e.message); }
  };

  // Read all rows → merge into district state (deduped by activity id)
  const loadSheetActivities = async (token) => {
    if (!ACTIVITY_SHEET_ID) return;
    setSheetSyncing(true);
    try {
      const data = await sheetFetch("values/Sheet1", { token });
      const rows = data.values || [];
      if (rows.length < 2) { setSheetConnected(true); setSheetSyncing(false); return; }
      const hdrs = rows[0];
      const col = (row, name) => row[hdrs.indexOf(name)] || "";

      const byDistrict = {};
      const sheetMsgIds = new Set();
      const sheetGranolaIds = new Set();
      // Track latest stage, mailer status, district notes, and unsubscribes from sheet rows
      const latestStage = {};
      const mailerSentMap = {};
      const latestNotes = {};
      const unsubEmails = new Set();
      const bounceEmails = new Set();
      // Template overrides keyed by template key — pick most recent per key
      const sheetTemplateOverrides = {};
      // Custom templates + sequences shared across all reps via the sheet
      const sheetCustomTemplates = {};  // id -> { deleted, loggedAt, data }
      const sheetCustomSequences = {};  // id -> { deleted, loggedAt, data }

      for (const row of rows.slice(1)) {
        // Template override rows — district_id is 0, district_name holds the key
        if (col(row, "type") === "template_override") {
          const key = col(row, "district_name");
          const loggedAt = col(row, "logged_at");
          const existing = sheetTemplateOverrides[key];
          if (key && (!existing || loggedAt > (existing.lastEditedAt || ""))) {
            sheetTemplateOverrides[key] = {
              subject: col(row, "notes"),
              body: col(row, "full_notes"),
              lastEditedBy: col(row, "rep_email"),
              lastEditedAt: loggedAt,
            };
          }
          continue;
        }
        // Custom template rows (created/edited/deleted by any rep)
        if (col(row, "type") === "custom_template" || col(row, "type") === "custom_template_deleted") {
          const id = col(row, "dedup_id") || col(row, "district_name");
          const loggedAt = col(row, "logged_at");
          const existing = sheetCustomTemplates[id];
          if (id && (!existing || loggedAt > (existing.loggedAt || ""))) {
            const isDelete = col(row, "type") === "custom_template_deleted";
            let data = null;
            if (!isDelete) {
              try { data = JSON.parse(col(row, "full_notes")); } catch {}
            }
            sheetCustomTemplates[id] = { deleted: isDelete, loggedAt, data };
          }
          continue;
        }
        // Custom sequence rows (created/edited/deleted by any rep)
        if (col(row, "type") === "custom_sequence" || col(row, "type") === "custom_sequence_deleted") {
          const id = col(row, "dedup_id") || col(row, "district_name");
          const loggedAt = col(row, "logged_at");
          const existing = sheetCustomSequences[id];
          if (id && (!existing || loggedAt > (existing.loggedAt || ""))) {
            const isDelete = col(row, "type") === "custom_sequence_deleted";
            let data = null;
            if (!isDelete) {
              try { data = JSON.parse(col(row, "full_notes")); } catch {}
            }
            sheetCustomSequences[id] = { deleted: isDelete, loggedAt, data };
          }
          continue;
        }
        // Unsubscribes + bounces — checked BEFORE the distId guard because
        // district_id can be 0 if the param was missing when the row was written.
        // Email may be in district_name (col C) or notes (col F) — check both.
        if (col(row, "type") === "unsubscribe" || col(row, "type") === "bounce") {
          const fromNotes    = (col(row, "notes") || "").toLowerCase().trim();
          const fromDistName = (col(row, "district_name") || "").toLowerCase().trim();
          const email = (fromNotes.includes("@") ? fromNotes : null)
                     || (fromDistName.includes("@") ? fromDistName : null);
          if (email) {
            if (col(row, "type") === "unsubscribe") unsubEmails.add(email);
            else bounceEmails.add(email);
          }
          continue;
        }
        const distId = parseInt(col(row, "district_id"));
        if (!distId) continue;
        const src = col(row, "source");
        const type = col(row, "type");
        const dedupId = col(row, "dedup_id");

        // Stage update rows — track the latest stage per district
        if (type === "stage_update") {
          const stageLabel = col(row, "notes").replace("Stage → ", "");
          const stageKey = Object.keys(SEQUENCE_STAGES).find(k => SEQUENCE_STAGES[k].label === stageLabel);
          if (stageKey) latestStage[distId] = stageKey;
          continue;
        }
        // Mailer sent rows
        if (type === "mailer_sent") { mailerSentMap[distId] = true; continue; }
        // Shared district notes — keep only the most recent per district
        if (type === "district_note") {
          const loggedAt = col(row, "logged_at");
          const existing = latestNotes[distId];
          if (!existing || loggedAt > existing.updatedAt) {
            latestNotes[distId] = { text: col(row, "notes"), updatedBy: col(row, "rep_email"), updatedAt: loggedAt };
          }
          continue;
        }

        if (dedupId) {
          if (src === "granola") sheetGranolaIds.add(dedupId);
          else if (src.includes("gmail") || src === "dashboard") sheetMsgIds.add(dedupId);
        }
        const act = {
          id: col(row, "activity_id") || String(Date.now() + Math.random()),
          type: type || "note",
          date: col(row, "date"),
          notes: col(row, "notes"),
          source: src || "sheet",
          repEmail: col(row, "rep_email"),
          directorName: col(row, "director_name"),
          ...(src.includes("gmail") && dedupId ? { gmailMsgId: dedupId } : {}),
          ...(src === "granola" && dedupId ? { granolaDocId: dedupId, granolaTitle: col(row, "notes").replace(/^📓 Granola: "|"$/g, ""), granolaNotesText: col(row, "full_notes") } : {}),
        };
        if (!byDistrict[distId]) byDistrict[distId] = [];
        byDistrict[distId].push(act);
      }

      setDistricts(prev => prev.map(d => {
        const incoming = byDistrict[d.id] || [];
        const existingIds = new Set((d.activities || []).map(a => String(a.id)));
        const fresh = incoming.filter(a => !existingIds.has(String(a.id)));
        const all = fresh.length ? [...(d.activities || []), ...fresh] : (d.activities || []);
        // Determine stage: explicit stage_update > inferred from activities > current
        let newStatus = latestStage[d.id] || d.status || "not_started";
        // migrate legacy values that slipped through
        if (LEGACY_STAGE_MAP[newStatus]) newStatus = LEGACY_STAGE_MAP[newStatus];
        if (!latestStage[d.id] && all.some(a => a.source === "gmail_reply")) newStatus = "responded";
        else if (!latestStage[d.id] && all.some(a => a.type === "email" && a.source !== "gmail_reply") && newStatus === "not_started") newStatus = "email_sent";
        const mailerSent = mailerSentMap[d.id] || d.mailerSent || false;
        if (!fresh.length && newStatus === d.status && mailerSent === d.mailerSent) return d;
        return { ...d, activities: all, status: newStatus, mailerSent };
      }));

      // Pre-populate dedup sets so re-syncing skips already-persisted items
      setSyncedMsgIds(prev => new Set([...prev, ...sheetMsgIds]));
      setSyncedGranolaIds(prev => new Set([...prev, ...sheetGranolaIds]));
      setSheetConnected(true);
      setSheetSyncing(false);
      if (Object.keys(latestNotes).length > 0) {
        setDistrictNotes(prev => ({ ...prev, ...latestNotes }));
      }
      // Apply any template overrides from the sheet (sheet wins over localStorage)
      if (Object.keys(sheetTemplateOverrides).length > 0) {
        setTemplateOverrides(prev => ({ ...prev, ...sheetTemplateOverrides }));
      }
      // Merge custom templates from sheet — tombstone deletes remove local copies
      if (Object.keys(sheetCustomTemplates).length > 0) {
        setCustomTemplates(prev => {
          const next = { ...prev };
          for (const [id, entry] of Object.entries(sheetCustomTemplates)) {
            if (entry.deleted) { delete next[id]; }
            else if (entry.data) { next[id] = entry.data; }
          }
          return next;
        });
      }
      // Merge custom sequences from sheet — tombstone deletes remove local copies
      if (Object.keys(sheetCustomSequences).length > 0) {
        setCustomSequences(prev => {
          const next = { ...prev };
          for (const [id, entry] of Object.entries(sheetCustomSequences)) {
            if (entry.deleted) { delete next[id]; }
            else if (entry.data) { next[id] = { ...entry.data, isCustom: true }; }
          }
          return next;
        });
      }
      if (unsubEmails.size > 0) {
        setUnsubs(prev => new Set([...prev, ...unsubEmails]));
      }
      if (bounceEmails.size > 0) {
        setBounces(prev => new Set([...prev, ...bounceEmails]));
      }
      const total = Object.values(byDistrict).reduce((s, a) => s + a.length, 0);
      showNotif(`Shared log loaded — ${total} activit${total !== 1 ? "ies" : "y"} across team ✓`);
    } catch (e) {
      setSheetSyncing(false);
      console.warn("Sheet load:", e.status, e.message);
    }
  };

  // Convert a single activity to a sheet row array
  const activityToRow = (districtId, districtName, activity) => [
    String(activity.id || Date.now()),
    String(districtId),
    districtName || "",
    activity.type || "note",
    activity.date || new Date().toISOString().split("T")[0],
    activity.notes || "",
    activity.granolaNotesText || "",
    activity.source || "manual",
    activity.repEmail || gmailUser || "",
    activity.directorName || "",
    activity.gmailMsgId || activity.granolaDocId || "",
    new Date().toISOString(),
  ];

  // Append one or more rows to the sheet (fire-and-forget, errors are non-blocking)
  const writeToSheet = async (rows, token) => {
    const useToken = token || gmailToken;
    if (!ACTIVITY_SHEET_ID || !useToken || !rows.length) return;
    try {
      await sheetFetch(`values/Sheet1!A:L:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ values: rows }),
        token: useToken,
      });
    } catch (e) {
      console.warn("Sheet write:", e.message);
      if (e.status === 403) showNotif("Sheet write failed: Sheets API may not be enabled, or the sheet isn't shared with your account", "red");
      else if (e.status === 401) showNotif("Sheet write failed: reconnect Gmail to refresh your token", "red");
      else if (e.status === 400) showNotif(`Sheet write failed (400) — disconnect Gmail and reconnect to refresh your access token, then try again. Detail: ${e.message}`, "red");
      else showNotif(`Sheet write failed: ${e.message}`, "red");
    }
  };

  // Saves a template override to state, localStorage, and the shared sheet.
  const saveTemplateOverride = async (templateKey, subject, body) => {
    const now = new Date().toISOString();
    const override = { subject, body, lastEditedBy: gmailUser || "", lastEditedAt: now };
    setTemplateOverrides(prev => ({ ...prev, [templateKey]: override }));
    // Write to shared sheet as a template_override row
    const row = [
      String(Date.now()),      // activity_id
      "0",                     // district_id (0 = not a district)
      templateKey,             // district_name holds the template key
      "template_override",     // type
      now.split("T")[0],       // date
      subject,                 // notes holds the subject
      body,                    // full_notes holds the body
      "template_override",     // source
      gmailUser || "",         // rep_email
      "",                      // director_name
      templateKey,             // dedup_id
      now,                     // logged_at
    ];
    await writeToSheet([row]);
  };

  // Saves a custom email template to state, localStorage, and the shared sheet.
  // Pass tmplData=null to delete the template (writes a tombstone row).
  const saveCustomTemplate = (id, tmplData) => {
    setCustomTemplates(prev => {
      if (!tmplData) { const n = { ...prev }; delete n[id]; return n; }
      return { ...prev, [id]: tmplData };
    });
    if (!ACTIVITY_SHEET_ID || !gmailToken) return;
    const now = new Date().toISOString();
    const row = [
      String(Date.now()),
      "0",
      id,
      tmplData ? "custom_template" : "custom_template_deleted",
      now.split("T")[0],
      tmplData ? (tmplData.label || "") : "",
      tmplData ? JSON.stringify(tmplData) : "",
      "custom_template",
      gmailUser || "",
      tmplData ? (tmplData.subject || "") : "",
      id,
      now,
    ];
    writeToSheet([row]);
  };

  // Saves a custom sequence to state, localStorage, and the shared sheet.
  // Pass seqData=null to delete the sequence (writes a tombstone row).
  const saveCustomSequence = (id, seqData) => {
    setCustomSequences(prev => {
      if (!seqData) { const n = { ...prev }; delete n[id]; return n; }
      return { ...prev, [id]: seqData };
    });
    if (!ACTIVITY_SHEET_ID || !gmailToken) return;
    const now = new Date().toISOString();
    const row = [
      String(Date.now()),
      "0",
      id,
      seqData ? "custom_sequence" : "custom_sequence_deleted",
      now.split("T")[0],
      seqData ? (seqData.label || "") : "",
      seqData ? JSON.stringify(seqData) : "",
      "custom_sequence",
      gmailUser || "",
      "",
      id,
      now,
    ];
    writeToSheet([row]);
  };

  // ── BULK SELECTION ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTemplate, setBulkTemplate] = useState("summerLong");
  const [showBulkSeqDropdown, setShowBulkSeqDropdown] = useState(false);

  const toggleSelect = (id) =>
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const clearSelection = () => { setSelectedIds(new Set()); setShowBulkSeqDropdown(false); };

  const showNotif = (msg, color = "green") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── FILTERED + SORTED DISTRICTS ──
  const filtered = useMemo(() => {
    const results = districts.filter((d) => {
      const matchSearch =
        (d.district || "").toLowerCase().includes(search.toLowerCase()) ||
        (d.director || "").toLowerCase().includes(search.toLowerCase()) ||
        (d.county || "").toLowerCase().includes(search.toLowerCase());
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
      const matchRep = globalRepFilter === "all" || STATE_REP_EMAIL[d.state || "FL"] === globalRepFilter;
      const matchSalesforce = filterSalesforce === "all" ||
        (filterSalesforce === "in_sf" && d.inSalesforce) ||
        (filterSalesforce === "not_in_sf" && !d.inSalesforce);
      const enr = d.enrollment || 0;
      const matchEnrollment = filterEnrollment === "all" ||
        (filterEnrollment === "lt500"   && enr < 500) ||
        (filterEnrollment === "500to1k" && enr >= 500  && enr < 1000) ||
        (filterEnrollment === "1kto3k"  && enr >= 1000 && enr < 3000) ||
        (filterEnrollment === "3kplus"  && enr >= 3000);
      return matchSearch && matchPriority && matchState && matchCurriculum && matchStatus && matchRep && matchSalesforce && matchEnrollment;
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
  }, [districts, search, filterState, filterPriority, filterCurriculum, filterStatus, sortBy, globalRepFilter, filterSalesforce, filterEnrollment]);

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
    contacted: districts.filter((d) => d.status && d.status !== "not_started").length,
    callQueue: districts.filter((d) => callWindowOpen(d)).length,
    queue: approvalQueue.length,
  }), [districts, approvalQueue]);

  const updateDistrict = (id, updates) => {
    setDistricts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    if (selectedDistrict?.id === id) setSelectedDistrict((prev) => ({ ...prev, ...updates }));
  };

  // Update a district's sequence stage and write to shared sheet
  // Enroll one or more district IDs in a campaign (records today as enrollment date)
  const enrollInCampaign = (campaignKey, districtIds) => {
    const today = new Date().toISOString().split("T")[0];
    setCampaignEnrollments(prev => {
      const existing = prev[campaignKey] || {};
      const updated = { ...existing };
      districtIds.forEach(id => { if (!updated[id]) updated[id] = today; });
      return { ...prev, [campaignKey]: updated };
    });
  };

  // Remove a district from a campaign enrollment
  const unenrollFromCampaign = (campaignKey, districtId) => {
    setCampaignEnrollments(prev => {
      const updated = { ...(prev[campaignKey] || {}) };
      delete updated[districtId];
      return { ...prev, [campaignKey]: updated };
    });
  };

  const updateStage = (districtId, newStage) => {
    const d = districts.find(x => x.id === districtId);
    if (!d) return;
    updateDistrict(districtId, { status: newStage });
    const act = {
      id: Date.now(),
      type: "stage_update",
      date: new Date().toISOString().split("T")[0],
      notes: `Stage → ${SEQUENCE_STAGES[newStage]?.label || newStage}`,
      source: "manual",
      repEmail: gmailUser || "",
      directorName: d.director,
    };
    writeToSheet([activityToRow(districtId, d.district, act)]);
  };

  // Toggle the physical mailer sent flag
  const toggleMailer = (districtId) => {
    const d = districts.find(x => x.id === districtId);
    if (!d) return;
    const newVal = !d.mailerSent;
    const updates = { mailerSent: newVal };
    if (newVal && d.status === "email_sent") updates.status = "mailer_queued";
    updateDistrict(districtId, updates);
    if (newVal) {
      const act = {
        id: Date.now(),
        type: "mailer_sent",
        date: new Date().toISOString().split("T")[0],
        notes: "Physical mailer sent (flyer + highlighter)",
        source: "manual",
        repEmail: gmailUser || "",
        directorName: d.director,
      };
      writeToSheet([activityToRow(districtId, d.district, act)]);
    }
  };

  const saveDistrictNote = (district, text) => {
    const act = {
      id: Date.now(),
      type: "district_note",
      date: new Date().toISOString().split("T")[0],
      notes: text,
      source: "manual",
      repEmail: gmailUser || "",
      directorName: district.director,
    };
    setDistrictNotes(prev => ({
      ...prev,
      [district.id]: { text, updatedBy: gmailUser || "", updatedAt: new Date().toISOString() },
    }));
    setDistrictNoteEdits(prev => { const n = { ...prev }; delete n[district.id]; return n; });
    writeToSheet([activityToRow(district.id, district.district, act)]);
    showNotif("Note saved ✓");
  };

  const addActivity = (district) => {
    if (!newActivity.notes) return;
    const act = { ...newActivity, id: Date.now(), district: district.district, directorName: district.director, repEmail: gmailUser || "", source: "manual" };
    const updatedActivities = [...(district.activities || []), act];
    updateDistrict(district.id, { activities: updatedActivities });
    setActivityLog((prev) => [act, ...prev]);
    setNewActivity({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });
    showNotif("Activity logged ✓");
    writeToSheet([activityToRow(district.id, district.district, act)]);
  };

  const queueEmail = (district, template, silent = false, forceUnsub = false, forceBounce = false, contactOverride = null) => {
    // contactOverride: { name, firstName, email, title, phone } — if provided, use instead of resolveContact
    const contact = contactOverride || resolveContact(district, template);
    if (!contact.email) {
      showNotif(`⚠️ No email on file for ${contact.name || district.director || district.district} — skipped`, "red");
      return;
    }
    // Bounce guard
    const isBounce = bounces.has((contact.email || "").toLowerCase());
    if (isBounce && !forceBounce) {
      if (silent) return;
      setBounceConfirm({ district, template, contactEmail: contact.email, contactName: contact.name, contactOverride });
      return;
    }
    // Unsubscribe guard
    const isUnsub = unsubs.has((contact.email || "").toLowerCase());
    if (isUnsub && !forceUnsub) {
      if (silent) return;
      setUnsubConfirm({ district, template, contactEmail: contact.email, contactName: contact.name, contactOverride });
      return;
    }
    // Patch district so email body greets the right person
    const districtForEmail = contactOverride ? {
      ...district,
      director: contactOverride.name,
      email: contactOverride.email,
      contactEdits: {
        ...(district.contactEdits || {}),
        director: contactOverride.name,
        email: contactOverride.email,
        title: contactOverride.title || "",
        phone: contactOverride.phone || "",
      },
    } : district;
    const body = template === "personalized"
      ? generatePersonalizedEmail(districtForEmail, currentRep)
      : getEmailBody(districtForEmail, template, currentRep);
    if (!body) {
      showNotif(`⚠️ Not enough intel to personalize email for ${district.district}`, "red");
      return;
    }
    const item = {
      id: Date.now() + Math.random(),
      district: district.district,
      districtId: district.id,
      to: contact.email,
      directorName: contact.name,
      isSummerBridgeContact: contact.isSummerBridge || false,
      template,
      body,
      status: "pending",
      createdAt: new Date().toLocaleString(),
    };
    setApprovalQueue((prev) => {
      // Allow multiple contacts from same district — dedupe by district+template+email
      if (prev.find((x) => x.districtId === district.id && x.template === template && x.to === contact.email)) return prev;
      return [item, ...prev];
    });
    if (!silent) showNotif(`📧 Queued for ${contact.name || district.director}`);
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

  const stageColor = (s) => (SEQUENCE_STAGES[s] || SEQUENCE_STAGES.not_started).color;
  // kept for any legacy callsites
  const statusColor = (s) => stageColor(LEGACY_STAGE_MAP[s] || s);


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
          {/* Logged-in rep indicator / sign-in button */}
          {(currentRep || gmailUser) ? (
            <div className="flex items-center gap-2 pl-4 border-l border-gray-200 group cursor-default">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${currentRep ? currentRep.color : "bg-indigo-100 text-indigo-700"}`}>
                {currentRep ? currentRep.initials : (gmailUser || "").split("@")[0].slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700">{currentRep ? currentRep.name : (gmailUser || "").split("@")[0]}</div>
                <div className="text-xs text-gray-400 group-hover:hidden">{currentRep?.title || "Logged in"}</div>
                <button
                  onClick={() => { setGmailToken(null); setGmailConnected(false); setGmailUser(null); showNotif("Disconnected — click Sign in to reconnect", "red"); }}
                  className="hidden group-hover:block text-xs text-red-400 hover:text-red-600 text-left"
                >
                  Disconnect
                </button>
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

          {/* Granola connect */}
          <button
            onClick={() => granolaConnected ? syncGranolaActivity() : setGranolaModalOpen(true)}
            disabled={granolaSyncing}
            className={`flex items-center gap-2 pl-4 border-l border-gray-200 hover:opacity-80 transition-opacity cursor-pointer group ${granolaSyncing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${granolaConnected ? "bg-violet-100 text-violet-700 border-2 border-violet-300" : "bg-gray-100 border-2 border-dashed border-gray-300 text-gray-400 group-hover:border-violet-400 group-hover:text-violet-500"}`}>
              {granolaSyncing ? "…" : "GR"}
            </div>
            <div className="text-left">
              <div className={`text-xs font-semibold ${granolaConnected ? "text-violet-700" : "text-violet-600"}`}>
                {granolaSyncing ? "Syncing…" : granolaConnected ? "Sync Granola" : "Connect Granola"}
              </div>
              <div className="text-xs text-gray-400">
                {granolaLastSync ? `Last sync ${granolaLastSync}` : "call notes & meetings"}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center">
        <div className="flex gap-1 flex-1">
          {[
            { id: "overview", label: "🏠 Overview" },
            { id: "prospects", label: "📋 Prospects" },
            { id: "contacts", label: "👥 Outreach Tracking" },
            { id: "callqueue", label: `🔁 Sequence` },
            { id: "districtinfo", label: "🏫 District Info" },
            { id: "emailcopy", label: "✏️ Email Copy" },
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
        <a
          href="help.html"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span className="font-bold">?</span> How to use
        </a>
      </div>

      <div className="px-6 py-4">
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (() => {
          const STATE_NAMES_OV = { FL: "Florida", AL: "Alabama", ID: "Idaho", NV: "Nevada", CA: "California", OR: "Oregon", NM: "New Mexico", GA: "Georgia", MI: "Michigan", WA: "Washington", AZ: "Arizona", UT: "Utah", CO: "Colorado" };
          const repEmail = globalRepFilter === "all" ? null : globalRepFilter;
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
          const notContacted = ovDistricts.filter(d => !d.status || d.status === "not_started").length;
          const contacted = ovDistricts.filter(d => d.status && d.status !== "not_started").length;
          const hot = ovDistricts.filter(d => d.priority >= 75).length;
          const warm = ovDistricts.filter(d => d.priority >= 55 && d.priority < 75).length;
          const inProgress = ovDistricts.filter(d => ["email_sent","mailer_queued","vm_left","follow_up_sent","closing_sent","responded"].includes(d.status)).length;
          const won = ovDistricts.filter(d => d.status === "responded").length;

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
                  <option value="FL">Florida</option>
                  <option value="AL">Alabama</option>
                  <option value="GA">Georgia</option>
                  <option value="MI">Michigan</option>
                  <option value="ID">Idaho</option>
                  <option value="UT">Utah</option>
                  <option value="CO">Colorado</option>
                  <option value="NV">Nevada</option>
                  <option value="NM">New Mexico</option>
                  <option value="AZ">Arizona</option>
                  <option value="CA">California</option>
                  <option value="OR">Oregon</option>
                  <option value="WA">Washington</option>
                </select>
                <select value={globalRepFilter} onChange={e => setGlobalRepFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
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
                              <td className="px-4 py-2.5 text-right text-gray-500">{sd.filter(d => !d.status || d.status === "not_started").length}</td>
                              <td className="px-4 py-2.5 text-right text-purple-600">{sd.filter(d => ["email_sent","mailer_queued","vm_left","follow_up_sent","closing_sent","responded"].includes(d.status)).length}</td>
                              <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{sd.filter(d => d.status === "responded").length}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Team Activity ── */}
              {(() => {
                const ACT_WINDOWS = [
                  { v: "1d", l: "Today" },
                  { v: "7d", l: "Last 7 days" },
                  { v: "30d", l: "Last 30 days" },
                  { v: "all", l: "All time" },
                ];
                const todayStr = new Date().toISOString().split("T")[0];
                const cutoffStr = ovActivityWindow === "1d"
                  ? todayStr
                  : ovActivityWindow === "7d"
                  ? new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]
                  : ovActivityWindow === "30d"
                  ? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
                  : null;

                const ACT_TYPES = [
                  { key: "email",    label: "✉️ Emails",   color: "text-blue-600",   bg: "bg-blue-50"   },
                  { key: "call",     label: "📞 Calls",    color: "text-green-600",  bg: "bg-green-50"  },
                  { key: "linkedin", label: "🔗 LinkedIn", color: "text-sky-600",    bg: "bg-sky-50"    },
                  { key: "meeting",  label: "📅 Meetings", color: "text-purple-600", bg: "bg-purple-50" },
                  { key: "note",     label: "📝 Notes",    color: "text-gray-600",   bg: "bg-gray-50"   },
                ];

                // Flatten all activities from every district that passes the current
                // state + rep filters (ovDistricts already accounts for both). We
                // attribute each activity to the rep who owns the district's state
                // (fallback when repEmail is blank — covers activities logged before
                // the field existed or without Gmail sign-in).
                const allActivities = [];
                ovDistricts.forEach(d => {
                  const ownerEmail = STATE_REP_EMAIL[d.state || "FL"] || "";
                  (d.activities || []).forEach(a => {
                    allActivities.push({
                      ...a,
                      _resolvedRep: a.repEmail || ownerEmail,
                    });
                  });
                });

                const repRows = Object.entries(REP_PROFILES)
                  .filter(([, r]) => r.name)
                  .map(([email, rep]) => {
                    const logs = allActivities.filter(a =>
                      a._resolvedRep === email &&
                      ACT_TYPES.some(t => t.key === a.type) &&
                      (!cutoffStr || (a.date || "") >= cutoffStr)
                    );
                    const counts = {};
                    ACT_TYPES.forEach(t => { counts[t.key] = 0; });
                    logs.forEach(a => { if (counts[a.type] !== undefined) counts[a.type]++; });
                    const total = Object.values(counts).reduce((s, n) => s + n, 0);
                    return { email, rep, counts, total };
                  })
                  .filter(r => !repEmail || r.email === repEmail)
                  .sort((a, b) => b.total - a.total);

                const colTotals = {};
                ACT_TYPES.forEach(t => { colTotals[t.key] = repRows.reduce((s, r) => s + r.counts[t.key], 0); });
                const grandTotal = repRows.reduce((s, r) => s + r.total, 0);

                return (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">📊 Team Activity</h3>
                      <div className="flex gap-1">
                        {ACT_WINDOWS.map(({ v, l }) => (
                          <button
                            key={v}
                            onClick={() => setOvActivityWindow(v)}
                            className={"text-xs px-3 py-1.5 rounded-lg font-medium transition-colors " + (ovActivityWindow === v ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
                          >{l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Rep</th>
                            {ACT_TYPES.map(t => (
                              <th key={t.key} className={"text-right px-4 py-2.5 font-semibold " + t.color}>{t.label}</th>
                            ))}
                            <th className="text-right px-4 py-2.5 font-semibold text-gray-700">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {repRows.length === 0 ? (
                            <tr><td colSpan={ACT_TYPES.length + 2} className="px-4 py-8 text-center text-gray-400">No activity logged in this period.</td></tr>
                          ) : (
                            repRows.map(({ email, rep, counts, total }) => (
                              <tr key={email} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-2.5">
                                  <span className={"text-xs px-2 py-0.5 rounded-full font-semibold " + rep.color}>{rep.name}</span>
                                </td>
                                {ACT_TYPES.map(t => (
                                  <td key={t.key} className={"text-right px-4 py-2.5 font-medium " + (counts[t.key] > 0 ? t.color : "text-gray-300")}>
                                    {counts[t.key] > 0 ? counts[t.key] : "—"}
                                  </td>
                                ))}
                                <td className={"text-right px-4 py-2.5 font-bold " + (total > 0 ? "text-gray-800" : "text-gray-300")}>{total > 0 ? total : "—"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {grandTotal > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-gray-200 bg-gray-50">
                              <td className="px-4 py-2.5 font-semibold text-gray-600 text-xs">Total</td>
                              {ACT_TYPES.map(t => (
                                <td key={t.key} className={"text-right px-4 py-2.5 font-semibold " + (colTotals[t.key] > 0 ? t.color : "text-gray-300")}>
                                  {colTotals[t.key] > 0 ? colTotals[t.key] : "—"}
                                </td>
                              ))}
                              <td className="text-right px-4 py-2.5 font-bold text-gray-800">{grandTotal}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                );
              })()}

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
          );
        })()}

        {/* ── PROSPECTS TAB ── */}
        {activeTab === "prospects" && (
          <div>
            {/* Filters — two-row layout so everything fits at 100% zoom */}
            <div className="mb-4 space-y-2">
              {/* Row 1: search + primary filters */}
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="🔍 Search district, director, county..."
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs flex-shrink-0 w-52 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                {[
                  { label: "State",    val: filterState,    setter: setFilterState,    opts: [["all","All States"],["FL","FL"],["AL","AL"],["GA","GA"],["MI","MI"],["ID","ID"],["UT","UT"],["CO","CO"],["NV","NV"],["NM","NM"],["AZ","AZ"],["CA","CA"],["OR","OR"],["WA","WA"]] },
                  { label: "Priority", val: filterPriority, setter: setFilterPriority, opts: [["all","All Priorities"],["hot","🔥 Hot"],["warm","🌡️ Warm"],["cool","💧 Cool"],["cold","❄️ Cold"]] },
                  { label: "Stage",    val: filterStatus,   setter: setFilterStatus,   opts: [["all","All Stages"], ...Object.entries(SEQUENCE_STAGES).map(([k,v]) => [k, v.label])] },
                  { label: "Rep",      val: globalRepFilter, setter: setGlobalRepFilter, opts: [["all","All Reps"], ...Object.values(REP_PROFILES).map(r => [r.email, r.name])] },
                ].map((f) => (
                  <select key={f.label} value={f.val} onChange={(e) => f.setter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                    {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
                <span className="text-xs text-gray-400 ml-auto whitespace-nowrap font-medium">{filtered.length} results</span>
              </div>
              {/* Row 2: secondary filters + sort */}
              <div className="flex flex-wrap gap-2 items-center">
                {[
                  { label: "Curriculum", val: filterCurriculum, setter: setFilterCurriculum, opts: [["all","All Curricula"], ...CURRICULUM_VENDORS.map(v => [v, v])] },
                  { label: "Salesforce", val: filterSalesforce, setter: setFilterSalesforce, opts: [["all","In / Out SF"], ["in_sf","✓ In SF"], ["not_in_sf","Not in SF"]] },
                  { label: "Enrollment", val: filterEnrollment, setter: setFilterEnrollment, opts: [["all","All Sizes"],["lt500","< 500"],["500to1k","500–1k"],["1kto3k","1k–3k"],["3kplus","3k+"]] },
                ].map((f) => (
                  <select key={f.label} value={f.val} onChange={(e) => f.setter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                    {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
                <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-gray-200 pl-2 ml-1">
                  <span className="text-xs text-gray-400 whitespace-nowrap">Sort:</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200">
                    <option value="priority">⚡ Priority</option>
                    <option value="enrollment">🏫 Size</option>
                    <option value="tier">🏆 Tier</option>
                    <option value="adoptionYear">📅 Adoption (oldest)</option>
                    <option value="lastUpdated">🔄 Updated</option>
                    <option value="status">📊 Stage</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table — horizontally scrollable so it never pushes the page wider than the viewport */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: "900px" }}>
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
                      { h: "Priority" }, { h: "District" }, { h: "Supt." }, { h: "Director" }, { h: "Curriculum" },
                      { h: "Adopted", style: { width: "64px" } }, { h: "Age", style: { width: "42px" } },
                      { h: "Enroll.", style: { width: "64px" } },
                      { h: "Signals", style: { minWidth: "180px" } },
                      { h: "Stage" }, { h: "Mailer", style: { width: "52px" } }, { h: "Actions" },
                    ].map(({ h, style }) => (
                      <th key={h} className="px-2 py-2.5 text-left font-medium" style={style}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => {
                    const p = getPriorityLabel(d.priority);
                    const age = d.curriculumAdoptionYear ? 2026 - d.curriculumAdoptionYear : null;
                    return (
                      <tr key={d.id} className={`border-t border-gray-100 hover:bg-indigo-50 transition-colors ${selectedIds.has(d.id) ? "bg-indigo-50 border-l-2 border-l-indigo-400" : i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-2 py-2 w-7">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium w-fit ${p.color}`}>{p.label}</span>
                            <span className="text-gray-400 text-xs">{d.priority ?? "—"}/100</span>
                          </div>
                        </td>
                        <td className="px-2 py-2" style={{ maxWidth: "130px" }}>
                          <div className="font-medium text-gray-900 flex items-center gap-1 truncate">
                            {d.county}
                            {d.state && d.state !== "FL" && <span className="text-xs bg-blue-100 text-blue-700 px-1 py-0 rounded font-semibold flex-shrink-0">{d.state}</span>}
                          </div>
                          <div className="text-gray-400 text-xs truncate">{d.district}</div>
                          {d.lastUpdated && <div className="text-green-600 text-xs">🔄 {d.lastUpdated}</div>}
                          {(() => { const rep = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]]; return rep ? <span className={`text-xs px-1 py-0 rounded font-semibold inline-block ${rep.color}`}>{rep.initials}</span> : null; })()}
                        </td>
                        <td className="px-2 py-2" style={{ maxWidth: "120px" }}>
                          {d.superintendent
                            ? <>
                                <div className="font-medium text-gray-800 flex items-center gap-0.5 truncate text-xs">
                                  {d.newLeadership && <span title="Leadership change" className="text-purple-500 flex-shrink-0">🆕</span>}
                                  <span className="truncate">{d.superintendent}</span>
                                </div>
                                {d.superintendentSince &&
                                  <div className="text-gray-400 text-xs">{d.superintendentSince} · {new Date().getFullYear() - d.superintendentSince}yr</div>
                                }
                              </>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>
                        <td className="px-2 py-2" style={{ maxWidth: "120px" }}>
                          <div className="font-medium truncate">{d.director}</div>
                          <div className="text-gray-400 truncate text-xs">{d.email}</div>
                        </td>
                        <td className="px-2 py-2" style={{ maxWidth: "110px" }}>
                          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs truncate block">{d.curriculum}</span>
                        </td>
                        <td className="px-2 py-2 text-center text-xs">{d.curriculumAdoptionYear ?? "—"}</td>
                        <td className="px-2 py-2 text-center">
                          {age != null
                            ? <span className={`font-bold text-xs ${age >= 6 ? "text-red-600" : age >= 4 ? "text-orange-500" : "text-gray-500"}`}>{age}y</span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>
                        <td className="px-2 py-2 text-right text-xs">{d.enrollment != null ? d.enrollment.toLocaleString() : "—"}</td>
                        <td className="px-2 py-2" style={{ minWidth: "180px" }}>
                          <div className="flex flex-wrap gap-1">
                            {d.newLeadership && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-xs font-medium">🆕 Leadership change</span>
                            )}
                            {(d.buyingSignals || []).length > 0 && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-xs">⚡ {(d.buyingSignals || []).length} signal{(d.buyingSignals || []).length > 1 ? "s" : ""}</span>
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
                            {d.inSalesforce && (
                              <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded text-xs font-medium">✓ In SF{(d.sfContacts||[]).length > 0 ? ` (${(d.sfContacts||[]).length})` : ""}</span>
                            )}
                            {d.demographics?.ellPercent >= 15 && (
                              <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-xs">🌐 {d.demographics.ellPercent}% ELL</span>
                            )}
                            {d.demographics?.frlPercent >= 50 && (
                              <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded text-xs">🍎 Title I</span>
                            )}
                            {d.nicheGrade && (
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                d.nicheGrade[0] === "A" ? "bg-green-50 text-green-700 border-green-200" :
                                d.nicheGrade[0] === "B" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }`}>{d.nicheGrade}</span>
                            )}
                            {!d.newLeadership && (d.buyingSignals || []).length === 0 && (!d.boardNotes || d.boardNotes.length === 0) && (!d.districtContext || d.districtContext.length === 0) && !d.inSalesforce && !d.demographics && !d.nicheGrade && <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          {/* Stage badge + dropdown */}
                          <div className="flex flex-col gap-0.5">
                            {callWindowOpen(d) && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 px-1 py-0 rounded font-semibold w-fit">📞 Due</span>
                            )}
                            <select
                              value={d.status || "not_started"}
                              onChange={(e) => updateStage(d.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-xs px-1.5 py-0.5 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-300 ${stageColor(d.status || "not_started")}`}
                            >
                              {Object.entries(SEQUENCE_STAGES).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <label className="flex flex-col items-center gap-0.5 cursor-pointer" title={d.mailerSent ? "Mailer sent" : "Mark mailer as sent"}>
                            <input
                              type="checkbox"
                              checked={!!d.mailerSent}
                              onChange={() => toggleMailer(d.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 text-orange-500 cursor-pointer"
                            />
                            <span className="text-xs text-gray-400">{d.mailerSent ? "✓" : "—"}</span>
                          </label>
                        </td>
                        <td className="px-2 py-2">
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

                    {/* Add to Sequence */}
                    <div className="relative ml-2 border-l border-gray-700 pl-3">
                      <button
                        onClick={() => setShowBulkSeqDropdown(p => !p)}
                        className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
                      >🔁 Add to Sequence ▾</button>
                      {showBulkSeqDropdown && (
                        <div className="absolute bottom-10 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl min-w-52 overflow-hidden" onClick={e => e.stopPropagation()}>
                          <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Add {selectedIds.size} district{selectedIds.size !== 1 ? "s" : ""} to…</div>
                          {Object.entries(allCampaigns).map(([k, v]) => (
                            <button key={k} className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 hover:text-violet-700 transition-colors border-b border-gray-50 last:border-0"
                              onClick={() => {
                                enrollInCampaign(k, [...selectedIds]);
                                setShowBulkSeqDropdown(false);
                                showNotif(`✅ ${selectedIds.size} district${selectedIds.size !== 1 ? "s" : ""} added to ${v.label}`);
                                clearSelection();
                              }}
                            >{v.label}</button>
                          ))}
                        </div>
                      )}
                    </div>
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
            const matchRep = globalRepFilter === "all" || STATE_REP_EMAIL[d.state || "FL"] === globalRepFilter;
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
                  <h2 className="text-base font-bold text-gray-900">Outreach Tracking</h2>
                  <p className="text-xs text-gray-500 mt-1">Full outreach history per district. Log calls, emails, and meetings. Click a row to expand.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-4 text-center">
                    <div><div className="text-lg font-bold text-indigo-600">{totalContacted}</div><div className="text-xs text-gray-400">Contacted</div></div>
                    <div><div className="text-lg font-bold text-green-600">{totalReplied}</div><div className="text-xs text-gray-400">Replied/Meeting</div></div>
                    <div><div className="text-lg font-bold text-gray-500">{districts.length - totalContacted}</div><div className="text-xs text-gray-400">Not Yet Contacted</div></div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => gmailConnected ? syncGmailActivity() : connectGmail((t) => syncGmailActivity(t))}
                        disabled={gmailSyncing}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 border transition-colors ${gmailSyncing ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 cursor-pointer"}`}
                      >
                        {gmailSyncing ? "⏳ Syncing Gmail..." : "🔄 Sync Gmail"}
                      </button>
                      <button
                        onClick={() => granolaConnected ? syncGranolaActivity() : setGranolaModalOpen(true)}
                        disabled={granolaSyncing}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 border transition-colors ${granolaSyncing ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed" : granolaConnected ? "bg-white text-violet-600 border-violet-200 hover:bg-violet-50 cursor-pointer" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 cursor-pointer"}`}
                      >
                        {granolaSyncing ? "⏳ Syncing Granola..." : granolaConnected ? "📓 Sync Granola" : "📓 Connect Granola"}
                      </button>
                    </div>
                    {(lastSyncTime || granolaLastSync) && (
                      <span className="text-xs text-gray-400">
                        {lastSyncTime && `Gmail ${lastSyncTime}`}{lastSyncTime && granolaLastSync && " · "}{granolaLastSync && `Granola ${granolaLastSync}`}
                      </span>
                    )}
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
                  <option value="FL">Florida</option>
                  <option value="AL">Alabama</option>
                  <option value="GA">Georgia</option>
                  <option value="MI">Michigan</option>
                  <option value="ID">Idaho</option>
                  <option value="UT">Utah</option>
                  <option value="CO">Colorado</option>
                  <option value="NV">Nevada</option>
                  <option value="NM">New Mexico</option>
                  <option value="AZ">Arizona</option>
                  <option value="CA">California</option>
                  <option value="OR">Oregon</option>
                  <option value="WA">Washington</option>
                </select>
                <select value={globalRepFilter} onChange={(e) => setGlobalRepFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
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
                          <div className="text-xs text-gray-700 truncate flex items-center gap-1.5">
                            {d.email || <span className="text-gray-300">No email</span>}
                            {d.email && unsubs.has(d.email.toLowerCase()) && (
                              <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0 rounded whitespace-nowrap">⛔ Unsub'd</span>
                            )}
                            {d.email && !unsubs.has(d.email.toLowerCase()) && bounces.has(d.email.toLowerCase()) && (
                              <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-1.5 py-0 rounded whitespace-nowrap">⚠️ Bounced</span>
                            )}
                          </div>
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
                            value={d.status || "not_started"}
                            onChange={(e) => { e.stopPropagation(); updateStage(d.id, e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${stageColor(d.status || "not_started")}`}
                          >
                            {Object.entries(SEQUENCE_STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
                                  const act = { ...inlineActivity, id: Date.now(), district: d.district, directorName: d.director, repEmail: gmailUser || "", source: "manual" };
                                  const updated = [...(d.activities || []), act];
                                  updateDistrict(d.id, { activities: updated, status: inlineActivity.type === "meeting" ? "meeting scheduled" : d.status });
                                  setActivityLog(prev => [act, ...prev]);
                                  setInlineActivity({ type: "email", date: new Date().toISOString().split("T")[0], notes: "" });
                                  showNotif("Activity logged ✓");
                                  writeToSheet([activityToRow(d.id, d.district, act)]);
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

        {/* ── CALL QUEUE TAB ── */}
        {activeTab === "callqueue" && (() => {
          const campaign = allCampaigns[campaignFilter] || CAMPAIGNS.summer_outreach;
          const terminalStages = ["responded", "nurture"];
          const enrollments = campaignEnrollments[campaignFilter] || {};

          // All districts filtered by global rep + sequence-tab state/rep filters
          const seqDistricts = districts.filter(d => {
            const matchGlobal = globalRepFilter === "all" || STATE_REP_EMAIL[d.state || "FL"] === globalRepFilter;
            const matchState = seqStateFilter === "all" || (d.state || "FL") === seqStateFilter;
            const matchRep = seqRepFilter === "all" || STATE_REP_EMAIL[d.state || "FL"] === seqRepFilter;
            return matchGlobal && matchState && matchRep;
          });

          // Enrolled = explicitly enrolled OR (for built-in campaigns only) already contacted
          const enrolled = seqDistricts.filter(d =>
            !!enrollments[d.id] || (!campaign.isCustom && d.status && d.status !== "not_started")
          );

          // Districts not yet enrolled (available to add)
          const available = seqDistricts.filter(d =>
            (!d.status || d.status === "not_started") && !enrollments[d.id]
          );

          // Enrich each enrolled district with sequence progress
          const enriched = enrolled.map(d => {
            const outbound = (d.activities || []).filter(a => a.type === "email" && a.source !== "gmail_reply");
            const firstEmailDate = outbound.length
              ? outbound.reduce((min, a) => a.date < min ? a.date : min, outbound[0].date)
              : null;
            const enrollDate = enrollments[d.id] || null;
            const startDate = firstEmailDate || enrollDate;
            const daysSinceStart = startDate
              ? Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)
              : 0;

            // Not yet emailed but enrolled — show as "Ready to Send"
            if (!d.status || d.status === "not_started") {
              const firstStep = campaign.steps[0];
              return { ...d, daysSinceStart, currentStepIdx: -1, currentStep: null, nextStep: firstStep, nextActionDue: true, daysOverdue: daysSinceStart, enrollDate };
            }

            const currentStepIdx = campaign.steps.findIndex(s => s.key === d.status);
            const currentStep = campaign.steps[currentStepIdx] || null;
            const nextStep = !terminalStages.includes(d.status) && currentStepIdx >= 0 && currentStepIdx < campaign.steps.length - 1
              ? campaign.steps[currentStepIdx + 1]
              : null;
            const nextActionDue = !!(nextStep && daysSinceStart >= nextStep.day);
            const daysOverdue = nextActionDue ? daysSinceStart - nextStep.day : 0;
            return { ...d, daysSinceStart, currentStepIdx, currentStep, nextStep, nextActionDue, daysOverdue, enrollDate };
          });

          const actionDue = enriched.filter(d => d.nextActionDue).sort((a, b) => b.daysOverdue - a.daysOverdue);
          const onTrack   = enriched.filter(d => !d.nextActionDue && !terminalStages.includes(d.status) && d.status !== "not_started" && d.status);
          const responded = enriched.filter(d => d.status === "responded");
          const notYetStarted = enriched.filter(d => !d.status || d.status === "not_started");

          const sortedAll = [...enriched].sort((a, b) => {
            if (a.nextActionDue && !b.nextActionDue) return -1;
            if (!a.nextActionDue && b.nextActionDue) return 1;
            return b.daysSinceStart - a.daysSinceStart;
          });

          // ── Enroll panel filtered list ──
          const enrollFiltered = available.filter(d => {
            const matchSearch = !enrollSearch || d.district.toLowerCase().includes(enrollSearch.toLowerCase()) || d.director.toLowerCase().includes(enrollSearch.toLowerCase()) || d.county.toLowerCase().includes(enrollSearch.toLowerCase());
            const matchState = enrollStateFilter === "all" || (d.state || "FL") === enrollStateFilter;
            const matchRep = enrollRepFilter === "all" || STATE_REP_EMAIL[d.state || "FL"] === enrollRepFilter;
            const matchPriority = enrollPriorityFilter === "all"
              || (enrollPriorityFilter === "hot"  && d.priority >= 75)
              || (enrollPriorityFilter === "warm" && d.priority >= 55 && d.priority < 75)
              || (enrollPriorityFilter === "cool" && d.priority >= 35 && d.priority < 55)
              || (enrollPriorityFilter === "cold" && d.priority < 35);
            return matchSearch && matchState && matchRep && matchPriority;
          }).sort((a, b) => b.priority - a.priority);

          const allEnrollVisible = enrollFiltered.length > 0 && enrollFiltered.every(d => enrollSelected.has(d.id));

          return (
            <div className="relative">
              {/* ── Header + Campaign filter + Add button ── */}
              <div className="flex flex-wrap gap-3 items-start mb-5">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900">🔁 Sequence Tracker</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{campaign.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium text-gray-500">Campaign</span>
                  <select
                    value={campaignFilter}
                    onChange={e => { setCampaignFilter(e.target.value); setSeqStageFilter(null); }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <optgroup label="Built-in">
                      {Object.entries(CAMPAIGNS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </optgroup>
                    {Object.keys(customSequences).length > 0 && (
                      <optgroup label="Custom">
                        {Object.entries(customSequences).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {campaign.isCustom && (
                    <button
                      onClick={() => {
                        setEditingSequenceId(campaignFilter);
                        setSeqDraft({ label: campaign.label, description: campaign.description || "", steps: campaign.steps.map(s => ({ ...s })) });
                        setShowSequenceBuilder(true);
                      }}
                      className="text-xs border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                    >✏️ Edit</button>
                  )}
                  <button
                    onClick={() => {
                      setEditingSequenceId(null);
                      setSeqDraft({ label: "", description: "", steps: [] });
                      setShowSequenceBuilder(true);
                    }}
                    className="text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"
                  >✨ New Sequence</button>
                  <select
                    value={seqStateFilter}
                    onChange={e => setSeqStateFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="all">All States</option>
                    <option value="FL">Florida</option>
                    <option value="AL">Alabama</option>
                    <option value="GA">Georgia</option>
                    <option value="MI">Michigan</option>
                    <option value="ID">Idaho</option>
                    <option value="NV">Nevada</option>
                    <option value="NM">New Mexico</option>
                    <option value="AZ">Arizona</option>
                    <option value="UT">Utah</option>
                    <option value="CO">Colorado</option>
                    <option value="CA">California</option>
                    <option value="OR">Oregon</option>
                    <option value="WA">Washington</option>
                  </select>
                  <select
                    value={seqRepFilter}
                    onChange={e => setSeqRepFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="all">All Reps</option>
                    {Object.entries(REP_PROFILES).filter(([, r]) => r.name).map(([email, r]) => (
                      <option key={email} value={email}>{r.name}</option>
                    ))}
                  </select>
                  {(seqStateFilter !== "all" || seqRepFilter !== "all") && (
                    <button
                      onClick={() => { setSeqStateFilter("all"); setSeqRepFilter("all"); }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >✕ Clear</button>
                  )}
                  <button
                    onClick={() => { setShowEnrollPanel(true); setEnrollSelected(new Set()); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"
                  >
                    ➕ Add Districts
                    {available.length > 0 && <span className="bg-indigo-500 text-white text-xs px-1.5 py-0 rounded-full">{available.length}</span>}
                  </button>
                </div>
              </div>

              {/* ── Summary stat cards ── */}
              <div className="grid grid-cols-5 gap-3 mb-5">
                {[
                  { label: "In Sequence",    val: enrolled.length,        color: "text-indigo-700", bg: "bg-indigo-50" },
                  { label: "Ready to Send",  val: notYetStarted.length,   color: "text-yellow-600", bg: "bg-yellow-50" },
                  { label: "Action Due",     val: actionDue.filter(d => d.status && d.status !== "not_started").length, color: "text-red-600", bg: "bg-red-50" },
                  { label: "On Track",       val: onTrack.length,         color: "text-blue-600",   bg: "bg-blue-50"   },
                  { label: "Responded",      val: responded.length,       color: "text-green-600",  bg: "bg-green-50"  },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* ── Sequence pipeline swimlane ── */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Sequence Pipeline</div>
                  {seqStageFilter && (
                    <button onClick={() => setSeqStageFilter(null)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      ✕ Clear filter
                    </button>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 items-start">
                  {/* Not-started bucket */}
                  {(() => {
                    const isActive = seqStageFilter === "not_started";
                    return (
                      <div className="flex-1 min-w-20 text-center">
                        <button
                          onClick={() => setSeqStageFilter(isActive ? null : "not_started")}
                          className={`w-full rounded-lg border px-2 py-3 transition-all cursor-pointer focus:outline-none ${
                            isActive
                              ? "border-yellow-400 bg-yellow-100 ring-2 ring-yellow-300 shadow-sm"
                              : notYetStarted.length > 0
                              ? "border-yellow-200 bg-yellow-50 hover:border-yellow-400 hover:shadow-sm"
                              : "border-dashed border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="text-xl mb-1">⏳</div>
                          <div className={`text-2xl font-bold ${notYetStarted.length > 0 ? "text-yellow-600" : "text-gray-300"}`}>{notYetStarted.length}</div>
                          <div className="text-xs text-gray-600 font-medium leading-tight mt-0.5">Ready to Send</div>
                          <div className="text-xs text-gray-400 mt-0.5">Day 0</div>
                        </button>
                      </div>
                    );
                  })()}
                  <div className="text-gray-300 text-sm self-center mt-2 flex-shrink-0">→</div>
                  {campaign.steps.map((step, i) => {
                    const atStep = enriched.filter(d => d.status === step.key);
                    const dueToThis = actionDue.filter(d => d.status && d.status !== "not_started" && d.nextStep && d.nextStep.key === step.key);
                    const isActive = seqStageFilter === step.key;
                    return (
                      <React.Fragment key={step.key}>
                        <div className="flex-1 min-w-20 text-center">
                          <button
                            onClick={() => setSeqStageFilter(isActive ? null : step.key)}
                            className={`w-full rounded-lg border px-2 py-3 transition-all cursor-pointer focus:outline-none ${
                              isActive
                                ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300 shadow-sm"
                                : atStep.length > 0
                                ? "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:shadow-sm"
                                : "border-dashed border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <div className="text-xl mb-1">{step.icon}</div>
                            <div className={`text-2xl font-bold ${atStep.length > 0 ? "text-gray-800" : "text-gray-300"}`}>{atStep.length}</div>
                            <div className="text-xs text-gray-600 font-medium leading-tight mt-0.5">{step.label}</div>
                            <div className="text-xs text-gray-400 mt-0.5">Day {step.day}</div>
                            {dueToThis.length > 0 && (
                              <div className="mt-1.5 bg-red-100 text-red-600 text-xs rounded-full px-2 py-0.5 font-medium">
                                {dueToThis.length} due
                              </div>
                            )}
                          </button>
                        </div>
                        {i < campaign.steps.length - 1 && (
                          <div className="text-gray-300 text-sm self-center mt-2 flex-shrink-0">→</div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* ── Filtered stage view ── */}
              {seqStageFilter && (() => {
                const stageLabel = seqStageFilter === "not_started"
                  ? "Ready to Send"
                  : (SEQUENCE_STAGES[seqStageFilter]?.label || seqStageFilter);
                const stageDistricts = seqStageFilter === "not_started"
                  ? notYetStarted
                  : enriched.filter(d => d.status === seqStageFilter);
                return (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-gray-800">{stageLabel}</h3>
                      <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-medium">{stageDistricts.length} district{stageDistricts.length !== 1 ? "s" : ""}</span>
                      <button onClick={() => setSeqStageFilter(null)} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">✕ Clear filter</button>
                    </div>
                    {stageDistricts.length === 0 ? (
                      <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-400 text-sm">No districts in this stage.</div>
                    ) : (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 grid text-xs font-semibold text-gray-500 uppercase tracking-wide"
                          style={{gridTemplateColumns:"2fr 1.5fr 140px 90px 200px 100px"}}>
                          <span>District / Director</span>
                          <span>Contact</span>
                          <span>Current Step</span>
                          <span>Days</span>
                          <span>Next Action</span>
                          <span></span>
                        </div>
                        {stageDistricts.map(d => {
                          const rep = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]];
                          const distName = d.district.includes(" — ") ? d.district.split(" — ").slice(1).join(" — ") : d.district;
                          const isNotStarted = !d.status || d.status === "not_started";
                          return (
                            <div key={d.id} className={`border-b border-gray-100 px-4 py-3 grid items-center gap-3 transition-colors hover:bg-indigo-50 ${d.nextActionDue ? "bg-red-50/40" : ""}`}
                              style={{gridTemplateColumns:"2fr 1.5fr 140px 90px 200px 100px"}}>
                              <div>
                                <div className="font-medium text-gray-900 text-xs">{distName}</div>
                                <div className="text-gray-400 text-xs">{d.director}</div>
                                {rep && <span className={`text-xs px-1.5 py-0 rounded font-semibold mt-0.5 inline-block ${rep.color}`}>{rep.initials}</span>}
                              </div>
                              <div>
                                <div className="text-xs font-medium text-gray-700">{d.phone || <span className="text-gray-300">No phone</span>}</div>
                                <div className="text-xs text-gray-400 truncate">{d.email}</div>
                              </div>
                              <div>
                                {isNotStarted
                                  ? <span className="text-xs text-yellow-600 font-medium">Ready to Send</span>
                                  : d.currentStep
                                  ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.currentStep.color}`}>{d.currentStep.icon} {d.currentStep.label}</span>
                                  : <span className="text-gray-300 text-xs">—</span>}
                              </div>
                              <div className="text-center">
                                <span className={`text-sm font-bold ${d.daysSinceStart >= 14 ? "text-red-600" : d.daysSinceStart >= 7 ? "text-orange-500" : "text-gray-700"}`}>
                                  {d.daysSinceStart}d
                                </span>
                                {d.nextActionDue && d.daysOverdue > 0 && <div className="text-xs text-red-500">{d.daysOverdue}d overdue</div>}
                              </div>
                              <div>
                                {d.nextStep
                                  ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.nextStep.color}`}>{d.nextStep.icon} {d.nextStep.action}</span>
                                  : <span className="text-xs text-gray-300">Sequence complete</span>}
                              </div>
                              <div className="flex gap-1">
                                <select value={d.status || "not_started"} onChange={e => updateStage(d.id, e.target.value)}
                                  className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white flex-1">
                                  <option value="not_started">Not Started</option>
                                  {campaign.steps.map(s => (
                                    <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                                  ))}
                                  <option value="responded">Responded ✓</option>
                                  <option value="nurture">Nurture</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Action Needed Now (hidden when stage filter active) ── */}
              {!seqStageFilter && actionDue.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-red-700">🔴 Action Needed Now</h3>
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">{actionDue.length}</span>
                  </div>
                  <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
                    <div className="bg-red-50 border-b border-red-100 px-4 py-2 grid text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      style={{gridTemplateColumns:"2fr 1.5fr 100px 190px 150px 80px"}}>
                      <span>District / Director</span>
                      <span>Contact</span>
                      <span>Days in Seq</span>
                      <span>Next Action</span>
                      <span>Update Stage</span>
                      <span></span>
                    </div>
                    {actionDue.map(d => {
                      const rep = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]];
                      const distName = d.district.includes(" — ") ? d.district.split(" — ").slice(1).join(" — ") : d.district;
                      return (
                        <div key={d.id} className="border-b border-gray-100 px-4 py-3 grid items-center gap-3 hover:bg-red-50 transition-colors"
                          style={{gridTemplateColumns:"2fr 1.5fr 100px 190px 150px 80px"}}>
                          <div>
                            <div className="font-medium text-gray-900 text-xs">{distName}</div>
                            <div className="text-gray-400 text-xs">{d.director}</div>
                            {rep && <span className={`text-xs px-1.5 py-0 rounded font-semibold mt-0.5 inline-block ${rep.color}`}>{rep.initials}</span>}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-700">{d.phone || <span className="text-gray-300">No phone</span>}</div>
                            <div className="text-xs text-gray-400 truncate">{d.email}</div>
                          </div>
                          <div className="text-center">
                            <span className={`text-sm font-bold ${d.daysSinceStart >= 14 ? "text-red-600" : d.daysSinceStart >= 7 ? "text-orange-500" : "text-yellow-600"}`}>
                              {d.daysSinceStart}d
                            </span>
                            {d.daysOverdue > 0 && <div className="text-xs text-red-500">{d.daysOverdue}d overdue</div>}
                          </div>
                          <div>
                            {d.nextStep && (
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.nextStep.color}`}>
                                {d.nextStep.icon} {d.nextStep.action}
                              </span>
                            )}
                          </div>
                          <div>
                            <select
                              value={d.status || "not_started"}
                              onChange={(e) => updateStage(d.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white w-full"
                            >
                              <option value="not_started">Not Started</option>
                              {campaign.steps.map(s => (
                                <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                              ))}
                              <option value="responded">Responded ✓</option>
                              <option value="nurture">Nurture</option>
                            </select>
                          </div>
                          <div>
                            <button onClick={() => { setSelectedDistrict(d); setModalTab("overview"); }}
                              className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">View</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── All Districts in Sequence (hidden when stage filter active) ── */}
              {!seqStageFilter && <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">All Districts in Sequence</h3>
                  <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-medium">{enriched.length}</span>
                </div>
                {enriched.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
                    No districts in this sequence yet. Click <strong>Add Districts</strong> to enroll your first batch.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 grid text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      style={{gridTemplateColumns:"2fr 1.5fr 140px 90px 200px 100px"}}>
                      <span>District / Director</span>
                      <span>Contact</span>
                      <span>Current Step</span>
                      <span>Days</span>
                      <span>Next Action</span>
                      <span></span>
                    </div>
                    {sortedAll.map(d => {
                      const rep = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]];
                      const distName = d.district.includes(" — ") ? d.district.split(" — ").slice(1).join(" — ") : d.district;
                      const isNotStarted = !d.status || d.status === "not_started";
                      return (
                        <div key={d.id} className={`border-b border-gray-100 px-4 py-3 grid items-center gap-3 transition-colors hover:bg-indigo-50 ${d.nextActionDue ? "bg-red-50/40" : ""}`}
                          style={{gridTemplateColumns:"2fr 1.5fr 140px 90px 200px 100px"}}>
                          <div>
                            <div className="font-medium text-gray-900 text-xs">{distName}</div>
                            <div className="text-gray-400 text-xs">{d.director}</div>
                            {rep && <span className={`text-xs px-1.5 py-0 rounded font-semibold mt-0.5 inline-block ${rep.color}`}>{rep.initials}</span>}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-700">{d.phone || <span className="text-gray-300">No phone</span>}</div>
                            <div className="text-xs text-gray-400 truncate">{d.email}</div>
                          </div>
                          <div>
                            {isNotStarted ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">⏳ Ready to Send</span>
                            ) : d.currentStep ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.currentStep.color}`}>
                                {d.currentStep.icon} {d.currentStep.label}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-center">
                            <span className={`text-sm font-bold ${d.daysSinceStart >= 14 ? "text-red-600" : d.daysSinceStart >= 7 ? "text-orange-500" : "text-gray-500"}`}>
                              {d.daysSinceStart}d
                            </span>
                          </div>
                          <div>
                            {d.nextStep ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.nextActionDue ? d.nextStep.color : "bg-gray-100 text-gray-400"}`}>
                                {d.nextActionDue ? "🔴 " : ""}{d.nextStep.icon} {d.nextStep.action}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">Sequence complete</span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setSelectedDistrict(d); setModalTab("overview"); }}
                              className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">View</button>
                            {isNotStarted && enrollments[d.id] && (
                              <button onClick={() => unenrollFromCampaign(campaignFilter, d.id)}
                                className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded hover:bg-red-50 hover:text-red-600" title="Remove from sequence">✕</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>}

              {/* ── Add Districts Slide-Over Panel ── */}
              {showEnrollPanel && (
                <div className="fixed inset-0 z-50 flex">
                  {/* Backdrop */}
                  <div className="flex-1 bg-black/30" onClick={() => setShowEnrollPanel(false)} />
                  {/* Panel */}
                  <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
                    {/* Panel header */}
                    <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">Add Districts to {campaign.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{available.length} districts not yet enrolled</div>
                      </div>
                      <button onClick={() => setShowEnrollPanel(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold leading-none">✕</button>
                    </div>

                    {/* Filters */}
                    <div className="px-5 py-3 border-b border-gray-100 flex flex-col gap-2">
                      <input
                        value={enrollSearch}
                        onChange={e => setEnrollSearch(e.target.value)}
                        placeholder="🔍 Search district, director, county..."
                        className="border border-gray-200 rounded-lg px-3 py-2 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <div className="flex gap-2">
                        <select value={enrollStateFilter} onChange={e => setEnrollStateFilter(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                          <option value="all">All States</option>
                          {["FL","AL","ID","NV","CA","OR","NM","GA","MI","WA"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={enrollRepFilter} onChange={e => setEnrollRepFilter(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                          <option value="all">All Reps</option>
                          {Object.values(REP_PROFILES).map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
                        </select>
                        <select value={enrollPriorityFilter} onChange={e => setEnrollPriorityFilter(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                          <option value="all">All Priorities</option>
                          <option value="hot">🔥 Hot (75+)</option>
                          <option value="warm">🌡️ Warm (55-74)</option>
                          <option value="cool">💧 Cool (35-54)</option>
                          <option value="cold">❄️ Cold (&lt;35)</option>
                        </select>
                      </div>
                      {/* Select all row */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allEnrollVisible}
                          ref={el => { if (el) el.indeterminate = enrollSelected.size > 0 && !allEnrollVisible; }}
                          onChange={() => {
                            if (allEnrollVisible) {
                              setEnrollSelected(prev => { const s = new Set(prev); enrollFiltered.forEach(d => s.delete(d.id)); return s; });
                            } else {
                              setEnrollSelected(prev => { const s = new Set(prev); enrollFiltered.forEach(d => s.add(d.id)); return s; });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                        />
                        <span className="text-xs text-gray-500">{enrollFiltered.length} shown · {enrollSelected.size} selected</span>
                      </div>
                    </div>

                    {/* District list */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                      {enrollFiltered.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No districts match your filters.</div>
                      ) : enrollFiltered.map(d => {
                        const rep = REP_PROFILES[STATE_REP_EMAIL[d.state || "FL"]];
                        const p = getPriorityLabel(d.priority);
                        const distName = d.district.includes(" — ") ? d.district.split(" — ").slice(1).join(" — ") : d.district;
                        return (
                          <label key={d.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-indigo-50 cursor-pointer ${enrollSelected.has(d.id) ? "bg-indigo-50" : ""}`}>
                            <input
                              type="checkbox"
                              checked={enrollSelected.has(d.id)}
                              onChange={() => setEnrollSelected(prev => { const s = new Set(prev); s.has(d.id) ? s.delete(d.id) : s.add(d.id); return s; })}
                              className="rounded border-gray-300 text-indigo-600 cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-800 truncate">{distName}</div>
                              <div className="text-xs text-gray-400 truncate">{d.director} · {d.county} County · {d.state || "FL"}</div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.color}`}>{p.label}</span>
                              {rep && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${rep.color}`}>{rep.initials}</span>}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Panel footer */}
                    <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-400">{enrollSelected.size} district{enrollSelected.size !== 1 ? "s" : ""} selected</span>
                      <div className="flex gap-2">
                        <button onClick={() => setShowEnrollPanel(false)}
                          className="text-xs border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
                        <button
                          disabled={enrollSelected.size === 0}
                          onClick={() => {
                            enrollInCampaign(campaignFilter, [...enrollSelected]);
                            setShowEnrollPanel(false);
                            setEnrollSelected(new Set());
                            showNotif(`✅ ${enrollSelected.size} district${enrollSelected.size !== 1 ? "s" : ""} added to ${campaign.label}`);
                          }}
                          className={`text-xs text-white px-4 py-2 rounded-lg font-medium transition-colors ${enrollSelected.size > 0 ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                        >
                          Enroll {enrollSelected.size > 0 ? enrollSelected.size : ""} in {campaign.label}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sequence Builder Slide-Over */}
              {showSequenceBuilder && (
                <div className="fixed inset-0 z-50 flex">
                  <div className="flex-1 bg-black/30" onClick={() => setShowSequenceBuilder(false)} />
                  <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{editingSequenceId ? "Edit Sequence" : "New Sequence"}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Define steps, timing, and email templates for this sequence</div>
                      </div>
                      <button onClick={() => setShowSequenceBuilder(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                      {/* Name + Description */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Sequence Name *</label>
                          <input
                            value={seqDraft.label}
                            onChange={e => setSeqDraft(p => ({ ...p, label: e.target.value }))}
                            placeholder="e.g. Fall Outreach 2026"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Description (optional)</label>
                          <input
                            value={seqDraft.description}
                            onChange={e => setSeqDraft(p => ({ ...p, description: e.target.value }))}
                            placeholder="Short description"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                      </div>

                      {/* Steps */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Steps ({seqDraft.steps.length})</span>
                          {seqDraft.steps.length > 1 && (
                            <span className="text-xs text-gray-400">Day 0 → Day {Math.max(...seqDraft.steps.map(s => s.day))}</span>
                          )}
                        </div>

                        {seqDraft.steps.length === 0 && (
                          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm mb-4">
                            No steps yet — add your first step below.
                          </div>
                        )}

                        <div className="space-y-3 mb-4">
                          {seqDraft.steps.map((step, idx) => {
                            const typeInfo = STEP_TYPES[step.type] || STEP_TYPES.email;
                            const usedStageKeys = seqDraft.steps.filter((_, i) => i !== idx).map(s => STEP_TYPES[s.type]?.stageKey);
                            const allTmpl = { ...DEFAULT_TEMPLATE_TEXTS, ...customTemplates };
                            return (
                              <div key={step.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                {/* Step header */}
                                <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.icon} {typeInfo.label}</span>
                                  <span className="text-xs text-gray-400">Day {step.day}</span>
                                  <div className="ml-auto flex items-center gap-1">
                                    {idx > 0 && (
                                      <button onClick={() => { const s = [...seqDraft.steps]; [s[idx-1], s[idx]] = [s[idx], s[idx-1]]; setSeqDraft(p => ({...p, steps: s})); }}
                                        className="text-xs text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors">↑</button>
                                    )}
                                    {idx < seqDraft.steps.length - 1 && (
                                      <button onClick={() => { const s = [...seqDraft.steps]; [s[idx], s[idx+1]] = [s[idx+1], s[idx]]; setSeqDraft(p => ({...p, steps: s})); }}
                                        className="text-xs text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors">↓</button>
                                    )}
                                    <button onClick={() => setSeqDraft(p => ({...p, steps: p.steps.filter((_, i) => i !== idx)}))}
                                      className="text-xs text-red-400 hover:text-red-600 w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 transition-colors">✕</button>
                                  </div>
                                </div>
                                {/* Step fields */}
                                <div className={`p-4 grid gap-3 ${typeInfo.isEmail ? "grid-cols-2" : "grid-cols-2"}`}>
                                  <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Step Type</label>
                                    <select
                                      value={step.type}
                                      onChange={e => {
                                        const newType = e.target.value;
                                        const ti = STEP_TYPES[newType];
                                        setSeqDraft(p => ({
                                          ...p,
                                          steps: p.steps.map((s, i) => i !== idx ? s : {
                                            ...s, type: newType, label: ti.defaultLabel, action: ti.defaultLabel,
                                            stageKey: ti.stageKey, key: ti.stageKey,
                                            icon: ti.icon, color: ti.color,
                                            templateKey: ti.isEmail ? (s.templateKey || "original") : undefined,
                                          })
                                        }));
                                      }}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    >
                                      {Object.entries(STEP_TYPES).map(([k, v]) => {
                                        const alreadyUsed = k !== step.type && usedStageKeys.includes(v.stageKey);
                                        return <option key={k} value={k} disabled={alreadyUsed}>{v.icon} {v.label}{alreadyUsed ? " (already added)" : ""}</option>;
                                      })}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Day (from Day 0)</label>
                                    <input
                                      type="number" min="0" max="365"
                                      value={step.day}
                                      onChange={e => setSeqDraft(p => ({...p, steps: p.steps.map((s, i) => i === idx ? {...s, day: Math.max(0, parseInt(e.target.value) || 0)} : s)}))}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Step Label</label>
                                    <input
                                      value={step.label}
                                      onChange={e => setSeqDraft(p => ({...p, steps: p.steps.map((s, i) => i === idx ? {...s, label: e.target.value, action: e.target.value} : s)}))}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                  </div>
                                  {typeInfo.isEmail && (
                                    <div>
                                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Email Template</label>
                                      <select
                                        value={step.templateKey || "original"}
                                        onChange={e => setSeqDraft(p => ({...p, steps: p.steps.map((s, i) => i === idx ? {...s, templateKey: e.target.value} : s)}))}
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                      >
                                        {Object.entries(allTmpl).map(([k, v]) => (
                                          <option key={k} value={k}>{v.label || k}</option>
                                        ))}
                                        <option value="personalized">✨ Personalized (AI-generated)</option>
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add step buttons */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add a step:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(STEP_TYPES).map(([k, v]) => {
                              const alreadyUsed = seqDraft.steps.some(s => STEP_TYPES[s.type]?.stageKey === v.stageKey);
                              return (
                                <button
                                  key={k}
                                  disabled={alreadyUsed}
                                  onClick={() => {
                                    const maxDay = seqDraft.steps.length > 0 ? Math.max(...seqDraft.steps.map(s => s.day)) + 3 : 0;
                                    setSeqDraft(p => ({
                                      ...p,
                                      steps: [...p.steps, {
                                        id: `step_${Date.now()}_${k}`,
                                        key: v.stageKey,
                                        type: k,
                                        label: v.defaultLabel,
                                        action: v.defaultLabel,
                                        icon: v.icon,
                                        color: v.color,
                                        day: maxDay,
                                        stageKey: v.stageKey,
                                        templateKey: v.isEmail ? "original" : undefined,
                                      }]
                                    }));
                                  }}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border flex items-center gap-1.5 transition-colors ${
                                    alreadyUsed
                                      ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                                      : `${v.color} border-current opacity-90 hover:opacity-100 cursor-pointer`
                                  }`}
                                >{v.icon} {v.label}</button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Delete (edit mode only) */}
                      {editingSequenceId && (
                        <div className="border-t border-gray-100 pt-4">
                          <button
                            onClick={() => {
                              if (window.confirm("Delete this sequence for all reps? Districts enrolled in it will keep their current stage.")) {
                                saveCustomSequence(editingSequenceId, null);
                                if (campaignFilter === editingSequenceId) setCampaignFilter("summer_outreach");
                                setShowSequenceBuilder(false);
                                showNotif("Sequence deleted.");
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                          >🗑️ Delete this sequence</button>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {seqDraft.steps.length} step{seqDraft.steps.length !== 1 ? "s" : ""}
                        {seqDraft.steps.length > 0 && ` · Day 0 → Day ${Math.max(...seqDraft.steps.map(s => s.day))}`}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setShowSequenceBuilder(false)}
                          className="text-xs border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
                        <button
                          disabled={!seqDraft.label.trim() || seqDraft.steps.length === 0}
                          onClick={() => {
                            const id = editingSequenceId || `custom_${Date.now()}`;
                            const sortedSteps = [...seqDraft.steps].sort((a, b) => a.day - b.day);
                            saveCustomSequence(id, {
                              label: seqDraft.label.trim(),
                              description: seqDraft.description.trim(),
                              steps: sortedSteps,
                              isCustom: true,
                              createdBy: gmailUser || "",
                              createdAt: editingSequenceId ? (customSequences[id]?.createdAt || new Date().toISOString()) : new Date().toISOString(),
                              lastEditedAt: new Date().toISOString(),
                            });
                            setCampaignFilter(id);
                            setSeqStageFilter(null);
                            setShowSequenceBuilder(false);
                            showNotif(`✅ "${seqDraft.label.trim()}" saved — visible to all reps`);
                          }}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-semibold"
                        >{editingSequenceId ? "Save Changes" : "Create Sequence"}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

        {/* ── EMAIL COPY TAB ── */}
        {activeTab === "emailcopy" && (() => {
          // ── Audience state options ──────────────────────────────────────────
          const STATE_AUDIENCE_OPTIONS = [
            { value: "all", label: "All States" },
            { value: "FL", label: "Florida" },
            { value: "CA", label: "California" },
            { value: "NV", label: "Nevada" },
            { value: "AL", label: "Alabama" },
            { value: "GA", label: "Georgia" },
            { value: "MI", label: "Michigan" },
            { value: "OR", label: "Oregon" },
            { value: "NM", label: "New Mexico" },
            { value: "WA", label: "Washington" },
            { value: "CO", label: "Colorado" },
            { value: "AZ", label: "Arizona" },
            { value: "UT", label: "Utah" },
            { value: "ID", label: "Idaho" },
          ];
          const stateArrayToLabel = (arr) => {
            if (!arr || arr.length === 0 || arr.includes("all")) return "All states";
            return arr.map(v => STATE_AUDIENCE_OPTIONS.find(o => o.value === v)?.label || v).join(", ");
          };
          const stateStringToArray = (str) => {
            if (!str || str.toLowerCase().includes("all")) return ["all"];
            const found = STATE_AUDIENCE_OPTIONS.filter(o => o.value !== "all" && (str.includes(o.label) || str.includes(o.value))).map(o => o.value);
            return found.length > 0 ? found : ["all"];
          };

          // ── Helper: insert token at cursor ─────────────────────────────────
          const insertToken = (token, ref, setter, field) => {
            const el = ref.current;
            if (!el) { setter(p => ({ ...p, [field]: p[field] + token })); return; }
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const val = el.value;
            const newVal = val.substring(0, start) + token + val.substring(end);
            setter(p => ({ ...p, [field]: newVal }));
            requestAnimationFrame(() => {
              el.selectionStart = el.selectionEnd = start + token.length;
              el.focus();
            });
          };

          // ── Helper: apply format at selection ──────────────────────────────
          const applyFormat = (fmt, ref, setter, field, color = "") => {
            const el = ref.current;
            if (!el) return;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const val = el.value;
            let newVal, newStart, newEnd;
            if (fmt === "bold") {
              const sel = val.slice(start, end) || "bold text";
              const wrapped = `**${sel}**`;
              newVal = val.slice(0, start) + wrapped + val.slice(end);
              newStart = start + 2; newEnd = newStart + sel.length;
            } else if (fmt === "bullet") {
              const before = val.slice(0, start);
              const lineStart = before.lastIndexOf("\n") + 1;
              if (end > start) {
                const lines = val.slice(start, end).split("\n").map(l => l.startsWith("• ") ? l : "• " + l).join("\n");
                newVal = val.slice(0, start) + lines + val.slice(end);
                newStart = start; newEnd = start + lines.length;
              } else {
                newVal = val.slice(0, lineStart) + "• " + val.slice(lineStart);
                newStart = newEnd = end + 2;
              }
            } else if (fmt === "color") {
              const sel = val.slice(start, end) || "colored text";
              const wrapped = `[color=${color}]${sel}[/color]`;
              newVal = val.slice(0, start) + wrapped + val.slice(end);
              newStart = start + `[color=${color}]`.length;
              newEnd = newStart + sel.length;
            } else { return; }
            setter(p => ({ ...p, [field]: newVal }));
            requestAnimationFrame(() => { el.focus(); el.setSelectionRange(newStart, newEnd); });
          };

          // ── Token / format highlighting in read-only view ──────────────────
          const TOKEN_RE = /(\[(?:First Name|State Name|District Name|Calendly Link|Learn More Link)\])/g;
          const highlightTokens = text => text.split(TOKEN_RE).map((p, i) =>
            /^\[/.test(p)
              ? <span key={i} className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-1 py-0 rounded text-xs font-mono font-semibold">{p}</span>
              : p
          );

          // ── Live body preview with token + bold + color highlights ─────────
          const BodyPreview = ({ body }) => {
            if (!body.trim()) return null;
            const parts = body.split(/(\[(?:First Name|State Name|District Name|Calendly Link|Learn More Link)\]|\*\*[^*]+\*\*|\[color=#[0-9a-fA-F]{3,6}\][^\[]*\[\/color\])/g);
            return (
              <div className="mt-2 border border-dashed border-amber-200 rounded-lg px-3 py-2 bg-amber-50/40 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                <span className="block text-amber-500 font-semibold text-[10px] uppercase tracking-wide mb-1">Live preview — tokens & formatting highlighted</span>
                {parts.map((p, i) => {
                  if (/^\[/.test(p) && /\]$/.test(p)) return <span key={i} className="bg-amber-100 text-amber-700 border border-amber-300 px-0.5 rounded font-semibold">{p}</span>;
                  const boldM = p.match(/^\*\*([^*]+)\*\*$/);
                  if (boldM) return <strong key={i}>{boldM[1]}</strong>;
                  const colorM = p.match(/^\[color=(#[0-9a-fA-F]{3,6})\](.*)\[\/color\]$/);
                  if (colorM) return <span key={i} style={{ color: colorM[1] }}>{colorM[2]}</span>;
                  return p;
                })}
              </div>
            );
          };

          const TOKENS = ["[First Name]", "[District Name]", "[State Name]", "[Learn More Link]", "[Calendly Link]"];

          const TokenBar = ({ onInsert }) => (
            <div className="flex flex-wrap gap-1.5 mt-2 mb-0.5">
              <span className="text-xs text-gray-400 self-center mr-1">Insert token:</span>
              {TOKENS.map(t => (
                <button key={t} type="button" onClick={() => onInsert(t)}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded font-mono transition-colors">{t}</button>
              ))}
            </div>
          );

          // ── Format toolbar: bold, bullet, color ────────────────────────────
          const FORMAT_COLORS = ["#d32f2f","#1565c0","#2e7d32","#e65100","#6a1b9a","#37474f"];
          const FormatBar = ({ onFormat, onColor }) => {
            const [showColors, setShowColors] = React.useState(false);
            return (
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="text-xs text-gray-400 self-center mr-1">Format:</span>
                <button type="button" title="Bold — wraps selection in **…**"
                  onClick={() => onFormat("bold")}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 px-2.5 py-0.5 rounded font-bold transition-colors">B</button>
                <button type="button" title="Bullet — adds • to start of line"
                  onClick={() => onFormat("bullet")}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 px-2 py-0.5 rounded transition-colors">• Bullet</button>
                <div className="relative">
                  <button type="button" title="Color — wraps selection in color marker"
                    onClick={() => setShowColors(p => !p)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors">🎨 Color ▾</button>
                  {showColors && (
                    <div className="absolute top-7 left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-xl p-2 flex gap-1.5 items-center">
                      {FORMAT_COLORS.map(c => (
                        <button type="button" key={c} onClick={() => { onColor(c); setShowColors(false); }}
                          style={{ background: c }} className="w-5 h-5 rounded-full border-2 border-white shadow hover:scale-110 transition-transform" title={c} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          };

          // ── States multi-select dropdown ───────────────────────────────────
          const StateMultiSelect = ({ value, onChange }) => {
            const [open, setOpen] = React.useState(false);
            const toggleState = (v) => {
              if (v === "all") { onChange(["all"]); return; }
              const cur = value.filter(x => x !== "all");
              const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
              onChange(next.length === 0 ? ["all"] : next);
            };
            const label = stateArrayToLabel(value);
            return (
              <div className="relative">
                <button type="button" onClick={() => setOpen(p => !p)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-300 flex items-center justify-between gap-2 bg-white">
                  <span className="truncate text-gray-700">{label}</span>
                  <span className="text-gray-400 flex-shrink-0">▾</span>
                </button>
                {open && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                    {STATE_AUDIENCE_OPTIONS.map(opt => {
                      const checked = opt.value === "all" ? value.includes("all") || value.length === 0 : value.includes(opt.value);
                      return (
                        <label key={opt.value} className="flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => toggleState(opt.value)} className="rounded border-gray-300 text-indigo-600" />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      );
                    })}
                    <div className="border-t border-gray-100 px-3 py-2">
                      <button type="button" onClick={() => setOpen(false)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Done ✓</button>
                    </div>
                  </div>
                )}
              </div>
            );
          };

          return (
            <div className="p-6 max-w-4xl mx-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Email Copy</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    All outreach templates in one place. Edits apply to every email sent from the Send Queue.
                    {canEditEmailCopy
                      ? <span className="ml-2 text-green-600 font-medium">✓ You can edit</span>
                      : <span className="ml-2 text-gray-400">Sign in as Christie, Eric, or Sudeepta to edit.</span>}
                  </p>
                </div>
                {canEditEmailCopy && !showNewTemplateForm && (
                  <button
                    onClick={() => { setShowNewTemplateForm(true); setNewTemplateDraft({ label: "", statesArr: ["all"], subject: "", body: "" }); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 flex-shrink-0"
                  >
                    ✨ New Template
                  </button>
                )}
              </div>

              {/* ── Create New Template Form ── */}
              {showNewTemplateForm && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-900">✨ New Template</h3>
                    <button onClick={() => setShowNewTemplateForm(false)} className="text-xs text-gray-400 hover:text-gray-600">✕ Cancel</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Template name</label>
                      <input
                        type="text"
                        placeholder="e.g. Fall Outreach — Short"
                        value={newTemplateDraft.label}
                        onChange={e => setNewTemplateDraft(p => ({ ...p, label: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Audience / states</label>
                      <StateMultiSelect value={newTemplateDraft.statesArr || ["all"]} onChange={v => setNewTemplateDraft(p => ({ ...p, statesArr: v }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Subject line</label>
                    <input
                      type="text"
                      placeholder="Subject line…"
                      value={newTemplateDraft.subject}
                      onChange={e => setNewTemplateDraft(p => ({ ...p, subject: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Body</label>
                    <TokenBar onInsert={t => insertToken(t, newTemplateBodyRef, setNewTemplateDraft, "body")} />
                    <FormatBar
                      onFormat={f => applyFormat(f, newTemplateBodyRef, setNewTemplateDraft, "body")}
                      onColor={c => applyFormat("color", newTemplateBodyRef, setNewTemplateDraft, "body", c)}
                    />
                    <textarea
                      ref={newTemplateBodyRef}
                      rows={14}
                      placeholder={"Hi [First Name],\n\n…"}
                      value={newTemplateDraft.body}
                      onChange={e => setNewTemplateDraft(p => ({ ...p, body: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y mt-1"
                      spellCheck={true}
                    />
                    <BodyPreview body={newTemplateDraft.body} />
                    <p className="text-xs text-gray-400 mt-1">Paragraphs separated by blank lines · bullet lines start with • · **bold** · [color=#hex]text[/color]</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setShowNewTemplateForm(false)} className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg font-semibold">Cancel</button>
                    <button
                      disabled={!newTemplateDraft.label.trim() || !newTemplateDraft.subject.trim() || !newTemplateDraft.body.trim()}
                      onClick={() => {
                        const id = "custom_" + Date.now();
                        saveCustomTemplate(id, {
                          label: newTemplateDraft.label.trim(),
                          states: stateArrayToLabel(newTemplateDraft.statesArr),
                          subject: newTemplateDraft.subject.trim(),
                          body: newTemplateDraft.body.trim(),
                          createdBy: gmailUser || "",
                          createdAt: new Date().toISOString(),
                        });
                        setShowNewTemplateForm(false);
                        showNotif("✅ Template saved — visible to all reps");
                      }}
                      className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-semibold"
                    >Save Template</button>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* ── Built-in templates ── */}
                {Object.entries(DEFAULT_TEMPLATE_TEXTS).map(([key, defaults]) => {
                  const override = templateOverrides[key];
                  const current = override || defaults;
                  const isEditing = editingTemplate === key;
                  const isModified = !!override;

                  return (
                    <div key={key} className={`bg-white rounded-xl border ${isModified ? "border-indigo-200" : "border-gray-200"} overflow-hidden shadow-sm`}>
                      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-800 text-sm">{defaults.label}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{defaults.states}</span>
                          {isModified && (
                            <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                              {"✏️ Edited by " + (override.lastEditedBy?.split("@")[0] || "team") + " · " + (override.lastEditedAt ? new Date(override.lastEditedAt).toLocaleDateString() : "")}
                            </span>
                          )}
                        </div>
                        {canEditEmailCopy && !isEditing && (
                          <div className="flex gap-2">
                            {isModified && (
                              <button
                                onClick={() => { if (window.confirm("Reset to default copy?")) setTemplateOverrides(prev => { const n = { ...prev }; delete n[key]; return n; }); }}
                                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors"
                              >Reset</button>
                            )}
                            <button
                              onClick={() => { setEditingTemplate(key); setEditDraft({ subject: current.subject, body: current.body }); }}
                              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                            >Edit</button>
                          </div>
                        )}
                        {canEditEmailCopy && isEditing && (
                          <div className="flex gap-2">
                            <button onClick={() => setEditingTemplate(null)} className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-semibold">Cancel</button>
                            <button
                              onClick={async () => {
                                await saveTemplateOverride(key, editDraft.subject, editDraft.body);
                                setEditingTemplate(null);
                                showNotif("✅ " + defaults.label + " saved");
                              }}
                              className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg font-semibold"
                            >Save</button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="p-5 space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Subject line</label>
                            <input
                              type="text"
                              value={editDraft.subject}
                              onChange={e => setEditDraft(p => ({ ...p, subject: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Body</label>
                            <TokenBar onInsert={t => insertToken(t, customEditBodyRef, setEditDraft, "body")} />
                            <FormatBar
                              onFormat={f => applyFormat(f, customEditBodyRef, setEditDraft, "body")}
                              onColor={c => applyFormat("color", customEditBodyRef, setEditDraft, "body", c)}
                            />
                            <textarea
                              ref={customEditBodyRef}
                              rows={16}
                              value={editDraft.body}
                              onChange={e => setEditDraft(p => ({ ...p, body: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y mt-1"
                              spellCheck={true}
                            />
                            <BodyPreview body={editDraft.body} />
                            <p className="text-xs text-gray-400 mt-1">Paragraphs separated by blank lines · bullet lines start with • · **bold** · [color=#hex]text[/color]</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 space-y-3">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-14 flex-shrink-0 mt-0.5">Subject</span>
                            <span className="text-sm text-gray-800 font-medium">{highlightTokens(current.subject)}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-14 flex-shrink-0 mt-0.5">Body</span>
                            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap flex-1">{highlightTokens(current.body)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ── Custom (user-created) templates ── */}
                {Object.entries(customTemplates).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 mt-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Templates</h3>
                      <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-full">{Object.keys(customTemplates).length}</span>
                    </div>
                    <div className="space-y-4">
                      {Object.entries(customTemplates).map(([id, tmpl]) => {
                        const isEditingCustom = editingCustomTemplate === id;
                        return (
                          <div key={id} className="bg-white rounded-xl border border-violet-200 overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-5 py-3 bg-violet-50 border-b border-violet-100">
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-800 text-sm">{tmpl.label}</span>
                                <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{tmpl.states}</span>
                                <span className="text-xs text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full font-medium">
                                  {"By " + (tmpl.createdBy?.split("@")[0] || "team") + " · " + (tmpl.createdAt ? new Date(tmpl.createdAt).toLocaleDateString() : "")}
                                </span>
                              </div>
                              {canEditEmailCopy && (
                                <div className="flex gap-2">
                                  {!isEditingCustom && (
                                    <>
                                      <button
                                        onClick={() => { if (window.confirm("Delete this template? It will be removed for all reps.")) { saveCustomTemplate(id, null); showNotif("Template deleted"); } }}
                                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors"
                                      >Delete</button>
                                      <button
                                        onClick={() => { setEditingCustomTemplate(id); setCustomEditDraft({ label: tmpl.label, statesArr: stateStringToArray(tmpl.states), subject: tmpl.subject, body: tmpl.body }); }}
                                        className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                                      >Edit</button>
                                    </>
                                  )}
                                  {isEditingCustom && (
                                    <>
                                      <button onClick={() => setEditingCustomTemplate(null)} className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-semibold">Cancel</button>
                                      <button
                                        onClick={() => {
                                          const updated = {
                                            ...customTemplates[id],
                                            label: customEditDraft.label.trim() || customTemplates[id].label,
                                            states: stateArrayToLabel(customEditDraft.statesArr) || customTemplates[id].states,
                                            subject: customEditDraft.subject.trim(),
                                            body: customEditDraft.body.trim(),
                                            lastEditedBy: gmailUser || "",
                                            lastEditedAt: new Date().toISOString(),
                                          };
                                          saveCustomTemplate(id, updated);
                                          setEditingCustomTemplate(null);
                                          showNotif("✅ Template updated — visible to all reps");
                                        }}
                                        className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg font-semibold"
                                      >Save</button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            {isEditingCustom ? (
                              <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Template name</label>
                                    <input
                                      type="text"
                                      value={customEditDraft.label}
                                      onChange={e => setCustomEditDraft(p => ({ ...p, label: e.target.value }))}
                                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Audience / states</label>
                                    <StateMultiSelect value={customEditDraft.statesArr || ["all"]} onChange={v => setCustomEditDraft(p => ({ ...p, statesArr: v }))} />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Subject line</label>
                                  <input
                                    type="text"
                                    value={customEditDraft.subject}
                                    onChange={e => setCustomEditDraft(p => ({ ...p, subject: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Body</label>
                                  <TokenBar onInsert={t => insertToken(t, customEditBodyRef, setCustomEditDraft, "body")} />
                                  <FormatBar
                                    onFormat={f => applyFormat(f, customEditBodyRef, setCustomEditDraft, "body")}
                                    onColor={c => applyFormat("color", customEditBodyRef, setCustomEditDraft, "body", c)}
                                  />
                                  <textarea
                                    ref={customEditBodyRef}
                                    rows={16}
                                    value={customEditDraft.body}
                                    onChange={e => setCustomEditDraft(p => ({ ...p, body: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-300 resize-y mt-1"
                                    spellCheck={true}
                                  />
                                  <BodyPreview body={customEditDraft.body} />
                                  <p className="text-xs text-gray-400 mt-1">Paragraphs separated by blank lines · bullet lines start with • · **bold** · [color=#hex]text[/color]</p>
                                </div>
                              </div>
                            ) : (
                              <div className="p-5 space-y-3">
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-14 flex-shrink-0 mt-0.5">Subject</span>
                                  <span className="text-sm text-gray-800 font-medium">{highlightTokens(tmpl.subject)}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-14 flex-shrink-0 mt-0.5">Body</span>
                                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap flex-1">{highlightTokens(tmpl.body)}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
          const STATE_NAMES_DI = { FL: "Florida", AL: "Alabama", ID: "Idaho", NV: "Nevada", CA: "California", OR: "Oregon", NM: "New Mexico", GA: "Georgia", MI: "Michigan", WA: "Washington", AZ: "Arizona", UT: "Utah", CO: "Colorado" };

          return (
            <div className="pl-2">
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
                  <option value="FL">Florida</option>
                  <option value="AL">Alabama</option>
                  <option value="GA">Georgia</option>
                  <option value="MI">Michigan</option>
                  <option value="ID">Idaho</option>
                  <option value="UT">Utah</option>
                  <option value="CO">Colorado</option>
                  <option value="NV">Nevada</option>
                  <option value="NM">New Mexico</option>
                  <option value="AZ">Arizona</option>
                  <option value="CA">California</option>
                  <option value="OR">Oregon</option>
                  <option value="WA">Washington</option>
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
                            onMouseDown={() => { setDiInfoSelectedId(d.id); setDiInfoSearch(shortN); setDiInfoShowResults(false); setDiInfoEmailTemplate("original"); setDiInfoContactId(null); }}
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
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contacts</h4>
                          <ContactsPanel
                            district={selectedDi}
                            bounces={bounces}
                            onUpdate={(updates) => updateDistrict(selectedDi.id, updates)}
                            onMarkBounced={(email) => setBounces(prev => new Set([...prev, email.toLowerCase()]))}
                          />
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
                            <div className="text-xs text-gray-400 pl-3">+ {selectedDi.activities.length - 5} more — see Outreach Tracking tab</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Granola Call Notes */}
                    {(() => {
                      const granolaMeetings = (selectedDi.activities || []).filter(a => a.source === "granola");
                      return granolaMeetings.length > 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📓 Granola Call Notes <span className="text-gray-300 font-normal normal-case ml-1">({granolaMeetings.length})</span></h4>
                          <div className="space-y-3 max-h-72 overflow-y-auto">
                            {[...granolaMeetings].sort((a, b) => b.date.localeCompare(a.date)).map((a, i) => (
                              <div key={i} className="rounded-lg border border-violet-100 bg-violet-50/30 px-3 py-2.5">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-semibold text-violet-700 truncate">{a.granolaTitle || a.notes}</span>
                                  <span className="text-xs text-gray-400 flex-shrink-0">{a.date}</span>
                                </div>
                                {a.granolaNotesText && (
                                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{a.granolaNotesText}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : !granolaConnected ? (
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-4 flex items-center gap-3">
                          <span className="text-lg">📓</span>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">Connect Granola to pull call notes and meeting summaries into this view.</p>
                          </div>
                          <button onClick={() => setGranolaModalOpen(true)} className="text-xs px-3 py-1.5 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 font-medium flex-shrink-0">Connect</button>
                        </div>
                      ) : null;
                    })()}

                    {/* Email Drafts */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">✉️ Email Drafts</h4>
                      {!selectedDi.email && !(selectedDi.additionalContacts || []).some(c => c.email) ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">⚠️ No email address on file for this district — cannot draft or queue.</p>
                      ) : (() => {
                        // Build the list of sendable contacts
                        const primaryEmail = selectedDi.contactEdits?.email ?? selectedDi.email ?? "";
                        const primaryName  = selectedDi.contactEdits?.director ?? selectedDi.director ?? "";
                        const contactOptions = [
                          ...(primaryEmail ? [{ id: null, label: `${primaryName} (Primary)`, name: primaryName, firstName: primaryName.split(" ")[0], email: primaryEmail, title: selectedDi.contactEdits?.title ?? selectedDi.title ?? "", phone: selectedDi.contactEdits?.phone ?? selectedDi.phone ?? "" }] : []),
                          ...(selectedDi.additionalContacts || []).filter(c => c.email).map(c => ({ id: c.id, label: `${c.name}${c.role ? " — " + c.role : ""}`, name: c.name, firstName: c.firstName || c.name.split(" ")[0], email: c.email, title: c.title || "", phone: c.phone || "" })),
                        ];
                        const selectedContactOpt = diInfoContactId ? contactOptions.find(o => o.id === diInfoContactId) : contactOptions[0];
                        const contactOverrideForQueue = selectedContactOpt?.id !== null ? selectedContactOpt : null;
                        return (
                          <div>
                            {/* Recipient selector — only shown when there are additional contacts with emails */}
                            {contactOptions.length > 1 && (
                              <div className="mb-3">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Send to</label>
                                <div className="flex flex-wrap gap-2">
                                  {contactOptions.map(opt => (
                                    <button
                                      key={opt.id ?? "primary"}
                                      onClick={() => setDiInfoContactId(opt.id)}
                                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                                        (diInfoContactId === opt.id || (!diInfoContactId && opt.id === null))
                                          ? "bg-indigo-600 text-white border-indigo-600"
                                          : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                                {selectedContactOpt && (
                                  <p className="text-xs text-gray-400 mt-1">📧 {selectedContactOpt.email}</p>
                                )}
                              </div>
                            )}
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
                                  const districtForPreview = contactOverrideForQueue ? {
                                    ...selectedDi,
                                    director: contactOverrideForQueue.name,
                                    email: contactOverrideForQueue.email,
                                    contactEdits: { ...(selectedDi.contactEdits || {}), director: contactOverrideForQueue.name, email: contactOverrideForQueue.email },
                                  } : selectedDi;
                                  const body = diInfoEmailTemplate === "personalized"
                                    ? generatePersonalizedEmail(districtForPreview, currentRep)
                                    : getEmailBody(districtForPreview, diInfoEmailTemplate, currentRep);
                                  if (!body) { showNotif("⚠️ No email body generated", "red"); return; }
                                  setEmailPreview(body);
                                  setShowEmailPreview(true);
                                }}
                                className="text-xs border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium"
                              >Preview</button>
                              <button
                                onClick={() => queueEmail(selectedDi, diInfoEmailTemplate, false, false, false, contactOverrideForQueue)}
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
                        );
                      })()}
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

      {/* ── UNSUBSCRIBE CONFIRMATION DIALOG ── */}
      {unsubConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="text-3xl mb-3">⛔</div>
            <h2 className="text-base font-bold text-gray-900 mb-2">This person unsubscribed</h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-700">{unsubConfirm.contactName}</span>{" (" + unsubConfirm.contactEmail + ")"}
            </p>
            <p className="text-sm text-gray-500 mb-6">has opted out of brightwheel outreach. Do you want to send to them anyway?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setUnsubConfirm(null); queueEmail(unsubConfirm.district, unsubConfirm.template, false, true, false, unsubConfirm.contactOverride || null); }}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
              >
                Send anyway
              </button>
              <button
                onClick={() => setUnsubConfirm(null)}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOUNCE CONFIRMATION DIALOG ── */}
      {bounceConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-base font-bold text-gray-900 mb-2">This email bounced</h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-700">{bounceConfirm.contactName}</span>{" (" + bounceConfirm.contactEmail + ")"}
            </p>
            <p className="text-sm text-gray-500 mb-6">A previous email to this address failed to deliver. It may be invalid or the mailbox is full. Send anyway?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setBounceConfirm(null); queueEmail(bounceConfirm.district, bounceConfirm.template, false, false, true, bounceConfirm.contactOverride || null); }}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700"
              >
                Send anyway
              </button>
              <button
                onClick={() => setBounceConfirm(null)}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DISTRICT DETAIL MODAL ── */}
      {selectedDistrict && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedDistrict(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityLabel(selectedDistrict.priority).color}`}>
                    {getPriorityLabel(selectedDistrict.priority).label} · {selectedDistrict.priority ?? "—"}/100
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

                  {/* ── Superintendent card ── */}
                  <div className="col-span-2">
                    <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${selectedDistrict.newLeadership ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200"}`}>
                      <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Superintendent</span>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                          {selectedDistrict.superintendent
                            ? <>
                                <span className="text-sm font-medium text-gray-800">{selectedDistrict.superintendent}</span>
                                {selectedDistrict.superintendentSince &&
                                  <span className="text-xs text-gray-500">· since {selectedDistrict.superintendentSince} ({new Date().getFullYear() - selectedDistrict.superintendentSince} yr tenure)</span>
                                }
                                {selectedDistrict.superintendentSrc &&
                                  <a href={selectedDistrict.superintendentSrc} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">source ↗</a>
                                }
                              </>
                            : <span className="text-sm text-gray-400 italic">Not yet researched — run enrich_leadership.py</span>
                          }
                        </div>
                      </div>
                      {selectedDistrict.newLeadership &&
                        <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ml-3">🆕 Leadership change detected</span>
                      }
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contacts</h3>
                    <ContactsPanel
                      district={selectedDistrict}
                      bounces={bounces}
                      onUpdate={(updates) => updateDistrict(selectedDistrict.id, updates)}
                      onMarkBounced={(email) => setBounces(prev => new Set([...prev, email.toLowerCase()]))}
                    />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Curriculum Profile</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-500">Current:</span> <span className="font-medium text-indigo-700">{selectedDistrict.curriculum}</span></div>
                      <div><span className="text-gray-500">Vendor:</span> {selectedDistrict.curriculumVendor}</div>
                      {selectedDistrict.curriculumAdoptionYear
                        ? <div><span className="text-gray-500">Adopted:</span> {selectedDistrict.curriculumAdoptionYear} <span className="text-red-500 font-medium">({2026 - selectedDistrict.curriculumAdoptionYear} years ago)</span></div>
                        : <div><span className="text-gray-500">Adopted:</span> <span className="text-gray-400">Unknown</span></div>
                      }
                      <div><span className="text-gray-500">Enrollment:</span> {selectedDistrict.enrollment != null ? selectedDistrict.enrollment.toLocaleString() : "—"}</div>
                      <div><span className="text-gray-500">Stage:</span>
                        <select
                          value={selectedDistrict.status || "not_started"}
                          onChange={(e) => updateStage(selectedDistrict.id, e.target.value)}
                          className={`ml-2 text-xs border-0 rounded-full px-2 py-0.5 font-medium cursor-pointer focus:outline-none ${stageColor(selectedDistrict.status || "not_started")}`}
                        >
                          {Object.entries(SEQUENCE_STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* ── Demographics & Performance ── */}
                  {(() => {
                    const demo = selectedDistrict.demographics;
                    const hasDemo = demo && (demo.ellPercent != null || demo.frlPercent != null || Object.keys(demo.enrollmentByRace || {}).length > 0);
                    const hasPerf = selectedDistrict.nicheGrade || selectedDistrict.kindergartenReadiness;
                    if (!hasDemo && !hasPerf) return null;

                    // Colours for race/ethnicity bars
                    const RACE_COLORS = {
                      hispanic:        "bg-orange-400",
                      white:           "bg-blue-400",
                      black:           "bg-purple-400",
                      asian:           "bg-green-400",
                      twoOrMore:       "bg-pink-400",
                      nativeAmerican:  "bg-yellow-500",
                      pacificIslander: "bg-teal-400",
                      unknown:         "bg-gray-300",
                    };
                    const RACE_LABELS = {
                      hispanic:        "Hispanic/Latino",
                      white:           "White",
                      black:           "Black / African American",
                      asian:           "Asian",
                      twoOrMore:       "Two or more races",
                      nativeAmerican:  "Native American",
                      pacificIslander: "Pacific Islander",
                      unknown:         "Unknown",
                    };

                    // Niche grade colour
                    const gradeColor = (g) => {
                      if (!g) return "bg-gray-100 text-gray-500";
                      const letter = g[0].toUpperCase();
                      return letter === "A" ? "bg-green-100 text-green-700"
                           : letter === "B" ? "bg-blue-100 text-blue-700"
                           : letter === "C" ? "bg-yellow-100 text-yellow-700"
                           : "bg-red-100 text-red-700";
                    };

                    const ellPct  = demo?.ellPercent;
                    const frlPct  = demo?.frlPercent;
                    const races   = demo?.enrollmentByRace || {};
                    const topRace = Object.entries(races).sort((a,b)=>b[1]-a[1])[0];

                    return (
                      <div className="col-span-2">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Demographics &amp; Performance</h3>
                        <div className="grid grid-cols-2 gap-4">

                          {/* Left: Demographics */}
                          {hasDemo && (
                            <div className="space-y-3">

                              {/* ELL + FRL indicator bars */}
                              <div className="space-y-2">
                                {ellPct != null && (
                                  <div>
                                    <div className="flex justify-between text-xs mb-0.5">
                                      <span className="text-gray-600 font-medium flex items-center gap-1">
                                        🌐 English Language Learners
                                        {ellPct >= 15 && <span className="bg-orange-100 text-orange-700 text-xs px-1.5 rounded-full font-semibold">Multilingual needed</span>}
                                      </span>
                                      <span className="font-bold text-gray-800">{ellPct}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${ellPct >= 25 ? "bg-orange-500" : ellPct >= 15 ? "bg-orange-400" : "bg-green-400"}`}
                                           style={{ width: `${Math.min(ellPct, 100)}%` }} />
                                    </div>
                                  </div>
                                )}
                                {frlPct != null && (
                                  <div>
                                    <div className="flex justify-between text-xs mb-0.5">
                                      <span className="text-gray-600 font-medium flex items-center gap-1">
                                        🍎 Free/Reduced Price Lunch
                                        {frlPct >= 50 && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 rounded-full font-semibold">Title I likely</span>}
                                      </span>
                                      <span className="font-bold text-gray-800">{frlPct}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${frlPct >= 50 ? "bg-blue-500" : "bg-blue-300"}`}
                                           style={{ width: `${Math.min(frlPct, 100)}%` }} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Race / ethnicity breakdown */}
                              {Object.keys(races).length > 0 && (
                                <div>
                                  <div className="text-xs text-gray-500 mb-1.5 font-medium">Student demographics</div>
                                  {/* Stacked bar */}
                                  <div className="h-3 rounded-full overflow-hidden flex">
                                    {Object.entries(races)
                                      .filter(([,v]) => v >= 1)
                                      .sort((a,b) => b[1]-a[1])
                                      .map(([k, v]) => (
                                        <div key={k}
                                             title={`${RACE_LABELS[k] || k}: ${v}%`}
                                             className={`${RACE_COLORS[k] || "bg-gray-400"} h-full`}
                                             style={{ width: `${v}%` }} />
                                      ))
                                    }
                                  </div>
                                  {/* Legend — top 4 only */}
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                                    {Object.entries(races)
                                      .sort((a,b) => b[1]-a[1])
                                      .slice(0, 4)
                                      .map(([k, v]) => (
                                        <span key={k} className="flex items-center gap-1 text-xs text-gray-600">
                                          <span className={`inline-block w-2.5 h-2.5 rounded-sm ${RACE_COLORS[k] || "bg-gray-400"}`} />
                                          {RACE_LABELS[k] || k} {v}%
                                        </span>
                                      ))
                                    }
                                  </div>
                                </div>
                              )}

                              {demo?.year && (
                                <div className="text-xs text-gray-400">
                                  Source: NCES CCD {demo.year}
                                  {demo.src && <a href={demo.src} target="_blank" rel="noreferrer" className="ml-1 text-indigo-400 hover:underline">↗</a>}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Right: Performance */}
                          {hasPerf && (
                            <div className="space-y-3">

                              {selectedDistrict.nicheGrade && (
                                <div className="flex items-center gap-3">
                                  <div className={`text-2xl font-extrabold px-3 py-1 rounded-lg ${gradeColor(selectedDistrict.nicheGrade)}`}>
                                    {selectedDistrict.nicheGrade}
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-gray-700">Niche Overall Grade</div>
                                    {selectedDistrict.nicheSrc && (
                                      <a href={selectedDistrict.nicheSrc} target="_blank" rel="noreferrer"
                                         className="text-xs text-indigo-500 hover:underline">View on Niche ↗</a>
                                    )}
                                  </div>
                                </div>
                              )}

                              {selectedDistrict.kindergartenReadiness && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <div className="text-xs font-semibold text-green-700 mb-0.5">📊 Kindergarten Readiness</div>
                                  <div className="text-sm text-green-800">{selectedDistrict.kindergartenReadiness}</div>
                                  {selectedDistrict.kindergartenReadinessSrc && (
                                    <a href={selectedDistrict.kindergartenReadinessSrc} target="_blank" rel="noreferrer"
                                       className="text-xs text-green-600 hover:underline mt-0.5 inline-block">Source ↗</a>
                                  )}
                                </div>
                              )}

                              {/* Outreach angle derived from demographics */}
                              {ellPct != null && ellPct >= 15 && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                  <div className="text-xs font-semibold text-orange-700 mb-1">💡 Outreach angle</div>
                                  <p className="text-xs text-orange-700 leading-relaxed">
                                    {ellPct}% of students are English Language Learners.
                                    Lead with brightwheel's multilingual family communication
                                    (Spanish, Portuguese, Mandarin, and 10+ other languages)
                                    as a key differentiator — few competitors match this.
                                  </p>
                                </div>
                              )}

                              {frlPct != null && frlPct >= 50 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <div className="text-xs font-semibold text-blue-700 mb-1">💡 Funding angle</div>
                                  <p className="text-xs text-blue-700 leading-relaxed">
                                    {frlPct}% FRL rate suggests Title I eligibility.
                                    Pitch brightwheel as a platform that supports federal
                                    reporting requirements and maximises grant compliance.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {(selectedDistrict.recentNews?.length > 0) && (
                    <div className="col-span-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent News</h3>
                      {(selectedDistrict.recentNews || []).map((n, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-700 mb-1">
                          <span className="text-indigo-400 mt-0.5">📰</span>{n}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Shared Notes</h3>
                      {districtNotes[selectedDistrict.id]?.updatedBy && (
                        <span className="text-xs text-gray-400">
                          Last edited by {(districtNotes[selectedDistrict.id].updatedBy || "").split("@")[0]}
                          {districtNotes[selectedDistrict.id].updatedAt
                            ? " · " + new Date(districtNotes[selectedDistrict.id].updatedAt).toLocaleDateString()
                            : ""}
                        </span>
                      )}
                    </div>
                    <textarea
                      value={districtNoteEdits[selectedDistrict.id] !== undefined
                        ? districtNoteEdits[selectedDistrict.id]
                        : (districtNotes[selectedDistrict.id]?.text || "")}
                      onChange={(e) => setDistrictNoteEdits(prev => ({ ...prev, [selectedDistrict.id]: e.target.value }))}
                      placeholder="Add notes visible to everyone on the team..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 h-24 resize-none"
                    />
                    {districtNoteEdits[selectedDistrict.id] !== undefined && (
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => saveDistrictNote(selectedDistrict, districtNoteEdits[selectedDistrict.id])}
                          className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700"
                        >
                          Save note
                        </button>
                        <button
                          onClick={() => setDistrictNoteEdits(prev => { const n = { ...prev }; delete n[selectedDistrict.id]; return n; })}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedDistrict.activities?.length > 0 && (
                    <div className="col-span-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact History</h3>
                      {(selectedDistrict.activities || []).map((a) => (
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
                  {(!selectedDistrict.buyingSignals || selectedDistrict.buyingSignals.length === 0) ? (
                    <p className="text-gray-400 text-sm">No specific buying signals identified yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {(selectedDistrict.buyingSignals || []).map((s, i) => (
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
                            onClick={() => { setEmailPreview(getEmailBody(selectedDistrict, t.key, currentRep)); setShowEmailPreview(true); }}
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
                                onClick={() => { setEmailPreview(getEmailBody(selectedDistrict, "summerBridge", currentRep)); setShowEmailPreview(true); }}
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
                                onClick={() => { setEmailPreview(getEmailBody(selectedDistrict, "summerBridgeShort", currentRep)); setShowEmailPreview(true); }}
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

      {/* ── GRANOLA TOKEN MODAL ── */}
      {granolaModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setGranolaModalOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">GR</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Connect Granola</h2>
                <p className="text-xs text-gray-400">Sync call notes &amp; meetings to outreach tracking</p>
              </div>
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-4 text-xs text-violet-800 leading-relaxed">
              <strong>How to get your API key:</strong>
              <ol className="mt-1 ml-3 list-decimal space-y-0.5 text-violet-700">
                <li>Open Granola on your Mac</li>
                <li>Go to <strong>Settings → API</strong></li>
                <li>Generate or copy your personal API key</li>
              </ol>
              <p className="mt-2 text-violet-500">Requires a Granola Enterprise plan. Once connected, Granola meetings will be matched to districts by name and added to outreach tracking.</p>
            </div>

            <input
              type="password"
              value={granolaTokenInput}
              onChange={(e) => setGranolaTokenInput(e.target.value)}
              placeholder="Paste Granola API key here..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-300"
              onKeyDown={(e) => {
                if (e.key === "Enter" && granolaTokenInput.trim()) {
                  const t = granolaTokenInput.trim();
                  setGranolaToken(t); setGranolaConnected(true);
                  setGranolaModalOpen(false); setGranolaTokenInput("");
                  syncGranolaActivity(t);
                }
              }}
              autoFocus
            />

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setGranolaModalOpen(false); setGranolaTokenInput(""); }} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => {
                  const t = granolaTokenInput.trim();
                  if (!t) return;
                  setGranolaToken(t); setGranolaConnected(true);
                  setGranolaModalOpen(false); setGranolaTokenInput("");
                  syncGranolaActivity(t);
                }}
                disabled={!granolaTokenInput.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Connect &amp; Sync
              </button>
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
