export * from './domain/types';
export * from './domain/validation';
export * from './services/CoverageCalculator';
export * from './services/CoverageDecisionEngine';

import CoverageTypesModule from './domain/types';
import CoverageValidationModule from './domain/validation';
import CoverageCalculator from './services/CoverageCalculator';
import CoverageDecisionEngine from './services/CoverageDecisionEngine';

const CoverageModule = {
  types: CoverageTypesModule,
  validation: CoverageValidationModule,
  calculator: CoverageCalculator,
  decisionEngine: CoverageDecisionEngine,
};

export default CoverageModule;
