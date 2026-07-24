import type { EnterpriseMentalModel, OperationalDomain } from '../domain/types';
import { INDUSTRY_SEEDS } from './data';

/**
 * Initializes candidate domains in the Enterprise Mental Model based on the provided industry.
 * The domains are added as 'CANDIDATE' and with 0 confidence, adhering to the evidence-first principle.
 */
export function seedModelByIndustry(model: EnterpriseMentalModel, industryKey: string): EnterpriseMentalModel {
  const seeds = INDUSTRY_SEEDS[industryKey];
  if (!seeds) {
    return model;
  }

  const newDomains: Record<string, OperationalDomain> = { ...model.domains };

  for (const seed of seeds) {
    if (!newDomains[seed.id]) {
      newDomains[seed.id] = {
        domainId: seed.id,
        name: seed.name,
        category: 'INDUSTRY_DEFAULT',
        status: 'CANDIDATE',
        confidence: 0,
        evidenceRefs: [],
        processes: [],
        risks: [],
        painPoints: [],
        objectives: [],
        capabilities: [],
      };
    }
  }

  return {
    ...model,
    identity: {
      ...model.identity,
      industry: industryKey,
    },
    domains: newDomains,
  };
}
