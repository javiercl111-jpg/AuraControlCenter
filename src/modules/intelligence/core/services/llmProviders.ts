import type { ILLMProvider, LLMMessage, LLMOptions, LLMResponse } from "../types/llm";

/**
 * Base abstract class that implements common LLM operations like prompt formatting
 * and structured output simulation for all swapped models.
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  public abstract readonly providerId: string;
  public abstract readonly displayName: string;

  public async generateCompletion(
    messages: LLMMessage[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    const formattedPrompt = this.formatMessages(messages);
    const start = Date.now();

    // Simulating response stub to keep the platform agnostic and runnable without keys
    const mockReply = `[${this.displayName} response stub] Analysed ${messages.length} messages. Temp: ${
      options?.temperature ?? 0.7
    }. Prompt length: ${formattedPrompt.length} chars.`;

    return {
      text: mockReply,
      model: options?.modelId ?? "default-model",
      usage: {
        promptTokens: Math.ceil(formattedPrompt.length / 4),
        completionTokens: Math.ceil(mockReply.length / 4),
        totalTokens: Math.ceil(formattedPrompt.length / 4) + Math.ceil(mockReply.length / 4),
      },
      latencyMs: Date.now() - start,
      raw: { provider: this.providerId, options },
    };
  }

  public async generateStructuredOutput<T>(
    _messages: LLMMessage[],
    schema: Record<string, unknown> | string,
    _options?: LLMOptions
  ): Promise<T> {
    console.log(
      `[${this.displayName}] Simulating structured output enforcement with schema/spec:`,
      schema
    );

    // Stubs generate placeholder structures based on standard requirements.
    // In production, this would trigger JSON output modes or manual parsing layers.
    const stubResult = this.createMockStructuredOutput<T>(schema);

    return Promise.resolve(stubResult);
  }

  protected formatMessages(messages: LLMMessage[]): string {
    return messages
      .map((m) => `[${m.role.toUpperCase()}]${m.name ? ` (${m.name})` : ""}: ${m.content}`)
      .join("\n\n");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createMockStructuredOutput<T>(schema: any): T {
    // Generate simple compliant JSON stubs depending on schema details.
    const keys = typeof schema === "string" ? [schema] : Object.keys(schema);
    const mockObj: Record<string, unknown> = {};

    keys.forEach((key) => {
      mockObj[key] = `Simulated data for key: ${key}`;
    });

    return mockObj as unknown as T;
  }
}

// ----------------------------------------------------
// Specific Model Providers
// ----------------------------------------------------

export class GeminiProvider extends BaseLLMProvider {
  public readonly providerId = "gemini";
  public readonly displayName = "Google Gemini";
}

export class ChatGPTProvider extends BaseLLMProvider {
  public readonly providerId = "openai";
  public readonly displayName = "OpenAI ChatGPT";
}

export class ClaudeProvider extends BaseLLMProvider {
  public readonly providerId = "claude";
  public readonly displayName = "Anthropic Claude";
}

export class AzureOpenAIProvider extends BaseLLMProvider {
  public readonly providerId = "azure-openai";
  public readonly displayName = "Microsoft Azure OpenAI";
}

export class LlamaProvider extends BaseLLMProvider {
  public readonly providerId = "llama";
  public readonly displayName = "Meta Llama (Ollama)";
}

export class MistralProvider extends BaseLLMProvider {
  public readonly providerId = "mistral";
  public readonly displayName = "Mistral AI";
}

// ----------------------------------------------------
// Central Provider Manager / Factory
// ----------------------------------------------------

export class LLMProviderFactory {
  private static providers: Map<string, ILLMProvider> = new Map();

  static {
    // Register default providers
    const gemini = new GeminiProvider();
    const openai = new ChatGPTProvider();
    const claude = new ClaudeProvider();
    const azure = new AzureOpenAIProvider();
    const llama = new LlamaProvider();
    const mistral = new MistralProvider();

    this.providers.set(gemini.providerId, gemini);
    this.providers.set(openai.providerId, openai);
    this.providers.set(claude.providerId, claude);
    this.providers.set(azure.providerId, azure);
    this.providers.set(llama.providerId, llama);
    this.providers.set(mistral.providerId, mistral);
  }

  /**
   * Retrieves an instance of a registered LLM provider.
   */
  public static getProvider(providerId: string): ILLMProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`LLM Provider with ID "${providerId}" is not registered.`);
    }
    return provider;
  }

  /**
   * Registers a new custom model provider dynamically.
   */
  public static registerProvider(provider: ILLMProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  /**
   * Lists all available LLM providers.
   */
  public static listProviders(): Array<{ id: string; name: string }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.providerId,
      name: p.displayName,
    }));
  }
}

export default LLMProviderFactory;
