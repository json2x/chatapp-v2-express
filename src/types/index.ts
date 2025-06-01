// Common types for the application

export enum Provider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

// Model to provider mapping
export const MODEL_PROVIDER_MAP: Record<string, Provider> = {
  'gpt-4o': Provider.OPENAI,
  'gpt-4o-mini': Provider.OPENAI,
  'gpt-4-turbo': Provider.OPENAI,
  'gpt-4': Provider.OPENAI,
  'gpt-3.5-turbo': Provider.OPENAI,
  'claude-3-5-sonnet-20240620': Provider.ANTHROPIC,
  'claude-3-opus-20240229': Provider.ANTHROPIC,
  'claude-3-sonnet-20240229': Provider.ANTHROPIC,
  'claude-3-haiku-20240307': Provider.ANTHROPIC,
};

// Conversation message threshold for summarization
export const CONVERSATION_MESSAGES_THRESHOLD = 20;

// Chat message types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Chat request types
export interface ChatRequest {
  model: string;
  message: string;
  conversation_id?: string;
  system_prompt?: string;
  summarize_history?: boolean;
}

// Chat response types
export interface ChatStreamResponse {
  content: string;
  done: boolean;
  conversation_id?: string;
  error?: string;
}

// Conversation types
export interface ConversationSummary {
  id: string;
  title: string;
  subtitle?: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  model: string;
  message_count: number;
  metadata?: Record<string, any>;
}

export interface Conversation extends ConversationSummary {
  system_prompt?: string;
  messages: MessageSummary[];
}

// Message types
export interface MessageSummary {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  tokens?: number;
  model?: string;
  metadata?: Record<string, any>;
}

// Delete response type
export interface DeleteResponse {
  message: string;
}

// LLM Service Provider types
export interface LLMServiceProviderInterface {
  streamChatCompletion(model: string, messages: ChatMessage[], options?: any): AsyncGenerator<any, void, unknown>;
  getFullCompletionFromStream(model: string, messages: ChatMessage[], options?: any): Promise<string>;
}
