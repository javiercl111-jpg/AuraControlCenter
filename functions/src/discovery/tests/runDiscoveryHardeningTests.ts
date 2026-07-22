import { deepStrictEqual, strictEqual } from "assert";
import {
  DiscoveryRequiredField,
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
    content: "¿Cuál es el giro de tu empresa y cuál es su reto administrativo más importante?",
  },
  {
    role: "user",
    content: "Fabricamos componentes y sufrimos retrasos en la programación.",
  },
  {
    role: "aura",
    content: "¿Cuál es tu principal prioridad organizativa para los próximos 3 meses?",
  },
  { role: "user", content: "Reducir los retrasos de entrega." },
  {
    role: "aura",
    content: "¿Qué proceso administrativo consume más tiempo operativo?",
  },
  { role: "user", content: "La programación manual de producción." },
  {
    role: "aura",
    content: "¿Sus sistemas soportarían el doble de operaciones?",
  },
  { role: "user", content: "No, necesitamos integrar las áreas." },
];

const tests: readonly TestCase[] = [
  {
    name: "Completion blocked when essential fields are missing",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          dossier: {
            industry: "Otros",
            employees: 0,
            priority: "Sin prioridad definida",
          },
          conversationHistory: [],
          businessAssessmentDraft: {},
        },
        linkData,
      });

      strictEqual(result.completionReason, "BLOCKED_MISSING_REQUIRED_FIELDS");
      deepStrictEqual(result.missingRequiredFields, [
        DiscoveryRequiredField.ACTIVITY_OR_OFFERING,
        DiscoveryRequiredField.PRIMARY_NEED,
        DiscoveryRequiredField.OBJECTIVE,
        DiscoveryRequiredField.ORGANIZATIONAL_CONTEXT,
      ]);
      strictEqual(result.questionsAskedCount, 0);
    },
  },
  {
    name: "Completion succeeds with essential commercial evidence",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          dossier: { industry: "Manufactura", priority: "Reducir retrasos" },
          conversationHistory: completeConversation,
          businessAssessmentDraft: {
            painPointsIdentified: ["Retrasos operativos"],
          },
        },
        linkData,
      });

      strictEqual(result.completionReason, "REQUIRED_FIELDS_COMPLETE");
      deepStrictEqual(result.missingRequiredFields, []);
      strictEqual(result.questionsAskedCount, 4);
      strictEqual(result.conversationDefinitionVersion, "legacy-discovery-v1");
    },
  },
  {
    name: "Completion requires current contact and consent",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          dossier: { industry: "Manufactura", employees: 20, priority: "Crecer" },
          conversationHistory: completeConversation,
          businessAssessmentDraft: { painPointsIdentified: ["Retrasos"] },
        },
        linkData: { companyName: "Empresa sin contacto" },
      });

      deepStrictEqual(result.missingRequiredFields.slice(-2), [
        DiscoveryRequiredField.CONTACT_INFORMATION,
        DiscoveryRequiredField.REQUIRED_CONSENT,
      ]);
    },
  },
  {
    name: "Completion does not accept a generic reply as commercial evidence",
    run: () => {
      const result = validateDiscoveryCompletion({
        dossierPayload: {
          dossier: { industry: "Otros", employees: 0, priority: "Sin prioridad definida" },
          conversationHistory: [
            {
              role: "aura",
              content: "¿Cuál es el giro de tu empresa y cuál es su reto administrativo más importante?",
            },
            { role: "user", content: "ok" },
          ],
          businessAssessmentDraft: {},
        },
        linkData,
      });

      deepStrictEqual(result.missingRequiredFields.slice(0, 3), [
        DiscoveryRequiredField.ACTIVITY_OR_OFFERING,
        DiscoveryRequiredField.PRIMARY_NEED,
        DiscoveryRequiredField.OBJECTIVE,
      ]);
    },
  },
  {
    name: "Report identity comes from the requested session and keeps advisor separate",
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
  {
    name: "Reports do not mix identity between sessions",
    run: () => {
      const build = (suffix: string) =>
        buildDiscoveryReportViewModel({
          reportId: `dossier-${suffix}_EXTERNAL_RADIOGRAFIA_v1.0`,
          deliveryLevel: "ALLOW_FULL",
          folio: `FOLIO-${suffix}`,
          generatedAt: "2026-07-22T18:00:00.000Z",
          sessionData: {
            companyName: `Empresa ${suffix}`,
            contactName: `Contacto ${suffix}`,
            businessAssessmentDraft: {},
          },
        });
      const first = build("A");
      const second = build("B");

      strictEqual(first.companyName, "Empresa A");
      strictEqual(second.companyName, "Empresa B");
      strictEqual(first.contactName, "Contacto A");
      strictEqual(second.contactName, "Contacto B");
      strictEqual(second.reportId, "dossier-B_EXTERNAL_RADIOGRAFIA_v1.0");
    },
  },
  {
    name: "Report refuses fixture fallback when session identity is absent",
    run: () => {
      let errorCode = "";
      try {
        buildDiscoveryReportViewModel({
          reportId: "dossier-missing_EXTERNAL_RADIOGRAFIA_v1.0",
          deliveryLevel: "ALLOW_FULL",
          folio: "FOLIO-MISSING",
          generatedAt: "2026-07-22T18:00:00.000Z",
          sessionData: { businessAssessmentDraft: {} },
        });
      } catch (error: unknown) {
        errorCode = error instanceof Error ? error.message : "UNKNOWN";
      }
      strictEqual(errorCode, "DISCOVERY_SESSION_IDENTITY_MISSING");
    },
  },
  {
    name: "Insufficient evidence removes placeholder findings and fixed score",
    run: () => {
      const viewModel = buildDiscoveryReportViewModel({
        reportId: "dossier-empty_EXTERNAL_RADIOGRAFIA_v1.0",
        deliveryLevel: "ALLOW_FULL",
        folio: "FOLIO-EMPTY",
        generatedAt: "2026-07-22T18:00:00.000Z",
        sessionData: {
          companyName: "Empresa Real",
          contactName: "Contacto Real",
          businessAssessmentDraft: { score: 50 },
          executiveBriefingDraft: {
            keyObservations: ["Hallazgo 1", "Hallazgo 2"],
          },
        },
      });

      strictEqual(viewModel.maturityScore, undefined);
      deepStrictEqual(viewModel.keyFindings, []);
      strictEqual(viewModel.overallStatus, "Evidencia insuficiente");
      strictEqual(viewModel.evidenceStatus, "INSUFFICIENT");
      strictEqual(viewModel.isPreliminary, true);
      strictEqual(viewModel.diagnosisSource, "LEGACY_FALLBACK");
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
