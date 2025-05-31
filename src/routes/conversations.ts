import express, { Request, Response } from 'express';
import { z } from 'zod';
import { 
  getAllConversations, 
  getConversation, 
  deleteConversation,
  createConversation 
} from '../services/database';

const router = express.Router();

// Validation schema for query parameters
const listConversationsSchema = z.object({
  user_id: z.string().optional(),
  limit: z.string().transform(val => parseInt(val, 10)).default('100'),
  offset: z.string().transform(val => parseInt(val, 10)).default('0'),
});

/**
 * Get all conversations for a specific user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Validate and parse query parameters
    const { user_id, limit, offset } = listConversationsSchema.parse(req.query);
    
    console.log(`list_conversations called with user_id=${user_id}, limit=${limit}, offset=${offset}`);
    
    // Get conversations from database
    const conversations = await getAllConversations(user_id, limit, offset);
    
    console.log(`Got ${conversations.length} conversations`);
    
    res.json(conversations);
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Invalid request parameters' 
    });
  }
});

/**
 * Get a conversation by ID, including all its messages
 */
router.get('/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    
    // Get conversation from database with messages
    const conversation = await getConversation(conversationId, true);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error(`Error getting conversation ${req.params.conversationId}:`, error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

/**
 * Create a new conversation
 */
const createConversationSchema = z.object({
  title: z.string(),
  model: z.string(),
  user_id: z.string().optional(),
  system_prompt: z.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { title, model, user_id, system_prompt } = createConversationSchema.parse(req.body);
    
    // Create conversation in database
    const conversation = await createConversation(title, model, user_id, system_prompt);
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Invalid request parameters' 
    });
  }
});

/**
 * Delete a conversation by ID
 */
router.delete('/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    
    // Check if the conversation exists first
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Delete the conversation
    const success = await deleteConversation(conversationId);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete conversation' });
    }
    
    res.json({ message: `Conversation ${conversationId} deleted successfully` });
  } catch (error) {
    console.error(`Error deleting conversation ${req.params.conversationId}:`, error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

export default router;
