import type { TurnExtractionResult, ExtractionContext, EvidenceExtractionProvider } from '../domain/types';
import { validateTurnExtractionResult } from '../domain/validation';

export class ConversationalExtractor {
  private provider: EvidenceExtractionProvider;
  
  constructor(provider: EvidenceExtractionProvider) {
    this.provider = provider;
  }

  /**
   * Extracts evidence and graph proposals from a turn, validates them strictly,
   * and ensures fail-closed behavior on rule violation.
   */
  public extractFromTurn(
    text: string,
    context: ExtractionContext
  ): TurnExtractionResult {
    // 1. Delegar al proveedor puro la extracción
    const rawResult = this.provider.extract(text, context);

    // 2. Validar el resultado estrictamente
    const isValid = validateTurnExtractionResult(rawResult);

    if (!isValid) {
      // Fail-closed: si el extractor provee un modelo inválido (alucinación de tipos, 
      // confianzas raras, causas sin evidencia, etc.), lo rechazamos.
      return {
        evidence: [],
        nodeProposals: [],
        relationshipProposals: [],
        corrections: [],
        contradictions: [],
        knowledgeGaps: []
      };
    }

    // 3. Devolver resultado validado (ya con IDs deterministas provistos por el provider o inyectados allí)
    return rawResult;
  }
}

export default ConversationalExtractor;
