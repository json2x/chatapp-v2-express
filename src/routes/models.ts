import express, { Request, Response } from 'express';
import { llmService } from '../services/llm';

const router = express.Router();

/**
 * Get available LLM models grouped by provider
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
