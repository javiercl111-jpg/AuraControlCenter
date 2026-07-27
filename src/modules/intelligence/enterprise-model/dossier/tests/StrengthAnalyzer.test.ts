import { describe, it, expect } from 'vitest';
import { StrengthAnalyzer } from '../services/StrengthAnalyzer';
import { MaturityEvaluator } from '../services/MaturityEvaluator';
import { DefaultDossierPolicy } from '../utils/DefaultDossierPolicy';
import { DefaultDossierExecutionContext } from '../utils/DossierContextImpl';
import type { DiagnosticContext } from '../services/DiagnosticContextBuilder';
import type { ExecutiveFinding, EnterpriseOpportunity, ExecutiveReasoningReport } from '../../reasoning/domain/types';

describe('StrengthAnalyzer', () => {
  const policy = new DefaultDossierPolicy();
  const evaluator = new MaturityEvaluator(policy);
  const contextProvider = new DefaultDossierExecutionContext('exec-1', 'time-1');
  const analyzer = new StrengthAnalyzer(contextProvider, evaluator);

  const createContext = (findings: ExecutiveFinding[], opportunities: EnterpriseOpportunity[]): DiagnosticContext => ({
    report: {} as unknown as ExecutiveReasoningReport,
    status: 'VALID',
    blocks: [],
    findings,
    risks: [],
    opportunities,
    rootCauses: [],
    audit: { rejectedClaims: [] }
  });

  it('should extract strengths exclusively from SUPPORTED_FINDING and OPPORTUNITY', () => {
    const findings: ExecutiveFinding[] = [
      {
        findingId: 'f1',
        statement: 'Good Finding',
        type: 'FINDING',
        status: 'SUPPORTED_FINDING',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.95 },
        chain: { chainId: 'c1', logicDescription: '', claims: [] }
      },
      {
        findingId: 'f2',
        statement: 'Bad Risk',
        type: 'RISK',
        status: 'SUPPORTED_FINDING',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.9 },
        chain: { chainId: 'c2', logicDescription: '', claims: [] }
      }
    ];

    const context = createContext(findings, []);
    const strengths = analyzer.analyze(context);
    
    expect(strengths).toHaveLength(1);
    expect(strengths[0].description).toBe('Good Finding');
    expect(strengths[0].impact).toBe('CRITICAL');
  });

  it('should ignore PARTIALLY_SUPPORTED findings', () => {
    const findings: ExecutiveFinding[] = [
      {
        findingId: 'f1',
        statement: 'Ok Finding',
        type: 'FINDING',
        status: 'PARTIALLY_SUPPORTED',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.8 },
        chain: { chainId: 'c1', logicDescription: '', claims: [] }
      }
    ];
    const context = createContext(findings, []);
    const strengths = analyzer.analyze(context);
    expect(strengths).toHaveLength(0);
  });

  it('should extract strengths from supported opportunities', () => {
    const opportunities: EnterpriseOpportunity[] = [
      {
        findingId: 'opp1',
        statement: 'New Market',
        type: 'OPPORTUNITY',
        status: 'SUPPORTED_FINDING',
        potentialValue: 'High',
        effort: 'Low',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.85 },
        chain: { chainId: 'c1', logicDescription: '', claims: [] }
      }
    ];
    const context = createContext([], opportunities);
    const strengths = analyzer.analyze(context);
    
    expect(strengths).toHaveLength(1);
    expect(strengths[0].description).toBe('New Market');
    expect(strengths[0].impact).toBe('HIGH'); // 0.85 -> HIGH
    expect(strengths[0].supportingFindings).toContain('opp1');
  });

  it('should assign MODERATE impact if confidence is exactly 0.7', () => {
    const findings: ExecutiveFinding[] = [
      {
        findingId: 'f1',
        statement: 'Ok Finding',
        type: 'FINDING',
        status: 'SUPPORTED_FINDING',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.7 },
        chain: { chainId: 'c1', logicDescription: '', claims: [] }
      }
    ];
    const context = createContext(findings, []);
    const strengths = analyzer.analyze(context);
    expect(strengths).toHaveLength(1);
    expect(strengths[0].impact).toBe('MODERATE');
  });

  it('should ignore opportunities with status other than SUPPORTED_FINDING', () => {
    const opportunities: EnterpriseOpportunity[] = [
      {
        findingId: 'opp2',
        statement: 'Maybe',
        type: 'OPPORTUNITY',
        status: 'REQUIRES_MORE_EVIDENCE',
        potentialValue: 'High',
        effort: 'Low',
        confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.9 },
        chain: { chainId: 'c1', logicDescription: '', claims: [] }
      }
    ];
    const context = createContext([], opportunities);
    const strengths = analyzer.analyze(context);
    expect(strengths).toHaveLength(0);
  });
});
