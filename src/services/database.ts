import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ConversationSummary, Conversation, MessageSummary } from '../types';

const prisma = new PrismaClient();

/**
 * Get all conversations for a specific user
 */
export async function getAllConversations(
  userId?: string,
  limit: number = 100,
  skip: number = 0
): Promise<ConversationSummary[]> {
  const conversations = await prisma.conversation.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip,
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  return conversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    subtitle: (conv as any).subtitle || undefined,
    created_at: conv.createdAt.toISOString(),
    updated_at: conv.updatedAt.toISOString(),
    user_id: conv.userId || undefined,
    model: conv.model,
    message_count: conv._count.messages,
    metadata: conv.metadata as Record<string, any> || {},
  }));
}

/**
 * Get a conversation by ID, optionally including its messages
 */
export async function getConversation(
  conversationId: string,
  includeMessages = false
): Promise<Conversation | null> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: includeMessages ? { messages: true } : undefined,
    });

    if (!conversation) return null;

    // Type assertion to handle the conditional include
    const conversationWithMessages = conversation as unknown as {
      id: string;
      title: string;
      subtitle: string | null;
      createdAt: Date;
      updatedAt: Date;
      userId: string | null;
      model: string;
      systemPrompt: string | null;
      metadata: any;
      messages?: Array<{
        id: string;
        conversationId: string;
        role: string;
        content: string;
        createdAt: Date;
        tokens: number | null;
        model?: string | null;
        metadata?: any;
      }>;
    };

    const messageSummaries: MessageSummary[] = includeMessages && conversationWithMessages.messages
      ? conversationWithMessages.messages.map((msg) => ({
          id: msg.id,
          conversation_id: msg.conversationId,
          role: msg.role,
          content: msg.content,
          created_at: msg.createdAt.toISOString(),
          tokens: msg.tokens || undefined,
          model: msg.model || undefined,
          metadata: (msg.metadata as Record<string, any>) || {}
        }))
      : [];

    return {
      id: conversationWithMessages.id,
      title: conversationWithMessages.title,
      subtitle: conversationWithMessages.subtitle || undefined,
      created_at: conversationWithMessages.createdAt.toISOString(),
      updated_at: conversationWithMessages.updatedAt.toISOString(),
      user_id: conversationWithMessages.userId || undefined,
      model: conversationWithMessages.model,
      system_prompt: conversationWithMessages.systemPrompt || undefined,
      messages: messageSummaries,
      message_count: messageSummaries.length,
      metadata: conversationWithMessages.metadata as Record<string, any> || {}
    };
  } catch (error) {
    console.error(`Error getting conversation ${conversationId}:`, error);
    return null;
  }
}

/**
 * Create a new conversation
 */
export async function createConversation(
  title: string,
  model: string,
  userId?: string,
  systemPrompt?: string,
  subtitle?: string
): Promise<Conversation> {
  const conversation = await prisma.conversation.create({
    data: {
      id: uuidv4(),
      title,
      subtitle: subtitle as any,
      model,
      userId,
      systemPrompt,
    },
  });

  return {
    id: conversation.id,
    title: conversation.title,
    subtitle: (conversation as any).subtitle || undefined,
    created_at: conversation.createdAt.toISOString(),
    updated_at: conversation.updatedAt.toISOString(),
    user_id: conversation.userId || undefined,
    model: conversation.model,
    system_prompt: conversation.systemPrompt || undefined,
    message_count: 0,
    metadata: conversation.metadata as Record<string, any> || {},
    messages: [],
  };
}

/**
 * Delete a conversation by ID
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  try {
    await prisma.conversation.delete({
      where: { id: conversationId },
    });
    return true;
  } catch (error) {
    console.error(`Error deleting conversation ${conversationId}:`, error);
    return false;
  }
}

/**
 * Update the subtitle of a conversation
 */
export async function updateConversationSubtitle(
  conversationId: string,
  subtitle: string
): Promise<boolean> {
  try {
    console.log(`Updating subtitle for conversation ${conversationId} to: "${subtitle}"`);
    
    // Verify the conversation exists before updating
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    
    if (!conversation) {
      console.error(`Conversation ${conversationId} not found when trying to update subtitle`);
      return false;
    }
    
    // Update the subtitle
    const result = await prisma.conversation.update({
      where: { id: conversationId },
      data: { subtitle: subtitle as any }, // Use type assertion to avoid TypeScript errors
    });
    
    console.log(`Subtitle updated successfully for conversation ${conversationId}:`, result.id);
    return true;
  } catch (error) {
    console.error(`Error updating subtitle for conversation ${conversationId}:`, error);
    return false;
  }
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  role: string,
  content: string,
  model?: string,
  tokens?: number
): Promise<MessageSummary> {
  const message = await prisma.message.create({
    data: {
      id: uuidv4(),
      conversationId,
      role,
      content,
      model,
      tokens,
    },
  });

  // Update conversation's updated timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date(),
    },
  });

  return {
    id: message.id,
    conversation_id: message.conversationId,
    role: message.role,
    content: message.content,
    created_at: message.createdAt.toISOString(),
    tokens: message.tokens || undefined,
    model: message.model || undefined,
    metadata: message.metadata as Record<string, any> || {},
  };
}

/**
 * Get message history for a conversation
 */
export async function getMessageHistory(
  conversationId: string
): Promise<MessageSummary[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map((msg) => ({
    id: msg.id,
    conversation_id: msg.conversationId,
    role: msg.role,
    content: msg.content,
    created_at: msg.createdAt.toISOString(),
    tokens: msg.tokens || undefined,
    model: msg.model || undefined,
    metadata: msg.metadata as Record<string, any> || {},
  }));
}
