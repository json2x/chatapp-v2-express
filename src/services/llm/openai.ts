import OpenAI from 'openai';
import { ChatMessage, LLMServiceProviderInterface } from '../../types';

export class OpenAIService implements LLMServiceProviderInterface {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });

    if (!this.client) {
      throw new Error('OpenAI client initialization failed. Please check your API key.');
    }
  }

  /**
   * Stream a chat completion from OpenAI
   */
  async *streamChatCompletion(
    model: string,
    messages: ChatMessage[],
    options?: any
  ): AsyncGenerator<any, void, unknown> {
    try {
      // Convert messages to OpenAI format
      const openaiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Create stream
      const stream = await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        stream: true,
        ...options,
      });

      // Type assertion to ensure the stream is an async iterable
      const asyncIterable = stream as unknown as AsyncIterable<any>;
      for await (const chunk of asyncIterable) {
        yield chunk;
      }
    } catch (error) {
      console.error('Error in OpenAI stream:', error);
      throw error;
    }
  }

  /**
   * Get a complete chat completion from OpenAI by collecting all chunks from the stream
   */
  async getFullCompletionFromStream(
    model: string,
    messages: ChatMessage[],
    options?: any
  ): Promise<string> {
    let fullContent = '';

    try {
      // Use the stream method and collect all chunks
      for await (const chunk of this.streamChatCompletion(model, messages, options)) {
        if (chunk.choices && chunk.choices.length > 0) {
          const delta = chunk.choices[0].delta;
          const content = delta.content || '';
          fullContent += content;
        }
      }

      return fullContent;
    } catch (error) {
      console.error('Error getting full completion from OpenAI:', error);
      throw error;
    }
  }
}
