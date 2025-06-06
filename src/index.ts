import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import 'express-async-errors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpecs from './config/swagger';
import path from 'path';

// Import routes
import chatRouter from './routes/chat';
import conversationsRouter from './routes/conversations';
import modelsRouter from './routes/models';

// Import middleware
import { errorHandler } from './middleware/error-handler';
import { authenticateJWT } from './middleware/auth';

// Load environment variables
dotenv.config();

// Initialize Express app
export const app = express();
const port = process.env.PORT || 80; // Changed to 8001 to avoid conflict

// Initialize Prisma client
const prisma = new PrismaClient();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: ['http://localhost:9000', 'https://mrroboto.vercel.app'], // For development - restrict in production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(express.json()); // Parse JSON request bodies
app.use(morgan('dev')); // Request logging

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes with JWT authentication
app.use('/api/chat', authenticateJWT, chatRouter);
app.use('/api/conversations', authenticateJWT, conversationsRouter);
app.use('/api/models', authenticateJWT, modelsRouter);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { 
  explorer: true,
  swaggerOptions: {
    url: '/api-docs.json' // Link to the OpenAPI JSON specification
  }
}));

// Expose OpenAPI specification as JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ChatApp v2 API',
    documentation: {
      swagger_ui: '/api-docs',
      openapi_json: '/api-docs.json'
    }
  });
});

// Login page route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Error handling middleware
app.use(errorHandler);

// Start server function - exported for testing purposes
export const startServer = async () => {
  try {
    // Connect to the database
    await prisma.$connect();
    console.log('Database connected successfully');
    
    // Start the Express server
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Database disconnected');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('Database disconnected');
  process.exit(0);
});

// Start the server only if this file is executed directly (not imported for testing)
if (require.main === module) {
  startServer().catch(console.error);
}
