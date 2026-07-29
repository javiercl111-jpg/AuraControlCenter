"use strict";

const EXPECTED_PREFIX = "v20.";

if (!process.version.startsWith(EXPECTED_PREFIX)) {
  throw new Error(
    `Aura Intelligence OS validation requires Node 20; received ${process.version}`
  );
}

process.stdout.write(`Validated Node runtime ${process.version}\n`);
