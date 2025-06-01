import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';

// Read version from package.json at runtime
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat Application API',
      version,
      description: 'API documentation for the Chat Application with multiple LLM providers',
      license: {
        name: 'ISC',
      },
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Supabase JWT token'
        },
      },
      schemas: {
        ChatMessage: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              enum: ['user', 'assistant', 'system'],
              description: 'The role of the message sender',
            },
            content: {
              type: 'string',
              description: 'The content of the message',
            },
          },
          required: ['role', 'content'],
        },
        ChatRequest: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'The LLM model to use for the chat',
            },
            message: {
              type: 'string',
              description: 'The message content',
            },
            conversation_id: {
              type: 'string',
              description: 'The ID of the conversation to add the message to (optional)',
            },
            system_prompt: {
              type: 'string',
              description: 'System prompt to use for the conversation (optional)',
            },
            summarize_history: {
              type: 'boolean',
              description: 'Whether to summarize the conversation history (optional)',
              default: false,
            },
          },
          required: ['model', 'message'],
        },
        ChatStreamResponse: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The content chunk of the response',
            },
            done: {
              type: 'boolean',
              description: 'Whether this is the final chunk of the response',
            },
            conversation_id: {
              type: 'string',
              description: 'The ID of the conversation (included in the final chunk)',
            },
            error: {
              type: 'string',
              description: 'Error message if an error occurred',
            },
          },
          required: ['content', 'done'],
        },
        ConversationSummary: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the conversation',
            },
            title: {
              type: 'string',
              description: 'The title of the conversation',
            },
            subtitle: {
              type: 'string',
              description: 'The subtitle of the conversation, derived from the first assistant response (up to 50 characters)',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the conversation was created',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the conversation was last updated',
            },
            user_id: {
              type: 'string',
              description: 'The ID of the user who owns the conversation (optional)',
            },
            model: {
              type: 'string',
              description: 'The LLM model used for the conversation',
            },
            message_count: {
              type: 'integer',
              description: 'The number of messages in the conversation',
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata for the conversation (optional)',
            },
          },
          required: ['id', 'title', 'created_at', 'updated_at', 'model', 'message_count'],
        },
        Conversation: {
          allOf: [
            {
              $ref: '#/components/schemas/ConversationSummary',
            },
            {
              type: 'object',
              properties: {
                system_prompt: {
                  type: 'string',
                  description: 'The system prompt for the conversation (optional)',
                },
                messages: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/MessageSummary',
                  },
                  description: 'The messages in the conversation',
                },
              },
              required: ['messages'],
            },
          ],
        },
        MessageSummary: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the message',
            },
            conversation_id: {
              type: 'string',
              description: 'The ID of the conversation the message belongs to',
            },
            role: {
              type: 'string',
              description: 'The role of the message sender',
            },
            content: {
              type: 'string',
              description: 'The content of the message',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the message was created',
            },
            tokens: {
              type: 'integer',
              description: 'The number of tokens in the message (optional)',
            },
            model: {
              type: 'string',
              description: 'The LLM model used for the message (optional)',
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata for the message (optional)',
            },
          },
          required: ['id', 'conversation_id', 'role', 'content', 'created_at'],
        },
        DeleteResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Success message',
            },
          },
          required: ['message'],
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
          required: ['error'],
        },
        ModelsResponse: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          description: 'Available models grouped by provider',
        },
      },
    },
    security: [
      {
        bearerAuth: []
      }
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const specs = swaggerJsdoc(options);

export default specs;
