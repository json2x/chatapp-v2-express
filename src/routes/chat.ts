import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { llmService } from '../services/llm';
import { 
  createConversation, 
  addMessage, 
  getConversation,
  updateConversationSubtitle
} from '../services/database';
import { ChatRequest, ChatStreamResponse } from '../types';

const router = express.Router();

// Validation schema for chat request
const chatRequestSchema = z.object({
  model: z.string(),
  message: z.string(),
  conversation_id: z.string().optional(),
  system_prompt: z.string().optional(),
  summarize_history: z.boolean().default(false),
});

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Send a message and get a streaming response from the LLM
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: Streaming response from the LLM
 *         content:
 *           text/event-stream:
 *             schema:
 *               $ref: '#/components/schemas/ChatStreamResponse'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedRequest = chatRequestSchema.parse(req.body) as ChatRequest;

    // Define path to system prompt file and read its content
    const systemPromptFilePath = path.join(__dirname, '../../templates/prompts/system_prompt.txt');
    let fileSystemPrompt = '';
    try {
      fileSystemPrompt = fs.readFileSync(systemPromptFilePath, 'utf-8');
    } catch (err) {
      console.warn(`Warning: Could not read system prompt file at ${systemPromptFilePath}. Using default or request-provided prompt. Error:`, err);
      // Proceed without file-based system prompt if file read fails
    }
    
    const { 
      model, 
      message: userMessage, 
      conversation_id, // Use conversation_id directly from request
      system_prompt: requestSystemPrompt, // Renamed to avoid conflict
      summarize_history: summarizeHistory
    } = validatedRequest;

    // Determine the system prompt to use:
    // Start with the file-based prompt.
    // If a request-specific prompt is also provided, append it, separated by '-----'.
    let systemPrompt = fileSystemPrompt; // Default to file content

    if (requestSystemPrompt) {
      if (systemPrompt) { // If fileSystemPrompt was not empty
        systemPrompt += "\n-----\n" + requestSystemPrompt;
      } else { // If fileSystemPrompt was empty, just use requestSystemPrompt
        systemPrompt = requestSystemPrompt;
      }
    }
    // If requestSystemPrompt is not provided, systemPrompt remains as fileSystemPrompt.
    // If both fileSystemPrompt and requestSystemPrompt were empty, systemPrompt will be an empty string.
    
    // Check if the model is available
    const availableModels = llmService.getAvailableModels();
    let modelFound = false;
    
    for (const provider in availableModels) {
      if (availableModels[provider].includes(model)) {
        modelFound = true;
        break;
      }
    }
    
    if (!modelFound) {
      return res.status(400).json({ error: `Model '${model}' is not available` });
    }
    
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    let currentConversationId = conversation_id;
    
    // If no conversation_id is provided, create a new conversation
    if (!currentConversationId) {
      // Create a title from the first user message (truncated if too long)
      const title = userMessage.length > 50 
        ? `${userMessage.substring(0, 50)}...` 
        : userMessage;
      
      // Create a subtitle from the first few words of the message
      const subtitle = userMessage.split(' ').slice(0, 5).join(' ') + (userMessage.split(' ').length > 5 ? '...' : '');
      
      // Create a new conversation
      const conversation = await createConversation(title, model, undefined, systemPrompt, subtitle); // systemPrompt here now refers to the resolved one
      currentConversationId = conversation.id;
    }
    
    // Add the user message to the conversation
    await addMessage(currentConversationId, 'user', userMessage);
    
    // Get the conversation history
    const messages = await llmService.getMessageHistory(currentConversationId, summarizeHistory);
    
    // Initialize variables to collect the full response
    let fullContent = '';
    
    try {
      // Stream the response from the LLM service
      for await (const chunk of llmService.streamChat(model, messages)) {
        let content = '';
        
        // Extract content from the chunk (this may vary depending on the provider)
        if (chunk.choices && chunk.choices.length > 0) {
          // OpenAI format
          const delta = chunk.choices[0].delta;
          content = delta.content || '';
        } else if (chunk.delta && chunk.delta.text) {
          // Anthropic format
          content = chunk.delta.text || '';
        }
        
        // Append to the full content
        fullContent += content || '';
        
        // Prepare the SSE event data
        const response: ChatStreamResponse = {
          content: content || '',
          done: false,
        };
        
        // Send the SSE formatted event
        res.write(`data: ${JSON.stringify(response)}\n\n`);
        
        // Flush headers immediately
        // Use type assertion for Node.js Response which has flush method
        const nodeRes = res as unknown as { flush?: () => void };
        if (nodeRes.flush) {
          nodeRes.flush();
        }
      }
      
      // Send a final event indicating completion
      const finalResponse: ChatStreamResponse = {
        content: '',
        done: true,
        conversation_id: currentConversationId
      };
      
      res.write(`data: ${JSON.stringify(finalResponse)}\n\n`);
      
      // Save the assistant's response to the database
      await addMessage(currentConversationId, 'assistant', fullContent, model);
      
      // Get the conversation to check if it's a new conversation
      const conversation = await getConversation(currentConversationId, true);
      
      // Check if this is the first assistant response in the conversation
      // We need to check the messages array directly since message_count might not be accurate
      const assistantMessages = conversation?.messages.filter(msg => msg.role === 'assistant') || [];
      const isFirstAssistantResponse = assistantMessages.length === 1;
      
      console.log('Debug - Conversation ID:', currentConversationId);
      console.log('Debug - Messages count:', conversation?.messages.length);
      console.log('Debug - Assistant messages count:', assistantMessages.length);
      console.log('Debug - Is first assistant response:', isFirstAssistantResponse);
      
      // If this is the first assistant response
      if (isFirstAssistantResponse) {
        // Use the first 50 characters of the assistant's response as the subtitle
        const subtitle = fullContent.length > 50 
          ? `${fullContent.substring(0, 50)}...` 
          : fullContent;
        
        // Update the conversation subtitle
        console.log('Debug - Updating subtitle to:', subtitle);
        const updated = await updateConversationSubtitle(currentConversationId, subtitle);
        console.log('Debug - Subtitle update success:', updated);
      }
      
      // End the response
      res.end();
    } catch (error) {
      console.error('Error streaming chat response:', error);
      
      // Send an error event
      const errorResponse: ChatStreamResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        done: true,
        conversation_id: currentConversationId,
        content: ''
      };
      
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('Error processing chat request:', error);
    
    // If headers haven't been sent yet, send a JSON error response
    if (!res.headersSent) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Invalid request parameters' 
      });
    }
  }
});

export default router;
