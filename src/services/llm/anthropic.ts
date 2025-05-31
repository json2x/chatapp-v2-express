import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage, LLMServiceProviderInterface } from '../../types';

export class AnthropicService implements LLMServiceProviderInterface {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });

    if (!this.client) {
      throw new Error('Anthropic client initialization failed. Please check your API key.');
    }
  }

  /**
   * Stream a chat completion from Anthropic
   */
  async *streamChatCompletion(
    model: string,
    messages: ChatMessage[],
    options?: any
  ): AsyncGenerator<any, void, unknown> {
    try {
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertToAnthropicMessages(messages);

      // Create stream
      const stream = await this.client.messages.create({
        model,
        messages: anthropicMessages,
        stream: true,
        max_tokens: options?.max_tokens || 4096,
        temperature: options?.temperature,
      });

      // Yield chunks from the stream
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      console.error('Error in Anthropic stream:', error);
      throw error;
    }
  }

  /**
   * Get a complete chat completion from Anthropic by collecting all chunks from the stream
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
        if (chunk.delta && chunk.delta.text) {
          fullContent += chunk.delta.text;
        }
      }

      return fullContent;
    } catch (error) {
      console.error('Error getting full completion from Anthropic:', error);
      throw error;
    }
  }

  /**
   * Convert standard chat messages to Anthropic format
   */
  private convertToAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];
    
    // Extract system message if present
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
    
    // Combine all system messages into a single system prompt if needed
    let systemPrompt = '';
    if (systemMessages.length > 0) {
      systemPrompt = systemMessages.map(msg => msg.content).join('\n\n');
    }
    
    // Convert non-system messages to Anthropic format
    for (const msg of nonSystemMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        result.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    
    return result;
  }
}
