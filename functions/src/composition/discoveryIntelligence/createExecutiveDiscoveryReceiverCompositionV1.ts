import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { AuthoritativeFeaturePolicyProducerV1, createTrustedServerPrincipalFromVerifiedBindingV1, createTrustedTenantMembershipFromAuthorityV1, createTrustedRequestIdentityV1, createTrustedServerRequestContextV1, getPipelineBootstrapTaxonomyEntry, PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES } from "@aura/intelligence-os/server";
import type { BoundaryExecutionPort, PipelineBootstrapTaxonomyCategory, TrustedServerRequestContextV1 } from "@aura/intelligence-os/server";
import { OidcServiceIdentityVerifierV1 } from "./OidcServiceIdentityVerifierV1";
import { FirestoreOidcServiceIdentityBindingResolverV1 } from "./FirestoreOidcServiceIdentityBindingResolverV1";
import { FirestoreAuthoritativeFeaturePolicySourceV1 } from "../../infrastructure/firestore/featurePolicy/FirestoreAuthoritativeFeaturePolicySourceV1";
import { createGovernedDiscoveryRuntimeCompositionV1 } from "./createGovernedDiscoveryRuntimeCompositionV1";
import { createIntelligenceExecutionCompositionV1 } from "../intelligenceExecutionComposition/createIntelligenceExecutionCompositionV1";
import type { ExecutiveDiscoveryApiRequest, ExecutiveDiscoveryEvidence } from "../../discovery/executive-intelligence/contracts/ExecutiveDiscoveryApiRequest";
import type { ExecutiveDiscoveryApiResponse } from "../../discovery/executive-intelligence/contracts/ExecutiveDiscoveryApiResponse";
import { mapInternalExecutionResultToExecutiveDiagnosisV1 } from "../../discovery/executive-intelligence/receiver/mapInternalExecutionResultToExecutiveDiagnosisV1";
import { isExecutiveDiscoveryApiRequest } from "../../discovery/executive-intelligence/adapter/validation";

export const EXECUTIVE_DISCOVERY_RECEIVER_AUDIENCE_V1 = "https://us-central1-aura-intel-preview.cloudfunctions.net/evaluateExecutiveDiscoveryV1";
export const EXECUTIVE_DISCOVERY_MAX_BODY_BYTES_V1 = 1_048_576;
export class ExecutiveDiscoveryReceiverFailureV1 extends Error { constructor(readonly status: 400 | 401 | 403 | 502, readonly safeCode: "INVALID_REQUEST" | "AUTHENTICATION_REQUIRED" | "ACCESS_FORBIDDEN" | "INVALID_EXECUTIVE_OUTPUT") { super(safeCode); this.name = "ExecutiveDiscoveryReceiverFailureV1"; } }
export interface ExecutiveDiscoveryReceiverOptionsV1 { readonly firestore: Firestore; readonly verifier?: Pick<OidcServiceIdentityVerifierV1, "verify">; readonly authorityResolver?: Pick<FirestoreOidcServiceIdentityBindingResolverV1, "resolveAuthority">; readonly executionAdapter?: BoundaryExecutionPort; readonly now?: () => string; readonly generateId?: () => string; }
const safeId = /^[A-Za-z0-9][A-Za-z0-9._:/|-]{0,179}$/;
const fields: Readonly<Record<string, PipelineBootstrapTaxonomyCategory>> = { "dossier.industry": "BUSINESS_INDUSTRY", "dossier.employees": "ORGANIZATION_EMPLOYEE_BAND", "dossier.schedulingMethod": "OPERATIONS_SCHEDULING_MODE", "dossier.payrollIncidents": "OPERATIONS_INCIDENT_SIGNAL", "dossier.priority": "EXECUTIVE_NORMALIZED_PRIORITY" };
function normalized(evidence: ExecutiveDiscoveryEvidence, category: PipelineBootstrapTaxonomyCategory): string | undefined {
  const value = evidence.normalizedValue ?? evidence.value;
  if (category === "ORGANIZATION_EMPLOYEE_BAND" && typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value <= 9 ? "1_9" : value <= 50 ? "10_50" : value <= 250 ? "51_250" : "251_PLUS";
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[ -]+/g, "_") : category === "OPERATIONS_INCIDENT_SIGNAL" && value === true ? "OBSERVED" : undefined;
}
export function buildExecutiveDiscoveryBusinessPayloadV1(request: ExecutiveDiscoveryApiRequest) {
  if (request?.consentAssertion?.privacyConsent !== true || request?.consentAssertion?.diagnosticProcessingConsent !== true) throw new ExecutiveDiscoveryReceiverFailureV1(400, "INVALID_REQUEST");
  if (!isExecutiveDiscoveryApiRequest(request) || request.capabilityVersion !== "1.0.0") throw new ExecutiveDiscoveryReceiverFailureV1(400, "INVALID_REQUEST");
  if (request.metadata && (Object.keys(request.metadata).some(key => !["source", "evaluationMode", "legacyDiagnosisVersion", "trustDecision"].includes(key)) || (request.metadata.evaluationMode !== undefined && request.metadata.evaluationMode !== "SHADOW"))) throw new ExecutiveDiscoveryReceiverFailureV1(400, "INVALID_REQUEST");
  const facts = request.evidence.flatMap(evidence => {
    const category = evidence.fieldId === undefined ? undefined : fields[evidence.fieldId];
    if (category === undefined) return [];
    if (evidence.consentScope !== "executive-diagnosis" || evidence.classification !== "USER_CONFIRMED" || !["STRUCTURED_FIELD", "USER_RESPONSE", "CONVERSATION_TURN"].includes(evidence.sourceType) || !safeId.test(evidence.evidenceId) || evidence.evidenceId !== evidence.evidenceId.trim()) throw new ExecutiveDiscoveryReceiverFailureV1(400, "INVALID_REQUEST");
    const value = normalized(evidence, category);
    const entry = getPipelineBootstrapTaxonomyEntry(category);
    if (value === undefined || !entry.allowedValues.includes(value) || evidence.sourceReference !== `discovery_sessions/${request.sessionId}#${evidence.fieldId}` || evidence.sourceReference.length > 180 || !/^discovery_sessions\/[A-Za-z0-9][A-Za-z0-9._:|-]*#[A-Za-z0-9][A-Za-z0-9._:|-]*$/.test(evidence.sourceReference)) throw new ExecutiveDiscoveryReceiverFailureV1(400, "INVALID_REQUEST");
    return [{ factId: evidence.evidenceId, category, value, valueType: "ENUM", provenance: { sourceType: "USER_CONFIRMATION", sourceId: evidence.sourceReference, collectionMethod: evidence.sourceType === "CONVERSATION_TURN" ? "CONVERSATION_RESPONSE" : "FORM_RESPONSE", capturedAt: Date.parse(evidence.capturedAt), reliability: "CONFIRMED", directness: "DIRECT", actorType: "USER" }, reliability: "CONFIRMED", directness: "DIRECT", polarity: "AFFIRMED", observedAt: Date.parse(evidence.capturedAt), schemaVersion: "1" }];
  });
  if (facts.length === 0) throw new ExecutiveDiscoveryReceiverFailureV1(400, "INVALID_REQUEST");
  return { schemaVersion: "1", targetScenario: { scenarioId: "PAYROLL_AUDIT", scenarioVersion: "1", objectiveKey: "ASSESS_PAYROLL_AUDIT_READINESS", requestedStages: [...PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES], source: "AUTHORIZED_SYSTEM_CONFIGURATION", explicitSelection: true }, facts, policy: { allowedTaxonomyVersion: "1", allowedScenarioVersion: "1", allowUnknownReliability: false, allowUncertainPolarity: false, allowInferredDirectness: false, allowedInferenceRuleIds: [], maxFacts: 500, maxFactValueSize: 256, maxTotalPayloadSize: EXECUTIVE_DISCOVERY_MAX_BODY_BYTES_V1, duplicateFactPolicy: "REJECT", conflictPolicy: "REJECT", failClosed: true, requireExplicitScenario: true }, locale: request.locale };
}
export function createExecutiveDiscoveryReceiverCompositionV1(options: ExecutiveDiscoveryReceiverOptionsV1) {
  const now = options.now ?? (() => new Date().toISOString()); const generateId = options.generateId ?? randomUUID;
  const verifier = options.verifier ?? new OidcServiceIdentityVerifierV1();
  const resolver = options.authorityResolver ?? new FirestoreOidcServiceIdentityBindingResolverV1(options.firestore, now);
  const featurePolicyPort = new AuthoritativeFeaturePolicyProducerV1(new FirestoreAuthoritativeFeaturePolicySourceV1(options.firestore));
  const adapter = options.executionAdapter ?? createIntelligenceExecutionCompositionV1().executionAdapter;
  return Object.freeze({
    async evaluate(authorizationHeader: string, request: ExecutiveDiscoveryApiRequest): Promise<ExecutiveDiscoveryApiResponse> {
      const payload = buildExecutiveDiscoveryBusinessPayloadV1(request);
      let verified: Awaited<ReturnType<OidcServiceIdentityVerifierV1["verify"]>>;
      try { verified = await verifier.verify({ authorizationHeader, expectedAudience: EXECUTIVE_DISCOVERY_RECEIVER_AUDIENCE_V1, verifiedAt: now() }); } catch { throw new ExecutiveDiscoveryReceiverFailureV1(401, "AUTHENTICATION_REQUIRED"); }
      let authority: Awaited<ReturnType<FirestoreOidcServiceIdentityBindingResolverV1["resolveAuthority"]>>;
      try { authority = await resolver.resolveAuthority({ verifiedGoogleSubject: verified.verifiedGoogleSubject, serviceAccountEmail: verified.serviceAccountEmail }); } catch { throw new ExecutiveDiscoveryReceiverFailureV1(403, "ACCESS_FORBIDDEN"); }
      let trustedContext: TrustedServerRequestContextV1;
      try {
        const principal = createTrustedServerPrincipalFromVerifiedBindingV1({ subject: verified.subject, binding: authority.binding });
        const membership = createTrustedTenantMembershipFromAuthorityV1({ principal, tenant: authority.tenant, membership: authority.membership, resolvedAt: authority.resolvedAt, resolverVersion: authority.binding.resolverVersion });
        const requestIdentity = createTrustedRequestIdentityV1({ schemaVersion: "1", requestId: generateId(), correlationId: generateId(), generationStrategy: "SERVER_GENERATED", generatedAt: now(), generatorVersion: "executive-discovery-receiver-v1" });
        trustedContext = createTrustedServerRequestContextV1({ schemaVersion: "1", transport: "HTTPS_FUNCTION", authenticatedPrincipal: principal, tenantMembership: membership, consumer: "AURA_DISCOVERY", source: "AURA_DISCOVERY", requestIdentity, initiatedAt: now(), requestedExecutionMode: "SHADOW_ONLY", cancellation: { schemaVersion: "1", transportAborted: false } });
      } catch { throw new ExecutiveDiscoveryReceiverFailureV1(403, "ACCESS_FORBIDDEN"); }
      let captured: unknown;
      const runtime = createGovernedDiscoveryRuntimeCompositionV1({ trustedContext, featurePolicyPort, clockPort: { now }, executionPort: { async execute(input, signal) { const context = input.authoritativeContext; if (!context || context.executionMode !== "SHADOW_ONLY" || context.actor.actorType !== "SERVICE" || context.actor.actorId !== trustedContext.authenticatedPrincipal.principalId || context.tenantId !== trustedContext.tenantMembership.tenantId || context.consumerId !== "AURA_DISCOVERY" || context.source !== "AURA_DISCOVERY" || context.requestId !== trustedContext.requestIdentity.requestId || context.correlationId !== trustedContext.requestIdentity.correlationId) throw new Error("EXECUTION_CONTEXT_REJECTED"); const result = await adapter.execute(input, signal); captured = result; return result; } } });
      const invocation = runtime.invocationContextProvider.create();
      const response = await runtime.boundary.execute({ requestId: invocation.requestId, correlationId: invocation.correlationId, tenant: { tenantId: invocation.tenantId }, actor: invocation.actor, source: invocation.source, requestedMode: "SHADOW_ONLY", payload }, invocation);
      if (response.status === "REJECTED") throw new ExecutiveDiscoveryReceiverFailureV1(403, "ACCESS_FORBIDDEN");
      if (response.mode !== "SHADOW_ONLY" || !["COMPLETED", "PARTIAL"].includes(response.status) || response.errors.length > 0) throw new ExecutiveDiscoveryReceiverFailureV1(502, "INVALID_EXECUTIVE_OUTPUT");
      let diagnosis;
      try { diagnosis = mapInternalExecutionResultToExecutiveDiagnosisV1(captured, request, invocation.correlationId); } catch { throw new ExecutiveDiscoveryReceiverFailureV1(502, "INVALID_EXECUTIVE_OUTPUT"); }
      return { status: 200, body: { success: true, data: diagnosis, meta: { correlationId: request.correlationId, warnings: diagnosis.warnings } } };
    },
  });
}
