import express, { Request, Response } from 'express';
import { z } from 'zod';
import { llmService } from '../services/llm';
import { 
  createConversation, 
  addMessage, 
  getConversation 
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
    
    const { 
      model, 
      message: userMessage, 
      conversation_id, // Use conversation_id directly from request
      system_prompt: systemPrompt,
      summarize_history: summarizeHistory
    } = validatedRequest;
    
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
      
      // Create a new conversation
      const conversation = await createConversation(title, model, undefined, systemPrompt);
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
          done: false
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
