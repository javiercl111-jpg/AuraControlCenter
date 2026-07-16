"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "demo-aura" });
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const fixtures_1 = require("./prospects/fixtures");
const fixtures_2 = require("./prospects/lifecycle/fixtures");
async function main() {
    try {
        console.log("Running ProspectResolutionEngine fixtures (requires Firebase Emulator)...");
        await (0, fixtures_1.runFixtures)();
    }
    catch (e) {
        console.error("Skipping ProspectResolutionEngine due to missing emulator.", e.message);
    }
    console.log("\n=================================");
    console.log("Running ProspectLifecycleEngine fixtures (Pure Logic)...");
    (0, fixtures_2.runLifecycleFixtures)();
    console.log("\nDone.");
    process.exit(0);
}
main().catch(console.error);
main().catch(console.error);
//# sourceMappingURL=runFixtures.js.map