"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
async function runSmokeTest() {
    console.log("INICIANDO SMOKE TEST PÚBLICO REAL...");
    // 1. Create a dummy session
    const dummyEmail = `smoketest_${Date.now()}@auranexus.io`;
    console.log(`Creando Prospecto de Prueba: ${dummyEmail}`);
    const linkRef = db.collection("market_discovery_links").doc("smoke_test_link");
    const tokenHash = "dummy_token_hash_for_smoke_test";
    await linkRef.set({
        companyName: "Smoke Test Corp",
        contactName: "Javier Tester",
        email: dummyEmail,
        status: "pending",
        tokenHash: tokenHash,
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600 * 1000)),
        usageCount: 0,
        trustScore: { decision: "ALLOW_FULL" },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Paso 1 Completado: Documento link inicial creado.");
    // Fake the token exchange by directly setting sessionTokenHash
    const sessionTokenHash = "dummy_session_hash";
    const dossierId = `dossier_smoke_${Date.now()}`;
    await linkRef.update({
        status: "completed",
        sessionTokenHash,
        dossierId
    });
    // Create discovery session document
    await db.collection("discovery_sessions").doc(dossierId).set({
        id: dossierId,
        companyName: "Smoke Test Corp",
        contactName: "Javier Tester",
        completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    // Create prospect lead
    const prospectRef = db.collection("platform_leads").doc("smoke_test_prospect");
    await prospectRef.set({
        companyName: "Smoke Test Corp",
        contactName: "Javier Tester",
        currentAdvisorId: "smoke_advisor"
    });
    // Create DiscoveryReportMetadata to skip generateDiscoveryReport (we want to test requestExecutiveDocument)
    const reportType = "EXTERNAL_RADIOGRAFIA";
    const folio = "AURA-SMOKE-2026";
    const documentVersion = "1.0";
    const reportId = `${dossierId}_${reportType}_v${documentVersion}`;
    const storagePath = `discovery_reports/smoke_test_prospect/${dossierId}/${reportType.toLowerCase()}-${folio}-v${documentVersion}.pdf`;
    const metadataRef = db.collection("discovery_reports").doc(reportId);
    await metadataRef.set({
        reportId,
        prospectId: "smoke_test_prospect",
        sessionId: dossierId,
        folio,
        reportType,
        deliveryLevel: "ALLOW_FULL",
        status: "READY",
        documentVersion,
        storagePath,
        generatedAt: new Date().toISOString(),
        generatedBy: "SYSTEM",
        idempotencyKey: reportId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    // Let's create a fake PDF in storage to test Signed URL
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save("PDF CONTENT DUMMY", { contentType: "application/pdf" });
    console.log(`Paso 2 Completado: Simulado metadata READY y archivo en Storage.`);
    // Now we need to test if Signed URL generation works.
    console.log("Probando generación de Signed URL V4...");
    try {
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 10 * 60 * 1000,
            promptSaveAs: 'radiografia.pdf'
        });
        console.log("✅ Signed URL generada correctamente:", url.substring(0, 50) + "...");
    }
    catch (err) {
        console.error("❌ Falla generando Signed URL:", err);
        console.log("Si el error es IAM (Cannot sign data), el service account necesita permisos Service Account Token Creator.");
    }
    // Clean up
    await linkRef.delete();
    await db.collection("discovery_sessions").doc(dossierId).delete();
    await prospectRef.delete();
    await metadataRef.delete();
    await file.delete();
    console.log("Smoke Test completado y recursos limpios.");
}
runSmokeTest().catch(console.error);
//# sourceMappingURL=smokeTest.js.map