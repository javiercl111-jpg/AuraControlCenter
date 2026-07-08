export type LLMRole = "system" | "user" | "assistant" | "tool";

export interface LLMMessage {
  role: LLMRole;
  content: string;
  name?: string;
}

export interface LLMOptions {
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  responseFormat?: "text" | "json";
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  text: string;
  usage?: LLMUsage;
  model: string;
  latencyMs?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

export interface ILLMProvider {
  providerId: string;
  displayName: string;
  generateCompletion(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  generateStructuredOutput<T>(
    messages: LLMMessage[],
    schema: Record<string, unknown> | string,
    options?: LLMOptions
  ): Promise<T>;
}

const LLM = {};
export default LLM;
