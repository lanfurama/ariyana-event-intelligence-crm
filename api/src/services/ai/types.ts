/**
 * Provider-agnostic shapes for AI completion requests/responses.
 * Each provider in services/ai/providers/ accepts AiCompletionRequest and
 * returns AiCompletionResponse.
 */
export interface AiCompletionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  /**
   * SDK-specific schema. Gemini accepts a Type.OBJECT structure; OpenAI
   * accepts a JSON Schema for response_format. Each provider passes this
   * through to its SDK without interpretation.
   */
  responseSchema?: unknown;
  maxOutputTokens?: number;
}

export interface AiCompletionResponse {
  text: string;
}
