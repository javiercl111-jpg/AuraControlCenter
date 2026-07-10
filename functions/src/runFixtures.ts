import * as admin from "firebase-admin";
admin.initializeApp({ projectId: "demo-aura" });
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

import { runFixtures } from "./prospects/fixtures";
import { runLifecycleFixtures } from "./prospects/lifecycle/fixtures";

async function main() {
  try {
    console.log("Running ProspectResolutionEngine fixtures (requires Firebase Emulator)...");
    await runFixtures();
  } catch (e: any) {
    console.error("Skipping ProspectResolutionEngine due to missing emulator.", e.message);
  }
  
  console.log("\n=================================");
  console.log("Running ProspectLifecycleEngine fixtures (Pure Logic)...");
  runLifecycleFixtures();

  console.log("\nDone.");
  process.exit(0);
}

main().catch(console.error);

main().catch(console.error);
