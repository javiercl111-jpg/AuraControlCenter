import type { 
  CommercialDecisionInput, 
  CommercialDecisionOutput,
  MeetingAgendaItem
} from '../types';

import { RiskEvaluator } from './RiskEvaluator';
import { OpportunityEvaluator } from './OpportunityEvaluator';
import { OpportunityScoreCalculator } from './OpportunityScoreCalculator';
import { ClosingProbabilityCalculator } from './ClosingProbabilityCalculator';
import { NextActionEngine } from './NextActionEngine';
import { TimelineEngine } from './TimelineEngine';

export interface EvaluationContext {
  currentDate?: string;
}

export class CommercialDecisionEngine {
  static evaluate(
    input: CommercialDecisionInput,
    context?: EvaluationContext
  ): CommercialDecisionOutput {
    const evaluationDate = context?.currentDate ?? new Date().toISOString();

    // 1. Evaluate Risks
    const risks = RiskEvaluator.evaluate(input);

    // 2. Evaluate Opportunities
    const opportunities = OpportunityEvaluator.evaluate(input);

    // 3. Calculate Score
    const opportunityScore = OpportunityScoreCalculator.calculate(input, risks);

    // 4. Calculate Probability of Closing
    const probabilityOfClosing = ClosingProbabilityCalculator.calculate(input);

    // 5. Determine Next Action
    const nextAction = NextActionEngine.evaluate(input, opportunityScore);

    // 6. Generate Timeline
    const timeline = TimelineEngine.generate(input, evaluationDate);

    // 7. Generate Meeting Agenda (Dynamic based on Next Action and Score)
    const meetingAgenda: MeetingAgendaItem[] = [
      { order: 1, topic: 'Presentación', description: 'Presentación ejecutiva de Aura y equipo.' },
      { order: 2, topic: 'Validar hallazgos', description: 'Confirmar los puntos identificados en el Discovery.' },
      { order: 3, topic: 'Explicar Radiografía', description: 'Revisión del estado de madurez digital y salud.' },
      { order: 4, topic: 'Profundizar dolor principal', description: 'Abordar las áreas de oportunidad más críticas.' },
      { order: 5, topic: 'Presentar escenarios', description: 'Mostrar cómo Aura resuelve sus retos.' },
      { order: 6, topic: 'Definir siguientes pasos', description: 'Acordar fechas y responsables.' },
    ];

    // Build Justification
    const justification = `Recomendamos ${nextAction.action} dado que el Opportunity Score es ${opportunityScore.total} (${nextAction.priority} priority). ` +
      `La decisión se tomó porque: ${nextAction.rationale} ` +
      `Identificamos ${risks.length} riesgos comerciales y ${opportunities.length} oportunidades clave. ` +
      `La probabilidad de cierre se estima en ${probabilityOfClosing.probability}%.`;

    return {
      opportunityScore,
      priority: nextAction.priority,
      action: {
        code: nextAction.action,
        rationale: nextAction.rationale,
        confidence: nextAction.confidence
      },
      timing: nextAction.timing,
      channel: nextAction.channel,
      risks,
      opportunities,
      meetingAgenda,
      recommendedPresentation: nextAction.presentation,
      probabilityOfClosing,
      timeline,
      justification
    };
  }
}
