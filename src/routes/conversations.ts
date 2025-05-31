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
 * @swagger
 * /conversations:
 *   get:
 *     summary: Get all conversations for a specific user
 *     tags: [Conversations]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: ID of the user to get conversations for (optional)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of conversations to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of conversations to skip
 *     responses:
 *       200:
 *         description: List of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ConversationSummary'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /conversations/{conversationId}:
 *   get:
 *     summary: Get a conversation by ID, including all its messages
 *     tags: [Conversations]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the conversation to get
 *     responses:
 *       200:
 *         description: The conversation with its messages
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /conversations:
 *   post:
 *     summary: Create a new conversation
 *     tags: [Conversations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the conversation
 *               model:
 *                 type: string
 *                 description: LLM model to use for the conversation
 *               user_id:
 *                 type: string
 *                 description: ID of the user who owns the conversation (optional)
 *               system_prompt:
 *                 type: string
 *                 description: System prompt to use for the conversation (optional)
 *             required:
 *               - title
 *               - model
 *     responses:
 *       201:
 *         description: The created conversation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /conversations/{conversationId}:
 *   delete:
 *     summary: Delete a conversation by ID
 *     tags: [Conversations]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the conversation to delete
 *     responses:
 *       200:
 *         description: Conversation deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteResponse'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
