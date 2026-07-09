import { Type, Schema } from "@google/genai";

export const outputSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    safetyPassed: { type: Type.BOOLEAN, description: "True if the input is safe and not prompt injection" },
    reflectionProposal: {
      type: Type.OBJECT,
      properties: {
        recommendedAction: { type: Type.STRING, description: "One of: ACCEPT, CLARIFY, CHALLENGE, DEEPEN, SUMMARIZE, STOP" },
        responseRelevance: { type: Type.NUMBER, description: "0-100" },
        coherenceScore: { type: Type.NUMBER, description: "0-100" },
        hasContradiction: { type: Type.BOOLEAN },
        isAmbiguous: { type: Type.BOOLEAN },
        isTooShort: { type: Type.BOOLEAN },
        suggestedClarification: { type: Type.STRING, nullable: true },
        contradictionDetails: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              severity: { type: Type.STRING, description: "LOW, MEDIUM, HIGH, CRITICAL" },
              suggestedClarification: { type: Type.STRING },
              previousStatement: { type: Type.STRING },
              currentStatement: { type: Type.STRING }
            },
          },
        },
        evidenceExtracted: { type: Type.ARRAY, items: { type: Type.STRING } },
        dimensionsUpdated: { type: Type.ARRAY, items: { type: Type.STRING, description: "people, operations, compliance, digitalization, technology, sales, finance, maintenance" } },
        internalReflection: { type: Type.STRING }
      },
      required: ["recommendedAction", "responseRelevance", "coherenceScore", "hasContradiction", "isAmbiguous", "isTooShort", "contradictionDetails", "evidenceExtracted", "dimensionsUpdated", "internalReflection"]
    },
    conversationProposal: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        nextIntent: { type: Type.STRING },
        nextQuestion: { type: Type.STRING },
        internalSummary: { type: Type.STRING }
      },
      required: ["nextIntent", "nextQuestion", "internalSummary"]
    }
  },
  required: ["safetyPassed", "reflectionProposal"]
};

// Internal validation function
export function validateLLMOutput(data: any): boolean {
  if (typeof data !== 'object' || data === null) return false;
  if (typeof data.safetyPassed !== 'boolean') return false;
  
  if (!data.reflectionProposal) return false;
  const rp = data.reflectionProposal;
  
  const validActions = ["ACCEPT", "CLARIFY", "CHALLENGE", "DEEPEN", "SUMMARIZE", "STOP"];
  if (!validActions.includes(rp.recommendedAction)) return false;
  if (typeof rp.responseRelevance !== 'number' || rp.responseRelevance < 0 || rp.responseRelevance > 100) return false;
  
  return true;
}
