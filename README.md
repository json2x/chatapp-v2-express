# ChatApp v2 Express

A chat application with multiple LLM providers (OpenAI and Anthropic) using Express.js and TypeScript.

## Features

- TypeScript with strict typing
- Express.js backend
- Prisma ORM for database operations
- Support for multiple LLM providers (OpenAI and Anthropic)
- Streaming chat responses
- Conversation management
- Message history with summarization for long conversations

## Prerequisites

- Node.js (v16+)
- PostgreSQL database (Supabase)
- OpenAI API key
- Anthropic API key

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env` file in the root directory with the following:

```
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
POSTGRES_DATABASE_URL=your_postgres_connection_string
PORT=8000
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run database migrations:

```bash
npm run prisma:migrate
```

## Development

Start the development server:

```bash
npm run dev
```

## Production

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## API Endpoints

### Chat

- `POST /api/chat` - Send a message and get a streaming response

### Conversations

- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:conversationId` - Get a specific conversation with messages
- `DELETE /api/conversations/:conversationId` - Delete a conversation

### Models

- `GET /api/models` - Get available LLM models grouped by provider

## License

ISC
