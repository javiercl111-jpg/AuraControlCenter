export * from './domain/types';
export * from './domain/validation';
export * from './domain/adapters';
export * from './services/KnowledgeObjectiveEngine';
export * from './services/StrategyPlanner';
export * from './services/QuestionIntentBuilder';
export * from './services/QuestionRealizationProvider';
export * from './services/QuestionPlanEvaluator';
export * from './services/AdaptiveQuestionPlanner';

import PlanningTypesModule from './domain/types';
import PlanningValidationModule from './domain/validation';
import CoverageAdapter from './domain/adapters';
import KnowledgeObjectiveEngine from './services/KnowledgeObjectiveEngine';
import StrategyPlanner from './services/StrategyPlanner';
import QuestionIntentBuilder from './services/QuestionIntentBuilder';
import QuestionRealizationProviderModule from './services/QuestionRealizationProvider';
import QuestionPlanEvaluator from './services/QuestionPlanEvaluator';
import AdaptiveQuestionPlanner from './services/AdaptiveQuestionPlanner';

const PlanningModule = {
  types: PlanningTypesModule,
  validation: PlanningValidationModule,
  adapter: CoverageAdapter,
  objectiveEngine: KnowledgeObjectiveEngine,
  strategyPlanner: StrategyPlanner,
  intentBuilder: QuestionIntentBuilder,
  realizationProvider: QuestionRealizationProviderModule,
  evaluator: QuestionPlanEvaluator,
  planner: AdaptiveQuestionPlanner,
};

export default PlanningModule;
