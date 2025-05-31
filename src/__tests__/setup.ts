import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import request from 'supertest';

// Mock the Prisma client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    conversation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock the LLM service
jest.mock('../services/llm', () => {
  return {
    llmService: {
      getAvailableModels: jest.fn(),
      getMessageHistory: jest.fn(),
      streamChat: jest.fn(),
    },
  };
});

// Helper function to create a supertest request
export const createRequest = (app: Express) => {
  return request(app);
};

// Get the mocked Prisma client
export const getMockPrismaClient = (): jest.Mocked<PrismaClient> => {
  return new PrismaClient() as unknown as jest.Mocked<PrismaClient>;
};

// Helper to reset all mocks between tests
export const resetMocks = () => {
  jest.clearAllMocks();
};
