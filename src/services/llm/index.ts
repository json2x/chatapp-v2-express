import { ChatMessage, Provider, MODEL_PROVIDER_MAP, CONVERSATION_MESSAGES_THRESHOLD, LLMServiceProviderInterface } from '../../types';
import { OpenAIService } from './openai';
import { AnthropicService } from './anthropic';
import { PrismaClient } from '@prisma/client';

// Create Prisma client instance
const prisma = new PrismaClient();

class LLMServiceProvider {
  private providers: Record<Provider, LLMServiceProviderInterface | undefined> = {
    [Provider.OPENAI]: undefined,
    [Provider.ANTHROPIC]: undefined,
  };

  constructor() {
    try {
      this.providers[Provider.OPENAI] = new OpenAIService();
      console.log('OpenAI provider initialized');
    } catch (error) {
      console.warn(`Warning: OpenAI provider not initialized: ${error}`);
    }

    try {
      this.providers[Provider.ANTHROPIC] = new AnthropicService();
      console.log('Anthropic provider initialized');
    } catch (error) {
      console.warn(`Warning: Anthropic provider not initialized: ${error}`);
    }
  }

  /**
   * Get the appropriate provider for the given model
   */
  getProviderForModel(model: string): Provider {
    if (model in MODEL_PROVIDER_MAP) {
      return MODEL_PROVIDER_MAP[model];
    }

    // Try to infer provider from model name prefix
    if (model.startsWith('gpt-') || model.startsWith('text-')) {
      return Provider.OPENAI;
    } else if (model.startsWith('claude-')) {
      return Provider.ANTHROPIC;
    }

    throw new Error(`Unsupported model: ${model}. Available models: ${Object.keys(MODEL_PROVIDER_MAP).join(', ')}`);
  }

  /**
   * Stream a chat completion from the appropriate provider based on the model
   */
  async *streamChat(
    model: string,
    messages: ChatMessage[],
    options?: any
  ): AsyncGenerator<any, void, unknown> {
    const providerName = this.getProviderForModel(model);
    const provider = this.providers[providerName];

    if (!provider) {
      const availableProviders = Object.keys(this.providers).filter(
        (key) => this.providers[key as Provider] !== undefined
      );
      throw new Error(
        `Provider ${providerName} is not initialized. ` +
        `Available providers: ${availableProviders.join(', ')}. ` +
        `Please provide a valid API key for ${providerName}.`
      );
    }

    yield* provider.streamChatCompletion(model, messages, options);
  }

  /**
   * Get a complete chat completion from the appropriate provider based on the model
   */
  async getChatCompletion(
    model: string,
    messages: ChatMessage[],
    options?: any
  ): Promise<string> {
    const providerName = this.getProviderForModel(model);
    const provider = this.providers[providerName];

    if (!provider) {
      const availableProviders = Object.keys(this.providers).filter(
        (key) => this.providers[key as Provider] !== undefined
      );
      throw new Error(
        `Provider ${providerName} is not initialized. ` +
        `Available providers: ${availableProviders.join(', ')}. ` +
        `Please provide a valid API key for ${providerName}.`
      );
    }

    return provider.getFullCompletionFromStream(model, messages, options);
  }

  /**
   * Get a dictionary of available models grouped by provider
   */
  getAvailableModels(): Record<string, string[]> {
    const availableModels: Record<string, string[]> = {};

    for (const providerName of Object.keys(this.providers)) {
      if (this.providers[providerName as Provider]) {
        availableModels[providerName] = Object.entries(MODEL_PROVIDER_MAP)
          .filter(([_, provider]) => provider === providerName)
          .map(([model, _]) => model);
      }
    }

    return availableModels;
  }

  /**
   * Fetch messages for a conversation and handle summarization for long conversations
   */
  async getMessageHistory(
    conversationId: string,
    summarize: boolean = true
  ): Promise<ChatMessage[]> {
    // Fetch the conversation from the database
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: true },
    });

    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }

    // Convert database messages to the format expected by LLM providers
    let messages: ChatMessage[] = conversation.messages
      .filter((msg) => ['user', 'assistant', 'system'].includes(msg.role))
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

    // Prepend the system prompt from the conversation record if it exists
    if (conversation.systemPrompt) {
      messages.unshift({ role: 'system', content: conversation.systemPrompt });
    }

    // If messages don't exceed threshold, return as is
    if (messages.length <= CONVERSATION_MESSAGES_THRESHOLD) {
      return messages;
    }

    // If summarize is false, return all messages without summarization
    if (!summarize) {
      return messages;
    }

    // Split messages: keep recent ones and summarize older ones
    const recentMessages = messages.slice(-CONVERSATION_MESSAGES_THRESHOLD);
    const olderMessages = messages.slice(0, -CONVERSATION_MESSAGES_THRESHOLD);

    // Only summarize if there are older messages
    if (olderMessages.length > 0) {
      try {
        // Generate a summary of the older messages
        const summary = await this.briefSummaryOfConversationHistory(olderMessages);

        // Add the summary as a system message at the beginning
        const summaryMessage: ChatMessage = {
          role: 'system',
          content: `Summary of previous conversation: \n${summary}`,
        };

        // Return the summary followed by recent messages
        return [summaryMessage, ...recentMessages];
      } catch (error) {
        // If summarization fails, log the error and return just the recent messages
        console.error(`Error summarizing conversation history: ${error}`);
        return recentMessages;
      }
    }

    // If we somehow got here, return the recent messages
    return recentMessages;
  }

  /**
   * Generate a brief summary of the conversation history in bullet points
   */
  async briefSummaryOfConversationHistory(
    messages: ChatMessage[],
    maxTokens: number = 500,
    temperature: number = 0.3
  ): Promise<string> {
    // Check if OpenAI provider is available
    if (!this.providers[Provider.OPENAI]) {
      throw new Error('OpenAI provider is not initialized. Please provide a valid OpenAI API key.');
    }

    // Always use gpt-4o-mini model for summarization
    const model = 'gpt-4o-mini';

    // Process messages to replace image/attachment references with <resource /> tag
    const processedMessages = messages.map((msg: ChatMessage) => {
      const processedMsg = { ...msg };

      if (processedMsg.content) {
        // Replace image markdown format ![alt](url)
        processedMsg.content = processedMsg.content.replace(/!\[.*?\]\(.*?\)/g, '<resource />');

        // Replace HTML image tags
        processedMsg.content = processedMsg.content.replace(/<img[^>]*>/g, '<resource />');

        // Replace base64 encoded images
        processedMsg.content = processedMsg.content.replace(/data:image\/[^;]+;base64,[^\"\s]+/g, '<resource />');

        // Replace attachment references
        processedMsg.content = processedMsg.content.replace(/\[attachment:.*?\]/g, '<resource />');
      }

      return processedMsg;
    });

    // Create a system message instructing the model to create a summary
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'You are a helpful assistant that summarizes conversations. ' +
        'Create a concise summary of the following conversation in bullet points. ' +
        'Focus on the main topics, questions, and answers. ' +
        'Be factual and objective. Do not add information not present in the conversation. ' +
        'Format your response as a list of bullet points using the \'- \' prefix.',
    };

    // Create a user message with the instruction
    const userMessage: ChatMessage = {
      role: 'user',
      content: 'Please summarize the following conversation in bullet points:\n\n' +
        processedMessages.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n'),
    };

    // Generate the summary
    return this.getChatCompletion(
      model,
      [systemMessage, userMessage],
      { max_tokens: maxTokens, temperature }
    );
  }
}

// Create a singleton instance for easy import
export const llmService = new LLMServiceProvider();
