"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "demo-aura" });
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const fixtures_1 = require("./prospects/fixtures");
async function main() {
    await (0, fixtures_1.runFixtures)();
    console.log("Done.");
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=runFixtures.js.map