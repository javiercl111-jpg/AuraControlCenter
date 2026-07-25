// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { MaturityEvaluator } from '../services/MaturityEvaluator';
import { DefaultDossierPolicy } from '../utils/DefaultDossierPolicy';
import type { DiagnosticContext } from '../services/DiagnosticContextBuilder';
import type { ExecutiveFinding, ExecutiveReasoningReport, ReasoningClaim } from '../../reasoning/domain/types';

describe('MaturityEvaluator', () => {
  const policy = new DefaultDossierPolicy();
  const evaluator = new MaturityEvaluator(policy);

  const createContext = (findings: ExecutiveFinding[]): DiagnosticContext => ({
    report: {} as unknown as ExecutiveReasoningReport,
    status: 'VALID',
    blocks: [],
    findings,
    risks: [],
    opportunities: [],
    rootCauses: [],
    audit: { rejectedClaims: [] }
  });

  it('should assign INITIAL and GENERAL if no evidence is present', () => {
    const context = createContext([]);
    const assessments = evaluator.evaluate(context);
    expect(assessments).toHaveLength(1);
    expect(assessments[0].dimension).toBe('GENERAL');
    expect(assessments[0].level).toBe('INITIAL');
    expect(assessments[0].score).toBe(0);
    expect(assessments[0].evidenceRefs).toHaveLength(0);
  });

  it('should assign OPTIMIZING when high-confidence positive findings dominate a dimension', () => {
    const findings: ExecutiveFinding[] = [
      {
        findingId: 'f1',
        statement: 'Great',
        type: 'FINDING',
        status: 'SUPPORTED_FINDING',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.9 },
        chain: { chainId: 'c1', logicDescription: '', claims: [{ sourceNodes: ['TECH:n1'] } as unknown as ReasoningClaim] }
      },
      {
        findingId: 'f2',
        statement: 'Awesome',
        type: 'FINDING',
        status: 'SUPPORTED_FINDING',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.85 },
        chain: { chainId: 'c2', logicDescription: '', claims: [{ sourceNodes: ['TECH:n2'] } as unknown as ReasoningClaim] }
      }
    ];
    const context = createContext(findings);
    const assessments = evaluator.evaluate(context);
    expect(assessments).toHaveLength(1);
    expect(assessments[0].dimension).toBe('TECH');
    expect(assessments[0].level).toBe('OPTIMIZING');
    expect(assessments[0].score).toBeCloseTo(0.875);
    expect(assessments[0].evidenceRefs).toEqual(['f1', 'f2']);
  });

  it('should properly aggregate mixed findings into an average score', () => {
    const findings: ExecutiveFinding[] = [
      {
        findingId: 'f1',
        statement: 'Good',
        type: 'FINDING',
        status: 'SUPPORTED_FINDING',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.8 },
        chain: { chainId: 'c1', logicDescription: '', claims: [{ sourceNodes: ['HR:n1'] } as unknown as ReasoningClaim] }
      },
      {
        findingId: 'f2',
        statement: 'Bad Risk',
        type: 'RISK',
        status: 'SUPPORTED_FINDING',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.9 },
        chain: { chainId: 'c2', logicDescription: '', claims: [{ sourceNodes: ['HR:n2'] } as unknown as ReasoningClaim] }
      }
    ];
    // Risk score = 0.2 * (1 - 0.9) = 0.02
    // Good score = 0.8
    // Average = 0.41 -> MANAGED
    const context = createContext(findings);
    const assessments = evaluator.evaluate(context);
    expect(assessments).toHaveLength(1);
    expect(assessments[0].dimension).toBe('HR');
    expect(assessments[0].level).toBe('MANAGED');
    expect(assessments[0].score).toBeCloseTo(0.41);
  });

  it('should return INITIAL if average score is very low but not 0', () => {
    const findings: ExecutiveFinding[] = [
      {
        findingId: 'f1',
        statement: 'Almost useless finding',
        type: 'FINDING',
        status: 'PARTIALLY_SUPPORTED',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.1 },
        chain: { chainId: 'c1', logicDescription: '', claims: [{ sourceNodes: ['HR:n1'] } as unknown as ReasoningClaim] }
      }
    ];
    // Score = 0.1 * 0.5 = 0.05
    const context = createContext(findings);
    const assessments = evaluator.evaluate(context);
    expect(assessments[0].level).toBe('INITIAL');
    expect(assessments[0].score).toBeCloseTo(0.05);
  });

  it('extractDimension handles impactArea correctly', () => {
    const item = { impactArea: 'FINANCE' };
    expect(evaluator.extractDimension(item)).toBe('FINANCE');
  });
});
