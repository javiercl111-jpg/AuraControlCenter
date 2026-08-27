const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

const discoverPagePath = path.join(
  repoRoot,
  "src",
  "pages",
  "DiscoverPage.tsx",
);

const conversationStatePath = path.join(
  repoRoot,
  "src",
  "modules",
  "intelligence",
  "engine",
  "domain",
  "ConversationState.ts",
);

function read(pathname) {
  return fs.readFileSync(pathname, "utf8");
}

test(
  "Discovery Production enters HEURISTIC_ONLY before the first processTurn",
  () => {
    const source = read(discoverPagePath);

    const stateCreation =
      source.indexOf("stateRef.current = new ConversationState(");

    const heuristicAuthority =
      source.indexOf(
        'stateRef.current.llmModeForSession = "HEURISTIC_ONLY"',
      );

    const firstTurn =
      source.indexOf('processTurn(""); // Start the conversation');

    assert.notEqual(
      stateCreation,
      -1,
      "ConversationState initialization must exist in DiscoverPage",
    );

    assert.notEqual(
      heuristicAuthority,
      -1,
      "DiscoverPage must explicitly establish HEURISTIC_ONLY authority",
    );

    assert.notEqual(
      firstTurn,
      -1,
      "Initial Discovery processTurn must exist",
    );

    assert.ok(
      heuristicAuthority > stateCreation,
      "HEURISTIC_ONLY must be established after the Discovery state exists",
    );

    assert.ok(
      heuristicAuthority < firstTurn,
      "HEURISTIC_ONLY must be established before the first processTurn",
    );
  },
);

test(
  "global ConversationState SHADOW capability remains preserved",
  () => {
    const source = read(conversationStatePath);

    assert.match(
      source,
      /llmModeForSession:\s*"SHADOW"\s*\|\s*"HEURISTIC_ONLY"\s*=\s*"SHADOW"/,
      "Global ConversationState default must remain SHADOW; containment belongs to the Production Discovery boundary",
    );
  },
);