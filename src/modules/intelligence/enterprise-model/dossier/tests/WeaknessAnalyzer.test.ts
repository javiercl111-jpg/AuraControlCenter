import { describe, it, expect } from 'vitest';
import { WeaknessAnalyzer } from '../services/WeaknessAnalyzer';
import { MaturityEvaluator } from '../services/MaturityEvaluator';
import { DefaultDossierPolicy } from '../utils/DefaultDossierPolicy';
import { DefaultDossierExecutionContext } from '../utils/DossierContextImpl';
import type { DiagnosticContext } from '../services/DiagnosticContextBuilder';
import type { EnterpriseRisk, RootCauseHypothesis, ExecutiveReasoningReport, ReasoningClaim } from '../../reasoning/domain/types';

describe('WeaknessAnalyzer', () => {
  const policy = new DefaultDossierPolicy();
  const evaluator = new MaturityEvaluator(policy);
  const contextProvider = new DefaultDossierExecutionContext('exec-1', 'time-1');
  const analyzer = new WeaknessAnalyzer(contextProvider, evaluator);

  const createContext = (risks: EnterpriseRisk[], rootCauses: RootCauseHypothesis[]): DiagnosticContext => ({
    report: {} as unknown as ExecutiveReasoningReport,
    status: 'VALID',
    blocks: [],
    findings: [],
    risks,
    opportunities: [],
    rootCauses,
    audit: { rejectedClaims: [] }
  });

  it('should synthesize weaknesses from RootCauseHypotheses and link risks', () => {
    const risks: EnterpriseRisk[] = [
      {
        findingId: 'r1',
        statement: 'Risk 1',
        type: 'RISK',
        status: 'SUPPORTED_FINDING',
        severity: 'HIGH',
        impactArea: 'FINANCE',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.8 },
        chain: { chainId: 'c1', logicDescription: '', claims: [] }
      }
    ];

    const rootCauses: RootCauseHypothesis[] = [
      {
        findingId: 'rc1',
        statement: 'Poor accounting',
        type: 'ROOT_CAUSE',
        status: 'SUPPORTED_FINDING',
        relatedFindings: ['r1'],
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.9 },
        chain: { chainId: 'c2', logicDescription: '', claims: [{ sourceNodes: ['FINANCE:1'] } as unknown as ReasoningClaim] }
      }
    ];

    const context = createContext(risks, rootCauses);
    const weaknesses = analyzer.analyze(context);

    expect(weaknesses).toHaveLength(1);
    expect(weaknesses[0].description).toBe('Poor accounting');
    expect(weaknesses[0].severity).toBe('HIGH'); // derived from risk severity
    expect(weaknesses[0].relatedRisks).toContain('r1');
    expect(weaknesses[0].rootCauses).toContain('rc1');
  });

  it('should aggregate remaining CRITICAL and HIGH risks by dimension', () => {
    const risks: EnterpriseRisk[] = [
      {
        findingId: 'r2',
        statement: 'Data leak',
        type: 'RISK',
        status: 'SUPPORTED_FINDING',
        severity: 'CRITICAL',
        impactArea: 'TECH',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.9 },
        chain: { chainId: 'c1', logicDescription: '', claims: [] }
      },
      {
        findingId: 'r3',
        statement: 'Old servers',
        type: 'RISK',
        status: 'SUPPORTED_FINDING',
        severity: 'HIGH',
        impactArea: 'TECH',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.8 },
        chain: { chainId: 'c2', logicDescription: '', claims: [] }
      }
    ];

    const context = createContext(risks, []);
    const weaknesses = analyzer.analyze(context);

    expect(weaknesses).toHaveLength(1);
    expect(weaknesses[0].dimension).toBe('TECH');
    expect(weaknesses[0].severity).toBe('CRITICAL');
    expect(weaknesses[0].relatedRisks).toContain('r2');
    expect(weaknesses[0].relatedRisks).toContain('r3');
    expect(weaknesses[0].rootCauses).toHaveLength(0);
    expect(weaknesses[0].description).toContain('Data leak');
    expect(weaknesses[0].description).toContain('Old servers');
  });

  it('should ignore LOW and MODERATE remaining risks', () => {
    const risks: EnterpriseRisk[] = [
      {
        findingId: 'r4',
        statement: 'Minor issue',
        type: 'RISK',
        status: 'SUPPORTED_FINDING',
        severity: 'LOW',
        impactArea: 'HR',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.4 },
        chain: { chainId: 'c1', logicDescription: '', claims: [] }
      }
    ];

    const context = createContext(risks, []);
    const weaknesses = analyzer.analyze(context);
    expect(weaknesses).toHaveLength(0);
  });

  it('should assign CRITICAL severity if a RootCause has no CRITICAL risks but root cause confidence is >= 0.9', () => {
    const rootCauses: RootCauseHypothesis[] = [
      {
        findingId: 'rc2',
        statement: 'Systemic failure',
        type: 'ROOT_CAUSE',
        status: 'SUPPORTED_FINDING',
        relatedFindings: [],
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.95 },
        chain: { chainId: 'c2', logicDescription: '', claims: [] }
      }
    ];

    const context = createContext([], rootCauses);
    const weaknesses = analyzer.analyze(context);
    expect(weaknesses).toHaveLength(1);
    expect(weaknesses[0].severity).toBe('CRITICAL');
  });

  it('should assign HIGH severity if a RootCause has no HIGH/CRITICAL risks but root cause confidence is >= 0.8', () => {
    const rootCauses: RootCauseHypothesis[] = [
      {
        findingId: 'rc3',
        statement: 'Major issue',
        type: 'ROOT_CAUSE',
        status: 'SUPPORTED_FINDING',
        relatedFindings: [],
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.85 },
        chain: { chainId: 'c3', logicDescription: '', claims: [] }
      }
    ];

    const context = createContext([], rootCauses);
    const weaknesses = analyzer.analyze(context);
    expect(weaknesses).toHaveLength(1);
    expect(weaknesses[0].severity).toBe('HIGH');
  });
});
