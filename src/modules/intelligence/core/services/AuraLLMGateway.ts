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
      console.warn("AuraLLMGateway failed, returning fallback flag.");
      
      let safeErrorCode = "NETWORK_OR_SERVER_ERROR";
      
      if (error.message === "LLM_TIMEOUT" || error?.code === "functions/deadline-exceeded") {
        safeErrorCode = "LLM_TIMEOUT";
      } else if (error?.code === "functions/unauthenticated" || error?.code === "functions/failed-precondition") {
        safeErrorCode = "APP_CHECK_REQUIRED";
      } else if (error?.code === "functions/resource-exhausted") {
        safeErrorCode = "RATE_LIMITED";
      } else if (error?.code === "functions/internal" || error?.code === "functions/unavailable") {
        safeErrorCode = "LLM_UNAVAILABLE";
      }

      return {
        fallbackUsed: true,
        safeErrorCode
      };
    }
  }
}

export default AuraLLMGateway;
