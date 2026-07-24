import type { TurnExtractionResult } from './types';
import { EvidenceSourceType } from '../../domain/evidence';

const VALID_RELATIONSHIP_TYPES = new Set([
  'AFFECTS', 'CAUSES', 'RELATED_TO', 'DEPENDS_ON',
  'MITIGATES', 'EXACERBATES', 'CONTAINS', 'IMPLEMENTS', 'RESOLVES'
]);

export function validateTurnExtractionResult(result: TurnExtractionResult): boolean {
  try {
    // 1. Validar confidencias en rango 0-1 y trazabilidad
    const allEvidence = [
      ...result.evidence,
      ...result.corrections,
      ...result.contradictions
    ];

    const evidenceIds = new Set<string>();

    for (const ev of allEvidence) {
      if (ev.reliability < 0 || ev.reliability > 1) return false;
      if (ev.directness < 0 || ev.directness > 1) return false;
      if (!ev.sessionId || !ev.turnId || !ev.evidenceId) return false;
      
      // Tipos o categorías desconocidas (en base a EvidenceSourceType)
      if (!Object.values(EvidenceSourceType).includes(ev.sourceType as EvidenceSourceType)) {
        return false;
      }
      
      evidenceIds.add(ev.evidenceId);
    }

    // 2. Hechos sin evidencia, referencias incompletas
    for (const node of result.nodeProposals) {
      if (!node.id || !node.type) return false;
    }

    for (const rel of result.relationshipProposals) {
      if (!rel.id || !rel.sourceId || !rel.targetId) return false;
      
      // Relaciones con nodos inválidos (asumiendo que deben conectar algo que existe o se propone)
      // Nota: En un sistema real, algunos nodos ya existen en el grafo, pero 
      // al menos type y validación del set de relaciones.
      if (!VALID_RELATIONSHIP_TYPES.has(rel.type)) return false;

      // Confianza fuera de rango
      if (rel.confidence < 0 || rel.confidence > 1) return false;

      // CAUSES sin causalidad explícita o evidencia
      if (rel.type === 'CAUSES' && (!rel.evidenceRefs || rel.evidenceRefs.length === 0)) {
        return false;
      }
      
      // Referencias de evidencia deben ser array válido
      if (!Array.isArray(rel.evidenceRefs)) return false;
      
      // Hechos sin evidencia (si una relación se propone, debería tener evidencias que la soporten
      // aunque algunas puedan venir de evidencia ya existente, para extracción estricta exigimos que al menos cite alguna)
      if (rel.evidenceRefs.length === 0) return false;
    }

    return true;
  } catch {
    // Comportamiento fail-closed ante errores inesperados
    return false;
  }
}

export default validateTurnExtractionResult;
