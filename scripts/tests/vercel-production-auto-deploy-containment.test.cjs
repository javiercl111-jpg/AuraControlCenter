"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

const expandBraces = (pattern) => {
  const match = pattern.match(/\{([^{}]+)\}/);
  if (!match) return [pattern];
  if (!match[1].includes(",")) return null;

  const expanded = match[1].split(",").map((choice) =>
    expandBraces(
      `${pattern.slice(0, match.index)}${choice}${pattern.slice(match.index + match[0].length)}`,
    ));
  if (expanded.some((result) => result === null)) return null;
  return expanded.flat();
};

const simpleGlobMatches = (pattern, value) => {
  let expression = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      expression += ".*";
    } else if (character === "?") {
      expression += ".";
    } else if (character === "[") {
      const end = pattern.indexOf("]", index + 1);
      if (end === -1) return true;
      const classContent = pattern.slice(index + 1, end);
      expression += classContent.startsWith("!")
        ? `[^${classContent.slice(1)}]`
        : `[${classContent}]`;
      index = end;
    } else {
      expression += character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
  }

  try {
    return new RegExp(`^${expression}$`).test(value);
  } catch {
    return true;
  }
};

const patternCanMatch = (pattern, value) => {
  assert.equal(typeof pattern, "string", "deploymentEnabled keys must be strings");

  // Fail closed for minimatch extglob constructs not handled by the small matcher.
  if (/[!+@*?]\(/.test(pattern)) return true;

  const expandedPatterns = expandBraces(pattern);
  if (expandedPatterns === null) return true;
  return expandedPatterns.some((expanded) => simpleGlobMatches(expanded, value));
};

test("vercel.json disables Git deployments for main exactly", () => {
  assert.ok(config.git && typeof config.git === "object");
  assert.ok(config.git.deploymentEnabled
    && typeof config.git.deploymentEnabled === "object");
  assert.ok(Object.hasOwn(config.git.deploymentEnabled, "main"));
  assert.equal(config.git.deploymentEnabled.main, false);
});

test("no enabled deployment rule can overlap main", () => {
  const overlappingEnabledRules = Object.entries(
    config.git.deploymentEnabled,
  ).filter(([pattern, enabled]) => enabled === true
    && patternCanMatch(pattern, "main"));

  assert.deepEqual(overlappingEnabledRules, []);
});

test("overlap detection covers common branch globs", () => {
  assert.equal(patternCanMatch("*", "main"), true);
  assert.equal(patternCanMatch("ma?n", "main"), true);
  assert.equal(patternCanMatch("m[!x]in", "main"), true);
  assert.equal(patternCanMatch("{dev,main}", "main"), true);
  assert.equal(patternCanMatch("feature/*", "main"), false);
});

test("the SPA rewrite preserves API and well-known exclusions", () => {
  assert.deepEqual(config.rewrites, [
    {
      source: "/((?!api/.*|\\.well-known/.*).*)",
      destination: "/",
    },
  ]);

  const spaRewrite = new RegExp(`^${config.rewrites[0].source}$`);
  assert.equal(spaRewrite.test("/.well-known/test"), false);
  assert.equal(spaRewrite.test("/api/test"), false);
  assert.equal(spaRewrite.test("/dashboard"), true);
});
