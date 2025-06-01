import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Create a sample conversation with a mock user ID
  // In a real app, this would be a Supabase user ID
  const mockUserId = 'supabase-user-123';
  
  const conversation = await prisma.conversation.create({
    data: {
      title: 'Sample Conversation',
      userId: mockUserId,
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
    },
    include: {
      messages: true
    }
  });

  console.log('Created sample conversation:', conversation);
  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
