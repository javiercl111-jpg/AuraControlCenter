"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const ReportPdfGenerator_1 = require("./discovery/reports/pdf/ReportPdfGenerator");
const BrandingEngine_1 = require("./discovery/reports/BrandingEngine");
// Actually, it's easier to just patch the BrandingEngine locally so it doesn't call admin
BrandingEngine_1.BrandingEngine.getBrandingProfile = async () => {
    return {
        brandId: "aura-official",
        brandName: "Aura Intelligence",
        logoUrl: "",
        localAssetKey: "aura-logo-oficial-800.png",
        primaryColor: "#071426",
        secondaryColor: "#22d3ee",
        accentColor: "#6366f1",
        surfaceColor: "#0f172a",
        backgroundColor: "#ffffff",
        textColor: "#334155",
        mutedTextColor: "#94a3b8",
        borderColor: "#e2e8f0",
        website: "auranexus.io",
        email: "admin@auranexus.io",
        whatsapp: "442-350-8472",
        footerText: "Aura Nexus · admin@auranexus.io · 442-350-8472 · auranexus.io",
        confidentialityText: "Documento confidencial preparado exclusivamente para",
        advisorPresentationEnabled: true,
        verificationEnabled: false,
        isActive: true,
        version: "1.0",
        updatedAt: new Date().toISOString(),
        updatedBy: "SYSTEM"
    };
};
async function run() {
    console.log("Starting PDF Fixture generation...");
    const outDir = path.resolve(__dirname, "../pdf-fixtures");
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const branding = await BrandingEngine_1.BrandingEngine.getBrandingProfile();
    const scenarios = [
        {
            id: "hotel-full",
            companyName: "Hotel Grand Aura",
            contactName: "Javier Hotelero",
            industry: "Hotel",
            deliveryLevel: "ALLOW_FULL",
            advisor: { displayName: "Ana Asesora" }
        },
        {
            id: "restaurante-basic",
            companyName: "Restaurante El Buen Sabor",
            contactName: "María Cocinera",
            industry: "Restaurante",
            deliveryLevel: "ALLOW_BASIC",
            advisor: undefined // Unassigned
        },
        {
            id: "manufactura-extenso",
            companyName: "Industrias Metálicas Aura",
            contactName: "Carlos Ingeniero",
            industry: "Manufactura",
            deliveryLevel: "ALLOW_FULL",
            advisor: { displayName: "Ing. Pedro" },
            extended: true
        }
    ];
    for (const s of scenarios) {
        const data = {
            reportId: `mock_${s.id}`,
            folio: `AURA-DX-2026-${Math.floor(Math.random() * 1000)}`,
            status: "GENERATING",
            deliveryLevel: s.deliveryLevel,
            companyName: s.companyName,
            contactName: s.contactName,
            advisor: s.advisor ? {
                displayName: s.advisor.displayName,
                title: "Senior Advisor",
                email: "advisor@auranexus.io",
                phone: "555-0000"
            } : undefined,
            generatedAt: new Date(),
            overallStatus: "Evaluación Crítica Recomendada",
            maturityScore: s.extended ? 35 : 60,
            keyFindings: [
                "Falta de integración entre sistemas de ventas e inventarios.",
                "Dependencia alta de procesos manuales en administración.",
                s.extended ? "Carencia absoluta de controles en piso de producción que causan mermas del 15%." : ""
            ].filter(x => x),
            operationalRisks: s.deliveryLevel === "ALLOW_FULL" ? [
                "Riesgo de pérdida de datos por falta de respaldos.",
                "Riesgo fiscal por facturación inconsistente.",
                s.extended ? "Riesgo de fraude interno por falta de segregación de funciones." : ""
            ].filter(x => x) : undefined,
            opportunities: s.deliveryLevel === "ALLOW_FULL" ? [
                "Implementar Aura Control Center para unificar operaciones.",
                "Automatizar conciliación bancaria."
            ] : undefined,
            roadmap: s.deliveryLevel === "ALLOW_FULL" ? [
                "Mes 1: Auditoría y configuración base.",
                "Mes 2: Despliegue de módulo de ventas.",
                "Mes 3: Capacitación y go-live."
            ] : undefined
        };
        console.log(`Generating External PDF for ${s.id}...`);
        const externalBuffer = await ReportPdfGenerator_1.ReportPdfGenerator.generateExternalRadiografia(data, branding);
        fs.writeFileSync(path.join(outDir, `${s.id}_external.pdf`), externalBuffer);
        console.log(`Generating Internal PDF for ${s.id}...`);
        const internalBuffer = await ReportPdfGenerator_1.ReportPdfGenerator.generateInternalBriefing({
            ...data,
            prospectId: `PROS-${s.id}`,
            opportunityScore: 85,
            probabilityOfClosing: "ALTA",
            nextBestAction: "Agendar reunión presencial para demostración de módulo de inventarios.",
            confidenceLevel: "HIGH_CONFIDENCE"
        }, branding);
        fs.writeFileSync(path.join(outDir, `${s.id}_internal.pdf`), internalBuffer);
    }
    console.log("PDF Fixtures generated successfully in /pdf-fixtures");
}
run().catch(e => console.error(e));
//# sourceMappingURL=runPdfFixtures.js.map