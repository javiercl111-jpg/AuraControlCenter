import { getFunctions, httpsCallable as callFunction } from "firebase/functions";
import { firebaseApp as app } from "../../../../config/firebase";

export class AuraLLMGateway {
  private evaluateFn = callFunction(getFunctions(app), "evaluateConversation");

  public async evaluateTurn(orchestratorInput: any): Promise<any> {
    const TIMEOUT_MS = 12000; // 12 seconds
    
    try {
      const callPromise = this.evaluateFn(orchestratorInput);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("LLM_TIMEOUT")), TIMEOUT_MS)
      );

      const result = await Promise.race([callPromise, timeoutPromise]) as any;
      
      return result.data;
    } catch (error: any) {
      console.warn("AuraLLMGateway failed, returning fallback flag:", error);
      return {
        fallbackUsed: true,
        safeErrorCode: error.message === "LLM_TIMEOUT" ? "TIMEOUT" : "NETWORK_OR_SERVER_ERROR"
      };
    }
  }
}

export default AuraLLMGateway;
