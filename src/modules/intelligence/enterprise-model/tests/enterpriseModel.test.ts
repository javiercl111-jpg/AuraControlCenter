// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import {
  createEmptyEnterpriseMentalModel,
  applyEnterpriseEvidence,
  registerHypothesis,
  confirmHypothesis,
  contradictHypothesis,
  rejectHypothesis,
  registerKnowledgeGap,
  resolveKnowledgeGap,
} from '../services/modelUpdater';
import { EvidenceSourceType } from '../domain/evidence';
import type { EnterpriseEvidence } from '../domain/evidence';
import { seedModelByIndustry } from '../seeds/industrySeeder';
import {
  getCandidateDomains,
  getHighestPriorityPainPoints,
  getUnresolvedKnowledgeGaps,
  getWeakestKnowledgeAreas,
  getEvidenceForEntity,
  getModelCoverage,
  getContradictedHypotheses,
} from '../selectors/modelSelectors';
import type { EnterpriseHypothesis, KnowledgeGap } from '../domain/types';

describe('Enterprise Mental Model Foundation', () => {
  it('1. Should create a valid empty model', () => {
    const model = createEmptyEnterpriseMentalModel();
    expect(model.identity).toBeDefined();
    expect(model.strategicContext).toBeDefined();
    expect(model.domains).toEqual({});
    expect(model.productApplicability).toEqual({});
    
    // 14. No dependency with Aura products
    expect(Object.keys(model)).not.toContain('hcm');
    expect(Object.keys(model)).not.toContain('crm');
  });

  it('2. Direct user evidence increases confidence', () => {
    let model = createEmptyEnterpriseMentalModel();
    
    // Need to initialize the entity first to apply evidence
    model.painPoints['pp_1'] = {
      painPointId: 'pp_1',
      statement: 'Manual payroll is slow',
      category: 'PAYROLL',
      impact: 'HIGH',
      frequency: 'WEEKLY',
      urgency: 'HIGH',
      status: 'UNKNOWN',
      confidence: 0,
      evidenceRefs: [],
    };

    const evidence: EnterpriseEvidence = {
      evidenceId: 'ev_1',
      sessionId: 's_1',
      turnId: 't_1',
      source: 'conv',
      sourceType: EvidenceSourceType.USER_STATEMENT,
      originalText: 'Payroll is too slow',
      normalizedStatement: 'Payroll processing is slow',
      category: 'PAYROLL',
      entityRefs: ['pp_1'],
      capturedAt: Date.now(),
      reliability: 1.0,
      directness: 1.0,
      polarity: 'POSITIVE',
      extractorVersion: '1.0',
      metadata: {},
    };

    model = applyEnterpriseEvidence(model, evidence);
    const painPoint = model.painPoints['pp_1'];
    expect(painPoint.confidence).toBeGreaterThan(0.8);
    expect(painPoint.status).toBe('CONFIRMED');
  });

  it('3. Inferred evidence weighs less than direct statement', () => {
    let model1 = createEmptyEnterpriseMentalModel();
    model1.risks['r_1'] = { riskId: 'r_1', statement: 'Risk A', category: 'A', status: 'UNKNOWN', confidence: 0, evidenceRefs: [], probability: null, impact: null, severity: null };
    
    const evDirect: EnterpriseEvidence = {
      evidenceId: 'ev_direct', sessionId: 's_1', turnId: 't_1', source: 'conv',
      sourceType: EvidenceSourceType.USER_STATEMENT, originalText: 'Risk A exists', normalizedStatement: 'Risk A exists',
      category: 'A', entityRefs: ['r_1'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };
    
    let model2 = createEmptyEnterpriseMentalModel();
    model2.risks['r_1'] = { riskId: 'r_1', statement: 'Risk A', category: 'A', status: 'UNKNOWN', confidence: 0, evidenceRefs: [], probability: null, impact: null, severity: null };
    
    const evInferred: EnterpriseEvidence = {
      evidenceId: 'ev_inferred', sessionId: 's_1', turnId: 't_1', source: 'conv',
      sourceType: EvidenceSourceType.DERIVED_INFERENCE, originalText: null, normalizedStatement: 'Risk A exists',
      category: 'A', entityRefs: ['r_1'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };

    model1 = applyEnterpriseEvidence(model1, evDirect);
    model2 = applyEnterpriseEvidence(model2, evInferred);

    expect(model1.risks['r_1'].confidence).toBeGreaterThan(model2.risks['r_1'].confidence);
    expect(model1.risks['r_1'].status).toBe('CONFIRMED');
    expect(model2.risks['r_1'].status).toBe('PARTIALLY_SUPPORTED');
  });

  it('4. Duplicate evidence is not applied twice (idempotency)', () => {
    let model = createEmptyEnterpriseMentalModel();
    model.painPoints['pp_1'] = { painPointId: 'pp_1', statement: 'Pain', category: 'A', status: 'UNKNOWN', confidence: 0, evidenceRefs: [], impact: null, frequency: null, urgency: null };

    const evidence: EnterpriseEvidence = {
      evidenceId: 'ev_dup', sessionId: 's_1', turnId: 't_1', source: 'conv',
      sourceType: EvidenceSourceType.USER_STATEMENT, originalText: 'Pain', normalizedStatement: 'Pain',
      category: 'A', entityRefs: ['pp_1'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };

    model = applyEnterpriseEvidence(model, evidence);
    const firstConfidence = model.painPoints['pp_1'].confidence;

    model = applyEnterpriseEvidence(model, evidence); // Apply again
    const secondConfidence = model.painPoints['pp_1'].confidence;

    expect(firstConfidence).toBe(secondConfidence);
    expect(model.painPoints['pp_1'].evidenceRefs.length).toBe(1);
  });

  it('5. Contradictory evidence reduces confidence or changes status', () => {
    let model = createEmptyEnterpriseMentalModel();
    model.capabilities['cap_1'] = { capabilityId: 'cap_1', name: 'Cap', status: 'UNKNOWN', confidence: 0, evidenceRefs: [], currentMaturity: null, targetMaturity: null, gap: null };

    const evPos: EnterpriseEvidence = {
      evidenceId: 'ev_pos', sessionId: 's_1', turnId: 't_1', source: 'conv',
      sourceType: EvidenceSourceType.USER_STATEMENT, originalText: 'We have Cap', normalizedStatement: 'Has Cap',
      category: 'A', entityRefs: ['cap_1'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };

    const evNeg: EnterpriseEvidence = {
      evidenceId: 'ev_neg', sessionId: 's_1', turnId: 't_2', source: 'conv',
      sourceType: EvidenceSourceType.USER_CORRECTION, originalText: 'No we do not have Cap', normalizedStatement: 'Does not have Cap',
      category: 'A', entityRefs: ['cap_1'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'NEGATIVE', extractorVersion: '1.0', metadata: {}
    };

    model = applyEnterpriseEvidence(model, evPos);
    expect(model.capabilities['cap_1'].status).toBe('CONFIRMED');

    model = applyEnterpriseEvidence(model, evNeg);
    expect(model.capabilities['cap_1'].status).toBe('REJECTED'); // User correction rejects it entirely based on our policy
    expect(model.capabilities['cap_1'].confidence).toBe(0);
  });

  it('6 & 7. Industry seeding creates candidate domains, hospitality creates maintenance but not confirmed', () => {
    let model = createEmptyEnterpriseMentalModel();
    model = seedModelByIndustry(model, 'hospitality');
    
    const candidates = getCandidateDomains(model);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some(d => d.name === 'Maintenance')).toBe(true);

    const maintenanceDomain = Object.values(model.domains).find(d => d.name === 'Maintenance');
    expect(maintenanceDomain?.status).toBe('CANDIDATE');
    expect(maintenanceDomain?.confidence).toBe(0);
  });

  it('8. A maintenance pain point only becomes confirmed after explicit evidence', () => {
    let model = createEmptyEnterpriseMentalModel();
    model = seedModelByIndustry(model, 'hospitality');
    
    model.painPoints['pp_maint'] = { painPointId: 'pp_maint', statement: 'Maintenance is chaotic', category: 'MAINTENANCE', impact: 'HIGH', frequency: 'DAILY', urgency: 'HIGH', status: 'UNKNOWN', confidence: 0, evidenceRefs: [] };

    // Initially UNKNOWN
    expect(model.painPoints['pp_maint'].status).toBe('UNKNOWN');

    const evPos: EnterpriseEvidence = {
      evidenceId: 'ev_maint', sessionId: 's_1', turnId: 't_1', source: 'conv',
      sourceType: EvidenceSourceType.USER_STATEMENT, originalText: 'Maint is bad', normalizedStatement: 'Maint is bad',
      category: 'MAINTENANCE', entityRefs: ['pp_maint'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };

    model = applyEnterpriseEvidence(model, evPos);
    expect(model.painPoints['pp_maint'].status).toBe('CONFIRMED');
    expect(getHighestPriorityPainPoints(model).length).toBe(1);
  });

  it('9. ProductApplicability remains empty before posterior evaluation', () => {
    const model = createEmptyEnterpriseMentalModel();
    expect(Object.keys(model.productApplicability).length).toBe(0);
  });

  it('10. Selectors identify knowledge gaps', () => {
    let model = createEmptyEnterpriseMentalModel();
    const gap: KnowledgeGap = { gapId: 'kg_1', domain: 'Finance', question: 'What is the budget?', importance: 'HIGH', blocking: false, status: 'OPEN', relatedEntityRefs: [] };
    
    model = registerKnowledgeGap(model, gap);
    
    let gaps = getUnresolvedKnowledgeGaps(model);
    expect(gaps.length).toBe(1);
    expect(gaps[0].gapId).toBe('kg_1');

    model = resolveKnowledgeGap(model, 'kg_1');
    gaps = getUnresolvedKnowledgeGaps(model);
    expect(gaps.length).toBe(0);
  });

  it('11. Coverage increases when relevant evidence is added', () => {
    let model = createEmptyEnterpriseMentalModel();
    const initialCoverage = getModelCoverage(model).score;

    model.identity.industry = 'manufacturing'; // +10

    model.objectives['obj_1'] = { objectiveId: 'obj_1', statement: 'Grow', horizon: '1Y', priority: 'HIGH', successSignals: [], status: 'UNKNOWN', confidence: 0, evidenceRefs: [] };
    
    const evObj: EnterpriseEvidence = {
      evidenceId: 'ev_obj', sessionId: 's_1', turnId: 't_1', source: 'conv',
      sourceType: EvidenceSourceType.USER_STATEMENT, originalText: 'Grow', normalizedStatement: 'Grow',
      category: 'GROWTH', entityRefs: ['obj_1'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };

    model = applyEnterpriseEvidence(model, evObj); // +5 for confirmed fact
    const finalCoverage = getModelCoverage(model).score;

    expect(finalCoverage).toBeGreaterThan(initialCoverage);
  });

  it('12. Two equivalent sequences of evidence produce same final state', () => {
    const ev1: EnterpriseEvidence = {
      evidenceId: 'ev1', sessionId: 's_1', turnId: 't_1', source: 'conv',
      sourceType: EvidenceSourceType.USER_STATEMENT, originalText: 'Grow', normalizedStatement: 'Grow',
      category: 'GROWTH', entityRefs: ['obj_1'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };
    const ev2: EnterpriseEvidence = {
      evidenceId: 'ev2', sessionId: 's_1', turnId: 't_2', source: 'conv',
      sourceType: EvidenceSourceType.SYSTEM_OBSERVATION, originalText: 'Fast growth', normalizedStatement: 'Fast growth',
      category: 'GROWTH', entityRefs: ['obj_1'], capturedAt: Date.now(), reliability: 0.8, directness: 0.8, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };

    let model1 = createEmptyEnterpriseMentalModel();
    model1.objectives['obj_1'] = { objectiveId: 'obj_1', statement: 'Grow', horizon: '1Y', priority: 'HIGH', successSignals: [], status: 'UNKNOWN', confidence: 0, evidenceRefs: [] };
    model1 = applyEnterpriseEvidence(model1, ev1);
    model1 = applyEnterpriseEvidence(model1, ev2);

    let model2 = createEmptyEnterpriseMentalModel();
    model2.objectives['obj_1'] = { objectiveId: 'obj_1', statement: 'Grow', horizon: '1Y', priority: 'HIGH', successSignals: [], status: 'UNKNOWN', confidence: 0, evidenceRefs: [] };
    model2 = applyEnterpriseEvidence(model2, ev2);
    model2 = applyEnterpriseEvidence(model2, ev1);

    expect(model1.objectives['obj_1'].confidence).toBe(model2.objectives['obj_1'].confidence);
    expect(model1.objectives['obj_1'].status).toBe(model2.objectives['obj_1'].status);
  });

  it('13. Model preserves traceability evidenceRefs', () => {
    let model = createEmptyEnterpriseMentalModel();
    model.objectives['obj_1'] = { objectiveId: 'obj_1', statement: 'Grow', horizon: '1Y', priority: 'HIGH', successSignals: [], status: 'UNKNOWN', confidence: 0, evidenceRefs: [] };
    
    const ev1: EnterpriseEvidence = {
      evidenceId: 'ev1', sessionId: 's_1', turnId: 't_1', source: 'conv',
      sourceType: EvidenceSourceType.USER_STATEMENT, originalText: 'Grow', normalizedStatement: 'Grow',
      category: 'GROWTH', entityRefs: ['obj_1'], capturedAt: Date.now(), reliability: 1.0, directness: 1.0, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
    };

    model = applyEnterpriseEvidence(model, ev1);

    const relatedEvidence = getEvidenceForEntity(model, 'obj_1');
    expect(relatedEvidence.length).toBe(1);
    expect(relatedEvidence[0].evidenceId).toBe('ev1');
  });

  it('Tests Hypothesis lifecycle (contradict, reject, confirm)', () => {
    let model = createEmptyEnterpriseMentalModel();
    const hyp: EnterpriseHypothesis = {
      hypothesisId: 'h_1', statement: 'Will buy', category: 'SALES', status: 'UNKNOWN',
      confidence: 0, supportingEvidenceRefs: [], contradictingEvidenceRefs: [], createdAt: 1, updatedAt: 1
    };

    model = registerHypothesis(model, hyp);
    expect(model.hypotheses['h_1']).toBeDefined();

    model = contradictHypothesis(model, 'h_1', ['ev1']);
    expect(model.hypotheses['h_1'].status).toBe('CONTRADICTED');
    expect(getContradictedHypotheses(model).length).toBe(1);

    model = rejectHypothesis(model, 'h_1', ['ev2']);
    expect(model.hypotheses['h_1'].status).toBe('REJECTED');

    model = confirmHypothesis(model, 'h_1', ['ev3']);
    expect(model.hypotheses['h_1'].status).toBe('CONFIRMED');
  });

  it('Tests getWeakestKnowledgeAreas', () => {
    const model = createEmptyEnterpriseMentalModel();
    model.domains['d1'] = { domainId: 'd1', name: 'D1', category: 'C', status: 'CONFIRMED', confidence: 0.9, evidenceRefs: [], processes: [], risks: [], painPoints: [], objectives: [], capabilities: [] };
    model.domains['d2'] = { domainId: 'd2', name: 'D2', category: 'C', status: 'CANDIDATE', confidence: 0, evidenceRefs: [], processes: [], risks: [], painPoints: [], objectives: [], capabilities: [] };

    const weakest = getWeakestKnowledgeAreas(model);
    expect(weakest[0].domainId).toBe('d2'); // lowest confidence
    expect(weakest[1].domainId).toBe('d1');
  });
});
