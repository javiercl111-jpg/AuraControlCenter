import type { CommercialDecisionInput, CommercialOpportunity } from '../types';
import { CommercialOpportunityCode } from '../types';

export class OpportunityEvaluator {
  static evaluate(input: CommercialDecisionInput): CommercialOpportunity[] {
    const opportunities: CommercialOpportunity[] = [];

    // Evaluate for HR / Payroll
    if (input.dossier?.painPoints.some(p => p.description.toLowerCase().includes('nómina') || p.description.toLowerCase().includes('rh'))) {
      opportunities.push({
        code: CommercialOpportunityCode.PAYROLL,
        confidence: 85,
        evidence: ['Pain points explicitly mention HR or Payroll processes.'],
        businessImpact: 'Reduce manual payroll errors and improve employee satisfaction.',
        relevantAuraCapabilities: ['Aura HCM Core', 'Aura Payroll Engine'],
        priority: 'HIGH'
      });
    }

    // Evaluate for Maintenance
    if (input.prospectMetadata.industria.toLowerCase().includes('manufactura') || input.prospectMetadata.industria.toLowerCase().includes('hotel')) {
      opportunities.push({
        code: CommercialOpportunityCode.MAINTENANCE,
        confidence: 75,
        evidence: [`Industry (${input.prospectMetadata.industria}) typically requires strong asset maintenance.`],
        businessImpact: 'Minimize equipment downtime and extend asset lifecycles.',
        relevantAuraCapabilities: ['Aura Maintenance Suite'],
        priority: 'MEDIUM'
      });
    }

    // Evaluate for Digitalization
    if (input.dossier?.digitalMaturity !== undefined && input.dossier.digitalMaturity < 40) {
      opportunities.push({
        code: CommercialOpportunityCode.DIGITALIZATION,
        confidence: 90,
        evidence: [`Digital maturity is low (${input.dossier.digitalMaturity}).`],
        businessImpact: 'Modernize core operations from paper-based to cloud-native.',
        relevantAuraCapabilities: ['Aura Core Data Platform'],
        priority: 'HIGH'
      });
    }

    return opportunities;
  }
}
