"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLead, clean } = require("../lib/validate");

const good = { name: "Maria Lopez", phone: "(555) 123-4567", email: "maria@example.com", interest: "term", bestTime: "evening", message: "Hi", consent: true };

test("accepts a complete, valid inquiry", () => {
  const { lead, errors } = validateLead(good);
  assert.deepEqual(errors, {});
  assert.equal(lead.name, "Maria Lopez");
  assert.equal(lead.interest, "term");
});

test("accepts phone only or email only", () => {
  assert.deepEqual(validateLead({ ...good, email: "" }).errors, {});
  assert.deepEqual(validateLead({ ...good, phone: "" }).errors, {});
});

test("requires a name", () => {
  assert.ok(validateLead({ ...good, name: " " }).errors.name);
});

test("requires some way to reply", () => {
  assert.ok(validateLead({ ...good, phone: "", email: "" }).errors.contact);
});

test("rejects a malformed email and a too-short phone", () => {
  assert.ok(validateLead({ ...good, email: "not-an-email" }).errors.email);
  assert.ok(validateLead({ ...good, phone: "123" }).errors.phone);
});

test("requires consent to be exactly true", () => {
  assert.ok(validateLead({ ...good, consent: false }).errors.consent);
  assert.ok(validateLead({ ...good, consent: "true" }).errors.consent);
  assert.ok(validateLead({ ...good, consent: undefined }).errors.consent);
});

test("falls back to safe defaults for unknown dropdown values", () => {
  const { lead } = validateLead({ ...good, interest: "<script>", bestTime: "midnight" });
  assert.equal(lead.interest, "not-sure");
  assert.equal(lead.bestTime, "any");
});

test("caps field lengths and strips control characters", () => {
  const { lead } = validateLead({ ...good, name: "A".repeat(500), message: "x\u0000y".repeat(2000) });
  assert.equal(lead.name.length, 100);
  assert.ok(lead.message.length <= 2000);
  assert.ok(!lead.message.includes("\u0000"));
});

test("handles missing or non-object bodies without throwing", () => {
  assert.ok(Object.keys(validateLead(undefined).errors).length > 0);
  assert.ok(Object.keys(validateLead(null).errors).length > 0);
  assert.ok(Object.keys(validateLead("text").errors).length > 0);
});

test("clean handles null and numbers", () => {
  assert.equal(clean(null, 10), "");
  assert.equal(clean(12345, 3), "123");
});
