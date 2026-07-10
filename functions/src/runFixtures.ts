import * as admin from "firebase-admin";
admin.initializeApp({ projectId: "demo-aura" });
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

import { runFixtures } from "./prospects/fixtures";

async function main() {
  await runFixtures();
  console.log("Done.");
  process.exit(0);
}

main().catch(console.error);
