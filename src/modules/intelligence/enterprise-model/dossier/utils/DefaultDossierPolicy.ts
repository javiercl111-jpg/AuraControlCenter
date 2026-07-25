import type { DossierPolicy, MaturityLevel } from '../domain/types';

export class DefaultDossierPolicy implements DossierPolicy {
  getLevels(): MaturityLevel[] {
    return ['INITIAL', 'EMERGING', 'MANAGED', 'INTEGRATED', 'OPTIMIZING'];
  }

  evaluateScore(score: number): MaturityLevel {
    if (score < 0.2) return 'INITIAL';
    if (score < 0.4) return 'EMERGING';
    if (score < 0.6) return 'MANAGED';
    if (score < 0.8) return 'INTEGRATED';
    return 'OPTIMIZING';
  }
}

export default DefaultDossierPolicy;
