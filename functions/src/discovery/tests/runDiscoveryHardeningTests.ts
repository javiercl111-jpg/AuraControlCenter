import { deepStrictEqual, strictEqual } from "assert";
import {
  DiscoveryHardRequirement,
  validateDiscoveryCompletion,
} from "../discoveryCompletionValidation";
import { buildDiscoveryReportViewModel } from "../reports/DiscoveryReportViewModelBuilder";

type TestBody = () => void | Promise<void>;

interface TestCase {
  readonly name: string;
  readonly run: TestBody;
}

const linkData = {
  companyName: "Empresa Sesión Actual",
  contactName: "Contacto Destinatario",
  email: "contact@example.invalid",
  consents: {
    privacy: { value: true },
    diagnosticDelivery: { value: true },
  },
};

const completeConversation = [
  {
    role: "aura",
    content: "¡Hola! ¿A qué se dedica tu negocio y cuál es tu principal reto?",
  },
  {
    role: "user",
    content: "Somos una fábrica de textiles y tenemos cuellos de botella en almacén.",
  },
  {
    role: "aura",
    content: "Entiendo perfecto. ¿Qué metas u objetivos tienen proyectados a mediano plazo?",
  },
  { role: "user", content: "Queremos expandir las sucursales en 6 meses." },
  {
    role: "aura",
    content: "¿Cuántas personas colaboran actualmente en la operación diaria?",
  },
  { role: "user", content: "Tenemos una plantilla de 35 trabajadores." },
];

const tests: readonly TestCase[] = [
  {
    name: "1. Empresa + contacto + consentimiento + conversación sustantiva: cierre permitido aunque existan placeholders",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          dossier: {
            industry: "Otros",
            employees: 0,
            priority: "Sin prioridad definida",
          },
          conversationHistory: completeConversation,
          businessAssessmentDraft: {},
        },
        linkData,
      });

      strictEqual(result.valid, true);
      strictEqual(result.completionReason, "REQUIRED_FIELDS_COMPLETE");
      deepStrictEqual(result.hardMissingFields, []);
      strictEqual(result.conversationMetrics.hasSubstantiveConversation, true);
    },
  },
  {
    name: "2. Preguntas formuladas con variaciones lingüísticas: cierre permitido sin matching literal",
    run: () => {
      const adaptiveConversation = [
        { role: "aura", content: "Platícame sobre la visión y modelo de tu compañía." },
        { role: "user", content: "Ofrecemos servicios de consultoría logística integral." },
        { role: "aura", content: "¿Dónde detectas mayores fricciones operativas?" },
        { role: "user", content: "El rastreo de unidades nos consume demasiado tiempo." },
        { role: "aura", content: "¿Cuántos miembros integran el equipo actual?" },
        { role: "user", content: "Somos alrededor de 20 especialistas." },
      ];

      const result = validateDiscoveryCompletion({
        dossierPayload: {
          dossier: { industry: "Industria General" },
          conversationHistory: adaptiveConversation,
        },
        linkData,
      });

      strictEqual(result.valid, true);
      deepStrictEqual(result.hardMissingFields, []);
      strictEqual(result.conversationMetrics.substantiveUserTurns, 3);
    },
  },
  {
    name: "3. Sin contacto: cierre bloqueado",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          conversationHistory: completeConversation,
        },
        linkData: { companyName: "Empresa Sin Contacto" },
      });

      strictEqual(result.valid, false);
      strictEqual(result.completionReason, "BLOCKED_MISSING_REQUIRED_FIELDS");
      deepStrictEqual(result.hardMissingFields, [
        DiscoveryHardRequirement.CONTACT_INFORMATION,
        DiscoveryHardRequirement.REQUIRED_CONSENT,
      ]);
    },
  },
  {
    name: "4. Sin consentimiento: cierre bloqueado",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          conversationHistory: completeConversation,
        },
        linkData: {
          companyName: "Empresa Real",
          contactName: "Contacto Real",
          email: "real@example.invalid",
          consents: { privacy: { value: false } },
        },
      });

      strictEqual(result.valid, false);
      deepStrictEqual(result.hardMissingFields, [
        DiscoveryHardRequirement.REQUIRED_CONSENT,
      ]);
    },
  },
  {
    name: "5. Sin empresa: cierre bloqueado",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          conversationHistory: completeConversation,
        },
        linkData: {
          contactName: "Juan Pérez",
          email: "juan@example.invalid",
          consent: true,
        },
      });

      strictEqual(result.valid, false);
      deepStrictEqual(result.hardMissingFields, [
        DiscoveryHardRequirement.COMPANY_OR_ORGANIZATION,
      ]);
    },
  },
  {
    name: "6. Conversación vacía: cierre bloqueado",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          conversationHistory: [],
        },
        linkData,
      });

      strictEqual(result.valid, false);
      deepStrictEqual(result.hardMissingFields, [
        DiscoveryHardRequirement.SUBSTANTIVE_CONVERSATION,
      ]);
      strictEqual(result.conversationMetrics.userTurns, 0);
    },
  },
  {
    name: "7. Solo respuestas triviales 'sí/no/ok': cierre bloqueado",
    run: () => {
      const trivialConversation = [
        { role: "aura", content: "¿Deseas comenzar?" },
        { role: "user", content: "sí" },
        { role: "aura", content: "¿Tienes equipo de trabajo?" },
        { role: "user", content: "ok" },
        { role: "aura", content: "¿Deseas mejorar la gestión?" },
        { role: "user", content: "vale" },
      ];

      const result = validateDiscoveryCompletion({
        dossierPayload: {
          conversationHistory: trivialConversation,
        },
        linkData,
      });

      strictEqual(result.valid, false);
      deepStrictEqual(result.hardMissingFields, [
        DiscoveryHardRequirement.SUBSTANTIVE_CONVERSATION,
      ]);
      strictEqual(result.conversationMetrics.userTurns, 3);
      strictEqual(result.conversationMetrics.substantiveUserTurns, 0);
    },
  },
  {
    name: "8. Tres respuestas sustantivas y campos consultivos no estructurados: cierre permitido con evidence gaps",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          dossier: { industry: "Otros", employees: 0, priority: "Sin prioridad definida" },
          conversationHistory: completeConversation,
          businessAssessmentDraft: {},
        },
        linkData,
      });

      strictEqual(result.valid, true);
      deepStrictEqual(result.hardMissingFields, []);
      deepStrictEqual(result.evidenceGaps, [
        "ACTIVITY_OR_OFFERING_NOT_STRUCTURED",
        "PRIMARY_NEED_NOT_STRUCTURED",
        "OBJECTIVE_NOT_STRUCTURED",
        "ORGANIZATIONAL_CONTEXT_NOT_STRUCTURED",
      ]);
    },
  },
  {
    name: "9. Campos estructurados completos: cierre permitido sin gaps",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          dossier: { industry: "Manufactura", employees: 35, priority: "Reducción de costos" },
          businessAssessmentDraft: { painPointsIdentified: ["Control manual"] },
          conversationHistory: completeConversation,
        },
        linkData,
      });

      strictEqual(result.valid, true);
      deepStrictEqual(result.hardMissingFields, []);
      deepStrictEqual(result.evidenceGaps, []);
    },
  },
  {
    name: "10. Report identity y compatibilidad preexistente de view model",
    run: () => {
      const viewModel = buildDiscoveryReportViewModel({
        reportId: "dossier-current_EXTERNAL_RADIOGRAFIA_v1.0",
        deliveryLevel: "ALLOW_FULL",
        folio: "AURA-DX-2026-CURRENT",
        generatedAt: "2026-07-22T18:00:00.000Z",
        sessionData: {
          companyName: "Empresa Sesión Actual",
          contactName: "Contacto Destinatario",
          businessAssessmentDraft: {
            score: 72,
            painPointsIdentified: ["Programación manual"],
            processGaps: [],
          },
          executiveBriefingDraft: {
            keyObservations: ["La programación depende de hojas de cálculo."],
          },
          radiografiaEmpresarialDraft: {
            overallStatus: "Oportunidad de automatización",
          },
        },
        advisor: {
          displayName: "Asesora Independiente",
          title: "Consultora",
          email: "advisor@example.invalid",
          phone: "0000000000",
        },
      });

      strictEqual(viewModel.companyName, "Empresa Sesión Actual");
      strictEqual(viewModel.contactName, "Contacto Destinatario");
      strictEqual(viewModel.advisor?.displayName, "Asesora Independiente");
      strictEqual(viewModel.reportId, "dossier-current_EXTERNAL_RADIOGRAFIA_v1.0");
      strictEqual(viewModel.maturityScore, 72);
    },
  },
];

async function runTests(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`PASS ${test.name}`);
    } catch (error: unknown) {
      failures.push(test.name);
      console.error(`FAIL ${test.name}`, error);
    }
  }
  console.log(`${passed}/${tests.length} tests passed`);
  if (failures.length > 0) {
    throw new Error(`Discovery hardening tests failed: ${failures.join(", ")}`);
  }
}

void runTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
