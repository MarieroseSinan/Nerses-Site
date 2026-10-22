"use strict";

const INTERESTS = ["term", "whole", "universal", "final-expense", "not-sure"];
const INTEREST_LABELS = {
  term: "Term life",
  whole: "Whole life",
  universal: "Universal life",
  "final-expense": "Final expense",
  "not-sure": "Not sure yet",
};
const TIMES = ["morning", "afternoon", "evening", "any"];

// Strips control characters, trims, and caps the length.
function clean(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function validateLead(body) {
  body = body && typeof body === "object" ? body : {};
  const errors = {};
  const lead = {
    name: clean(body.name, 100),
    email: clean(body.email, 200),
    phone: clean(body.phone, 40),
    interest: clean(body.interest, 30) || "not-sure",
    bestTime: clean(body.bestTime, 20) || "any",
    message: clean(body.message, 2000),
  };
  if (lead.name.length < 2) errors.name = "Please enter your name.";
  if (!lead.email && !lead.phone) errors.contact = "Please enter a phone number or an email address.";
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) errors.email = "That email address doesn't look right.";
  if (lead.phone && lead.phone.replace(/\D/g, "").length < 7) errors.phone = "That phone number looks too short.";
  if (!INTERESTS.includes(lead.interest)) lead.interest = "not-sure";
  if (!TIMES.includes(lead.bestTime)) lead.bestTime = "any";
  if (body.consent !== true) errors.consent = "Please agree to be contacted so we can reply.";
  return { lead, errors };
}

module.exports = { INTERESTS, INTEREST_LABELS, TIMES, clean, validateLead };
