import * as fs from "fs";
import * as path from "path";
import { ReportPdfGenerator } from "./discovery/reports/pdf/ReportPdfGenerator";
import { BrandingEngine } from "./discovery/reports/BrandingEngine";
import { ReportViewModel } from "./discovery/reports/types";
 

// Actually, it's easier to just patch the BrandingEngine locally so it doesn't call admin
BrandingEngine.getBrandingProfile = async () => {
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

  const branding = await BrandingEngine.getBrandingProfile();

  const scenarios = [
    {
      id: "hotel-full",
      companyName: "Hotel Grand Aura",
      contactName: "Javier Hotelero",
      industry: "Hotel",
      deliveryLevel: "ALLOW_FULL" as const,
      advisor: { displayName: "Ana Asesora" }
    },
    {
      id: "restaurante-basic",
      companyName: "Restaurante El Buen Sabor",
      contactName: "María Cocinera",
      industry: "Restaurante",
      deliveryLevel: "ALLOW_BASIC" as const,
      advisor: undefined // Unassigned
    },
    {
      id: "manufactura-extenso",
      companyName: "Industrias Metálicas Aura Especializadas de la Sierra y el Bajío S.A. de C.V. (Grupo IMAESB)",
      contactName: "Ing. Carlos Alberto Francisco De las Casas y Montes de Oca",
      industry: "Manufactura",
      deliveryLevel: "ALLOW_FULL" as const,
      advisor: { displayName: "Ing. Pedro" },
      extended: true
    },
    {
      id: "edge-score-0",
      companyName: "Empresa Naciente",
      contactName: "José Pérez",
      industry: "Retail",
      deliveryLevel: "ALLOW_FULL" as const,
      advisor: { displayName: "Juan Asesor" },
      score: 0
    },
    {
      id: "edge-score-100",
      companyName: "Empresa Consolidada",
      contactName: "María Directora",
      industry: "Tech",
      deliveryLevel: "ALLOW_FULL" as const,
      advisor: { displayName: "Juan Asesor" },
      score: 100
    },
    {
      id: "edge-one-opp",
      companyName: "Empresa Estable",
      contactName: "Luis Gerente",
      industry: "Retail",
      deliveryLevel: "ALLOW_FULL" as const,
      advisor: { displayName: "Juan Asesor" },
      score: 85,
      singleOpportunity: true
    },
    {
      id: "extreme-company-name",
      companyName: "Corporación de Servicios de Logística y Distribución de Alimentos de Alta Calidad para el Sector Turístico & Restaurantero del Norte de México S.A. de C.V. / Grupo Transportes Rápidos Áéíóúñ",
      contactName: "Ing. Francisco Javier Maximiliano de la Santísima Trinidad y Montes de Oca y Ocampo",
      industry: "Servicios",
      deliveryLevel: "ALLOW_FULL" as const,
      advisor: { displayName: "Asesor Principal Áéíóúñ" },
      extended: true,
      longRoadmap: true
    }
  ];

  for (const s of scenarios) {
    const data: ReportViewModel = {
      reportId: `mock_${s.id}`,
      folio: `AURA-DX-2026-${Math.floor(Math.random()*1000)}`,
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
      maturityScore: s.score !== undefined ? s.score : (s.extended ? 35 : 60),
      keyFindings: s.extended 
        ? ["Hallazgo 1 áéíóú", "Hallazgo 2 con texto excepcionalmente largo para forzar el salto de línea y comprobar que las viñetas y el espaciado funcionan perfectamente bajo presión. Esta es una línea que no debería romperse de forma extraña.", "Hallazgo 3", "Hallazgo 4", "Hallazgo 5", "Hallazgo 6", "Hallazgo 7", "Hallazgo 8", "Hallazgo 9", "Hallazgo 10"]
        : [
        "Falta de integración entre sistemas de ventas e inventarios.",
        "Dependencia alta de procesos manuales en administración."
      ],
      operationalRisks: s.deliveryLevel === "ALLOW_FULL" ? [
        "Riesgo de pérdida de datos por falta de respaldos.",
        "Riesgo fiscal por facturación inconsistente.",
        ...(s.extended ? ["Riesgo de fraude interno por falta de segregación de funciones.", "Riesgo de multas por normatividad laboral.", "Alta rotación de personal (30% anual)."] : [])
      ] : undefined,
      opportunities: s.deliveryLevel === "ALLOW_FULL" ? (
        s.singleOpportunity 
        ? ["Implementar sistema ERP centralizado."] 
        : [
        "Implementar un ERP unificado.",
        "Automatizar nómina y asistencias.",
        ...(s.extended ? ["Desplegar kioscos de auto-atención RH.", "Integrar pasarela de pagos.", "Firma electrónica de contratos."] : [])
      ]) : undefined,
      roadmap: s.deliveryLevel === "ALLOW_FULL" ? (
        s.longRoadmap ? [
          "Fase 1 - Migración del núcleo central de gestión: Migración del núcleo central de gestión del talento e incidencias complejas de nómina de toda la zona norte y Bajío.",
          "Fase 2 - Despliegue masivo y adopción cultural: Despliegue masivo y adopción cultural en sitio de los módulos biométricos faciales y control operativo móvil en más de cincuenta sucursales regionales."
        ] : [
          "Auditoría y levantamiento de requerimientos técnicos y operativos.",
          "Implementación fase 1: Contabilidad y Ventas.",
          "Implementación fase 2: Nómina y RH.",
          ...(s.extended ? [
            "Fase 3: Optimización de inventarios avanzados con AI.",
            "Fase 4: Despliegue de Business Intelligence y Dashboards en tiempo real.",
            "Fase 5: Capacitación general y adopción cultural extensiva en todas las sucursales del Bajío."
          ] : [])
        ]
      ) : undefined,
      recommendedModules: s.deliveryLevel === "ALLOW_FULL" ? [
        "Aura ERP", "Aura HR"
      ] : undefined
    };

    console.log(`Generating External Radiografia for ${s.id}...`);
    const extBuf = await ReportPdfGenerator.generateExternalRadiografia(data, branding);
    fs.writeFileSync(path.join(outDir, `${s.id}_external.pdf`), extBuf);

    console.log(`Generating Internal Briefing for ${s.id}...`);
    const intBuf = await ReportPdfGenerator.generateInternalBriefing({
      ...data,
      prospectId: `PROS-${Math.floor(Math.random()*10000)}`,
      opportunityScore: s.extended ? 95 : 65,
      probabilityOfClosing: s.extended ? "HIGH" : "MEDIUM",
      nextBestAction: "Agendar demo técnica de ERP.",
      confidenceLevel: "HIGH"
    }, branding);
    fs.writeFileSync(path.join(outDir, `${s.id}_internal.pdf`), intBuf);
  }

  console.log("All fixtures generated successfully.");
}

run().catch(err => {
  console.error("Failed to generate fixtures:", err);
  process.exit(1);
});
