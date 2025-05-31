import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Generate Prisma client
    console.log('Generating Prisma client...');
    await execAsync('npx prisma generate');
    console.log('Prisma client generated successfully.');

    try {
      // First try to connect to the database
      console.log('Testing database connection...');
      await prisma.$connect();
      console.log('Database connection successful.');
    } catch (connectionError) {
      console.error('Database connection failed:', connectionError);
      console.log('This might be due to missing tables. Proceeding with schema push...');
    }

    // Push the schema to the database without migrations
    console.log('Pushing schema to database...');
    await execAsync('npx prisma db push --accept-data-loss --force-reset');
    console.log('Schema pushed to database successfully.');

    // Seed the database
    console.log('Seeding database...');
    try {
      await execAsync('npx prisma db seed');
      console.log('Database seeded successfully.');
    } catch (seedError) {
      console.error('Error seeding database:', seedError);
      console.log('Will attempt manual seeding...');
      
      // Manual seeding as a fallback
      await prisma.conversation.create({
        data: {
          title: 'Sample Conversation',
          userId: 'user123',
          model: 'gpt-4o',
          messages: {
            create: [
              {
                role: 'user',
                content: 'Hello, how are you?'
              },
              {
                role: 'assistant',
                content: 'I\'m doing well, thank you for asking! How can I help you today?'
              }
            ]
          }
        }
      });
      console.log('Manual seeding completed successfully.');
    }

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase().catch(console.error);
