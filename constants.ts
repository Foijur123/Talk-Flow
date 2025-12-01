import { Contact, User } from './types';

export const CURRENT_USER: User = {
  id: 'user-me',
  name: 'You',
  avatar: 'https://picsum.photos/seed/me/200/200',
  isSelf: true,
};

export const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'gemini-helper',
    name: 'Talk Flow AI',
    avatar: 'https://picsum.photos/seed/gemini/200/200',
    unreadCount: 0,
    lastMessage: 'Hello! How can I help you today?',
    lastMessageTime: new Date(),
    systemInstruction: 'You are a helpful, friendly, and concise AI assistant named Talk Flow AI. You provide clear answers.',
    isAI: true,
  },
  {
    id: 'chef-gordon',
    name: 'Chef Gordon',
    avatar: 'https://picsum.photos/seed/chef/200/200',
    unreadCount: 2,
    lastMessage: 'WHERE IS THE LAMB SAUCE?!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60),
    systemInstruction: 'You are a world-famous, extremely critical, and loud chef. You shout often (use caps) and demand perfection in cooking. You critique everything harshly but are secretly caring.',
    isAI: true,
  },
  {
    id: 'stoic-marcus',
    name: 'Marcus Aurelius',
    avatar: 'https://picsum.photos/seed/stoic/200/200',
    unreadCount: 0,
    lastMessage: 'The obstacle is the way.',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
    systemInstruction: 'You are Marcus Aurelius, Roman Emperor and Stoic philosopher. You speak with wisdom, calmness, and reference stoic principles. You are archaic but understandable.',
    isAI: true,
  },
  {
    id: 'tech-support',
    name: 'Dave (Tech Support)',
    avatar: 'https://picsum.photos/seed/tech/200/200',
    unreadCount: 0,
    lastMessage: 'Have you tried turning it off and on again?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 48),
    systemInstruction: 'You are Dave, a tired IT support specialist. You always ask if they have restarted the device. You use technical jargon sometimes but mostly offer simple, repetitive advice.',
    isAI: true,
  }
];

export const INITIAL_MESSAGES_MAP: Record<string, any[]> = {
  'gemini-helper': [
    {
      id: 'msg-1',
      chatId: 'gemini-helper',
      senderId: 'gemini-helper',
      content: 'Hello! How can I help you today?',
      timestamp: new Date(),
      status: 'read',
      type: 'text',
    }
  ],
  'chef-gordon': [
    {
      id: 'msg-2',
      chatId: 'chef-gordon',
      senderId: 'chef-gordon',
      content: 'THIS RISOTTO IS RAW!',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg-3',
      chatId: 'chef-gordon',
      senderId: 'chef-gordon',
      content: 'WHERE IS THE LAMB SAUCE?!',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      status: 'read',
      type: 'text',
    }
  ],
  'stoic-marcus': [
    {
        id: 'msg-4',
        chatId: 'stoic-marcus',
        senderId: 'stoic-marcus',
        content: 'The obstacle is the way.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        status: 'read',
        type: 'text',
    }
  ],
  'tech-support': [
      {
          id: 'msg-5',
          chatId: 'tech-support',
          senderId: 'tech-support',
          content: 'Have you tried turning it off and on again?',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
          status: 'read',
          type: 'text',
      }
  ]
};