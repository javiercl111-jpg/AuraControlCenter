const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const root = resolve(__dirname, "..", "..");
const rules = readFileSync(resolve(root, "firestore.rules"), "utf8");

function catchAllBlock(source) {
  const marker = "match /{collection}/{document=**}";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf("// Inbox content", start));
}

test("CLIENT CREATE platform_leads remains denied", () => {
  const block = catchAllBlock(rules);
  assert.match(block, /'platform_leads'/u);
  assert.match(block, /allow create, update, delete: if false;/u);
});

test("CLIENT UPDATE platform_leads remains denied", () => {
  assert.match(catchAllBlock(rules), /allow create, update, delete: if false;/u);
});

test("CLIENT DELETE platform_leads remains denied", () => {
  assert.match(catchAllBlock(rules), /allow create, update, delete: if false;/u);
});

test("backend capability and idempotency records are never client-readable or writable", () => {
  assert.match(rules, /match \/platform_global_admin_capability_grants\/\{adminId\}[\s\S]*?allow read, write: if false;/u);
  assert.match(rules, /match \/crm_lead_create_idempotency\/\{recordId\}[\s\S]*?allow read, write: if false;/u);
});
