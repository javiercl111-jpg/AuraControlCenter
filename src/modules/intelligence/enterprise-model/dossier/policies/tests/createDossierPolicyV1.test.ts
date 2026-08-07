import { describe, it, expect } from 'vitest';
import { createDossierPolicyV1 } from '../createDossierPolicyV1';
import { DefaultDossierPolicy } from '../../utils/DefaultDossierPolicy';
import { ExecutiveDossierBuilder } from '../../services/ExecutiveDossierBuilder';
import { NarrativeBuilder } from '../../services/NarrativeBuilder';
import type { DossierExecutionContext } from '../../domain/types';

describe('AEA-05-R1C.2 createDossierPolicyV1', () => {
  it('returns a valid DossierPolicy, specifically an instance of DefaultDossierPolicy', () => {
    const policy = createDossierPolicyV1();

    expect(policy).toBeDefined();
    expect(policy).toBeInstanceOf(DefaultDossierPolicy);
    expect(typeof policy.getLevels).toBe('function');
    expect(typeof policy.evaluateScore).toBe('function');
  });

  it('maintains exact behavior of DefaultDossierPolicy for getLevels', () => {
    const policy = createDossierPolicyV1();
    const reference = new DefaultDossierPolicy();

    expect(policy.getLevels()).toEqual(reference.getLevels());
  });

  it('maintains exact behavior of DefaultDossierPolicy for evaluateScore', () => {
    const policy = createDossierPolicyV1();
    const reference = new DefaultDossierPolicy();

    expect(policy.evaluateScore(0.1)).toEqual(reference.evaluateScore(0.1));
    expect(policy.evaluateScore(0.9)).toEqual(reference.evaluateScore(0.9));
  });

  it('two instances present the same semantics without shared mutable state', () => {
    const policy1 = createDossierPolicyV1();
    const policy2 = createDossierPolicyV1();

    expect(policy1).not.toBe(policy2); // Different instances
    expect(policy1.getLevels()).toEqual(policy2.getLevels());

    // Validate it has no mutable state properties to modify
    expect(Object.keys(policy1).length).toBe(0);
  });

  it('ExecutiveDossierBuilder accepts the generated policy and produces valid output', () => {
    const policy = createDossierPolicyV1();

    const context: DossierExecutionContext = {
      executionId: 'test-exec-id',
      timestamp: '2026-08-01T00:00:00Z',
      generateId: (namespace, data) => `${namespace}-${data}-id`,
    };

    const builder = new ExecutiveDossierBuilder(context, policy, new NarrativeBuilder());

    const reasoningReport = {
      reportId: 'test-report',
      executionId: 'test-exec-id',
      overallStatus: 'SUPPORTED_FINDING' as const,
      status: 'COMPLETE',
      timestamp: '2026-08-01T00:00:00Z',
      findings: [],
      risks: [],
      opportunities: [],
      rootCauses: [],
      rejectedClaims: [],
      readinessGaps: []
    };

    const dossier = builder.build(reasoningReport);

    expect(dossier).toBeDefined();
    expect(dossier.dossierId).toBeDefined();
    expect(dossier.diagnosticStatus).toBe('VALID'); // Given empty arrays, no findings means no issues, though logic might differ, as long as it executes.
    expect(dossier.businessDiagnosis.overallMaturity).toBeDefined();
  });
});
