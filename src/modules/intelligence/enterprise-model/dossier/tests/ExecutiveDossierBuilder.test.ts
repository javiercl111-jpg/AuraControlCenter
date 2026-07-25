// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { ExecutiveDossierBuilder } from '../services/ExecutiveDossierBuilder';
import { DefaultDossierExecutionContext } from '../utils/DossierContextImpl';
import { DefaultDossierPolicy } from '../utils/DefaultDossierPolicy';
import { NarrativeBuilder } from '../services/NarrativeBuilder';
import { ContextValidationError } from '../utils/validators';

describe('ExecutiveDossierBuilder', () => {
  const contextProvider = new DefaultDossierExecutionContext('exec-1', 'time-1');
  const policy = new DefaultDossierPolicy();
  const narrativeProvider = new NarrativeBuilder();

  const builder = new ExecutiveDossierBuilder(contextProvider, policy, narrativeProvider);

  it('should successfully orchestrate the full pipeline', () => {
    const report = {
      reportId: 'rep-1',
      timestamp: '2026-07-25T10:00:00Z',
      overallStatus: 'SUPPORTED_FINDING',
      findings: [
        {
          findingId: 'f1',
          statement: 'Good Finding',
          type: 'FINDING',
          status: 'SUPPORTED_FINDING',
          confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.95 },
          chain: { chainId: 'c1', logicDescription: '', claims: [{ sourceNodes: ['TECH:1'] }] }
        }
      ],
      risks: [
        {
          findingId: 'r1',
          statement: 'Data leak',
          type: 'RISK',
          status: 'SUPPORTED_FINDING',
          severity: 'CRITICAL',
          impactArea: 'TECH',
          confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.9 },
          chain: { chainId: 'c2', logicDescription: '', claims: [] }
        }
      ],
      opportunities: [],
      rootCauses: [],
      rejectedClaims: [],
      readinessGaps: []
    };

    const dossier = builder.build(report);
    
    expect(dossier.dossierId).toBeDefined();
    expect(dossier.diagnosticStatus).toBe('VALID');
    expect(dossier.businessDiagnosis.strengths).toHaveLength(1);
    expect(dossier.businessDiagnosis.weaknesses).toHaveLength(1);
    expect(dossier.priorities).toHaveLength(1);
    expect(dossier.recommendationCandidates).toHaveLength(1);
    expect(dossier.narrative.executiveSummary).toBeDefined();
    
    // Deterministic ID assignments
    expect(dossier.dossierId).toContain('DOSSIER');
  });

  it('should throw ContextValidationError if report is invalid', () => {
    expect(() => builder.build({})).toThrow(ContextValidationError);
  });

  it('should produce INSUFFICIENT_EVIDENCE dossier safely with 0 risks and opportunities', () => {
    const report = {
      reportId: 'rep-2',
      timestamp: '2026-07-25T10:00:00Z',
      overallStatus: 'NOT_DEFENDABLE',
      findings: [],
      risks: [],
      opportunities: [],
      rootCauses: [],
      rejectedClaims: [],
      readinessGaps: []
    };

    const dossier = builder.build(report);
    expect(dossier.diagnosticStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(dossier.blocks).toContain('Report overall status is NOT_DEFENDABLE');
    expect(dossier.businessDiagnosis.strengths).toHaveLength(0);
    expect(dossier.businessDiagnosis.weaknesses).toHaveLength(0);
    expect(dossier.priorities).toHaveLength(0);
    expect(dossier.narrative.executiveSummary).toContain('insufficient defendable evidence');
  });

  it('should evaluate maturity successfully even if report has zero findings but is VALID', () => {
    const report = {
      reportId: 'rep-3',
      timestamp: '2026-07-25T10:00:00Z',
      overallStatus: 'SUPPORTED_FINDING',
      findings: [],
      risks: [],
      opportunities: [],
      rootCauses: [],
      rejectedClaims: [],
      readinessGaps: []
    };

    const dossier = builder.build(report);
    expect(dossier.diagnosticStatus).toBe('VALID');
    expect(dossier.businessDiagnosis.overallMaturity).toBe('INITIAL');
    expect(dossier.businessDiagnosis.dimensionAssessments).toHaveLength(1);
    expect(dossier.businessDiagnosis.dimensionAssessments[0].dimension).toBe('GENERAL');
  });
});
