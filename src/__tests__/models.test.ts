import express from 'express';
import { resetMocks, createRequest } from './setup';
import modelsRouter from '../routes/models';
import { llmService } from '../services/llm';

// Mock the llmService
jest.mock('../services/llm');
const mockLlmService = llmService as jest.Mocked<typeof llmService>;

describe('Models API Endpoints', () => {
  let app: express.Express;

  beforeEach(() => {
    resetMocks();
    app = express();
    app.use(express.json());
    app.use('/api/models', modelsRouter);
  });

  describe('GET /api/models', () => {
    it('should return available models grouped by provider', async () => {
      // Mock the response from the LLM service
      const mockModels = {
        openai: ['gpt-4.1-nano', 'gpt-3.5-turbo'],
        anthropic: ['claude-3-opus', 'claude-3-sonnet']
      };
      
      mockLlmService.getAvailableModels.mockReturnValue(mockModels);

      // Make the request
      const response = await createRequest(app)
        .get('/api/models')
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify the response
      expect(response.body).toEqual(mockModels);
      expect(mockLlmService.getAvailableModels).toHaveBeenCalledTimes(1);
    });

    it('should handle errors and return 500 status', async () => {
      // Mock an error in the LLM service
      mockLlmService.getAvailableModels.mockImplementation(() => {
        throw new Error('Failed to get models');
      });

      // Make the request
      const response = await createRequest(app)
        .get('/api/models')
        .expect('Content-Type', /json/)
        .expect(500);

      // Verify the response
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to get models');
    });
  });
});
