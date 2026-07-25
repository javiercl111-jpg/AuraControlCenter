import type { EnterpriseMentalModel, EnterpriseKnowledgeGraph } from '../../index';
import type { TurnExtractionResult } from '../domain/types';
import { applyEnterpriseEvidence, registerKnowledgeGap } from '../../services/modelUpdater';
import { upsertGraphNode, addGraphRelationship, applyRelationshipEvidence } from '../../graph/services/operations';

export interface ApplierResult {
  mentalModel: EnterpriseMentalModel;
  knowledgeGraph: EnterpriseKnowledgeGraph;
  extractionResult: TurnExtractionResult;
}

export class ExtractionApplier {
  /**
   * Safe application of an extraction result to the EMM and EKG.
   * Returns a new immutable state.
   */
  public applyExtraction(
    currentMentalModel: EnterpriseMentalModel,
    currentGraph: EnterpriseKnowledgeGraph,
    extractionResult: TurnExtractionResult
  ): ApplierResult {
    let nextMentalModel = currentMentalModel;
    let nextGraph = currentGraph;

    // 1. Aplicar evidencias directas, correcciones y contradicciones al EMM
    const allEvidence = [
      ...extractionResult.evidence,
      ...extractionResult.corrections,
      ...extractionResult.contradictions
    ];

    for (const ev of allEvidence) {
      nextMentalModel = applyEnterpriseEvidence(nextMentalModel, ev);
    }

    // 2. Aplicar Knowledge Gaps
    for (const gap of extractionResult.knowledgeGaps) {
      nextMentalModel = registerKnowledgeGap(nextMentalModel, gap);
    }

    // Mapa temporal para traducir IDs de propuestas a IDs reales en el EKG
    const nodeIdMap = new Map<string, string>();

    // 3. Aplicar nodos propuestos al EKG
    for (const node of extractionResult.nodeProposals) {
      const { graph, nodeId } = upsertGraphNode(
        nextGraph,
        node.type,
        node.label,
        node.properties
      );
      nextGraph = graph;
      nodeIdMap.set(node.id, nodeId);
    }

    // 4. Aplicar relaciones propuestas al EKG
    for (const rel of extractionResult.relationshipProposals) {
      try {
        const actualSourceId = nodeIdMap.get(rel.sourceId) || rel.sourceId;
        const actualTargetId = nodeIdMap.get(rel.targetId) || rel.targetId;

        const { graph, relationshipId } = addGraphRelationship(
          nextGraph,
          actualSourceId,
          actualTargetId,
          rel.type,
          rel.properties
        );
        nextGraph = graph;

        // Associate evidence with the relationship
        for (const evId of rel.evidenceRefs) {
          const evidenceObj = nextMentalModel.evidences[evId];
          if (evidenceObj) {
            nextGraph = applyRelationshipEvidence(
              nextGraph,
              relationshipId,
              evId,
              [evidenceObj]
            );
          }
        }
      } catch {
        // En caso de que source/target no existan o haya fallo de integridad,
        // lo ignoramos para mantener el estado safe (fail-closed pero tolerante a omisiones).
        // console.warn("Failed to apply relationship", e);
      }
    }

    return {
      mentalModel: nextMentalModel,
      knowledgeGraph: nextGraph,
      extractionResult
    };
  }
}

export default ExtractionApplier;
