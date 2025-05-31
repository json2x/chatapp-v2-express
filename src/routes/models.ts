import express, { Request, Response } from 'express';
import { llmService } from '../services/llm';

const router = express.Router();

/**
 * @swagger
 * /models:
 *   get:
 *     summary: Get available LLM models grouped by provider
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: Available models grouped by provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelsResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const availableModels = llmService.getAvailableModels();
    res.json(availableModels);
  } catch (error) {
    console.error('Error getting available models:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

export default router;
