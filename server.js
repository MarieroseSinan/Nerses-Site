"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const { INTEREST_LABELS, clean, validateLead } = require("./lib/validate");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = parseInt(process.env.PORT || "3000", 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const NOTIFY_TO = process.env.NOTIFY_TO || "";
const SMTP_HOST = process.env.SMTP_HOST || "";

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.disable("x-powered-by");
// Hosts like Render, Railway and Fly sit behind a proxy; this keeps rate limiting per visitor.
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use(express.json({ limit: "20kb" }));

// ---------- Mail ----------
let transporter = null;
if (SMTP_HOST && NOTIFY_TO) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
  });
}

// ---------- Contact form ----------
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests. Please try again later or call directly." },
});


app.post("/api/contact", contactLimiter, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  // Honeypot: real visitors never see or fill this field. Pretend success so bots move on.
  if (clean(body.website, 200) !== "") return res.json({ ok: true });

  const { lead, errors } = validateLead(body);
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  const record = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ...lead,
  };

  try {
    fs.appendFileSync(LEADS_FILE, JSON.stringify(record) + "\n", { mode: 0o600 });
  } catch (err) {
    console.error("Could not save lead:", err);
    return res.status(500).json({ ok: false, error: "Something went wrong on our end. Please call instead." });
  }

  if (transporter) {
    transporter
      .sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || NOTIFY_TO,
        to: NOTIFY_TO,
        replyTo: lead.email || undefined,
        subject: `New website inquiry from ${lead.name}`,
        text: [
          `Name: ${lead.name}`,
          `Phone: ${lead.phone || "(not given)"}`,
          `Email: ${lead.email || "(not given)"}`,
          `Interested in: ${INTEREST_LABELS[lead.interest]}`,
          `Best time to call: ${lead.bestTime}`,
          "",
          lead.message || "(no message)",
          "",
          `Received ${record.receivedAt}`,
        ].join("\n"),
      })
      .catch((err) => console.error("Notification email failed:", err.message));
  }

  res.json({ ok: true });
});

// ---------- Admin ----------
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).type("text").send("Admin is disabled. Set ADMIN_PASSWORD in the environment to turn it on.");
  }
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString();
    const idx = decoded.indexOf(":");
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (safeEqual(user, ADMIN_USER) && safeEqual(pass, ADMIN_PASSWORD)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Leads", charset="UTF-8"');
  res.status(401).type("text").send("Sign in required.");
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  return fs
    .readFileSync(LEADS_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

app.get("/admin", requireAdmin, (req, res) => {
  const leads = readLeads();
  const rows = leads
    .map(
      (l) => `<tr>
  <td>${esc(new Date(l.receivedAt).toLocaleString("en-US", { timeZone: process.env.TZ || "America/Los_Angeles" }))}</td>
  <td>${esc(l.name)}</td>
  <td>${esc(l.phone)}</td>
  <td>${esc(l.email)}</td>
  <td>${esc(INTEREST_LABELS[l.interest] || l.interest)}</td>
  <td>${esc(l.bestTime)}</td>
  <td class="msg">${esc(l.message)}</td>
</tr>`
    )
    .join("\n");
  res
    .set("Cache-Control", "no-store")
    .type("html")
    .send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Leads</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:1.5rem;background:#f4f6fb;color:#0b1530}
h1{margin:0 0 .25rem;font-size:1.4rem}
p{margin:0 0 1rem;color:#53607e}
a{color:#2b55f0}
.wrap{overflow-x:auto;background:#fff;border:1px solid #d8deee;border-radius:10px}
table{border-collapse:collapse;width:100%;min-width:760px}
th,td{padding:.6rem .8rem;text-align:left;vertical-align:top;border-bottom:1px solid #e6eaf5}
th{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:#53607e;background:#fafbff}
td.msg{max-width:28rem;white-space:pre-wrap;overflow-wrap:anywhere}
</style></head><body>
<h1>Website leads</h1>
<p>${leads.length} total &middot; <a href="/admin/leads.csv">Download CSV</a></p>
<div class="wrap"><table>
<thead><tr><th>Received</th><th>Name</th><th>Phone</th><th>Email</th><th>Interest</th><th>Best time</th><th>Message</th></tr></thead>
<tbody>
${rows || '<tr><td colspan="7">No inquiries yet.</td></tr>'}
</tbody></table></div>
</body></html>`);
});

app.get("/admin/leads.csv", requireAdmin, (req, res) => {
  const cols = ["receivedAt", "name", "phone", "email", "interest", "bestTime", "message"];
  const cell = (v) => {
    let s = String(v == null ? "" : v);
    // Stop spreadsheet apps from running a cell that starts with a formula character.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [cols.join(",")].concat(readLeads().map((l) => cols.map((c) => cell(l[c])).join(",")));
  res
    .set("Cache-Control", "no-store")
    .set("Content-Disposition", 'attachment; filename="leads.csv"')
    .type("text/csv")
    .send(lines.join("\r\n") + "\r\n");
});

// ---------- Static site ----------
app.get("/healthz", (req, res) => res.type("text").send("ok"));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: "1h" }));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Site running on http://localhost:${PORT}`);
    if (!ADMIN_PASSWORD) console.log("Admin page is off. Set ADMIN_PASSWORD to turn it on.");
    if (!transporter) console.log("Email notifications are off. Set SMTP_HOST and NOTIFY_TO to turn them on.");
  });
}

// ---------- Tiny .env loader (no extra dependency) ----------
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

module.exports = { app };
