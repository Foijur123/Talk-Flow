
export interface User {
  id: string;
  name: string;
  avatar: string;
  isSelf: boolean;
  key?: string; // The shareable key (e.g., ff-12345)
  pin?: string; // Security PIN for account switching/login
}

export interface DeviceSession {
  sessionId: string;
  deviceName: string;
  lastActive: Date;
  isCurrent?: boolean; // Helper for UI
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'video-call' | 'voice-call' | 'audio' | 'webrtc-offer' | 'webrtc-answer' | 'webrtc-ice';
  reaction?: string;
}

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  isTyping?: boolean;
  systemInstruction?: string; // Specific persona instruction
  isAI?: boolean; // True for AI, False for Real Person
  isGroup?: boolean; // True for Group Chats
  isBlocked?: boolean; // True for Blocked contacts
  chatRoomId?: string; // ID of the shared chat room (for real people)
  ownerId?: string; // ID of the user who owns this contact entry
  targetUserId?: string; // ID of the other user in a 1:1 chat
  members?: string[]; // IDs of all members in a group
}

export interface ChatSession {
  contactId: string;
  messages: Message[];
}

export interface CallState {
  isActive: boolean;
  status: 'outgoing' | 'incoming' | 'connected' | 'ended';
  type: 'video' | 'audio';
  contact: Contact | null;
  startTime?: number; // timestamp when connected
}