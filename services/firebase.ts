
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  getDocs,
  Timestamp,
  writeBatch,
  deleteDoc,
  where,
  setDoc,
  limit,
  getDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Contact, Message, User, DeviceSession } from '../types';
import { INITIAL_CONTACTS } from '../constants';

const firebaseConfig = {
  apiKey: "AIzaSyATDkVN5YyYZ4e4mPmvoD4DCe3TC4AXQvY",
  authDomain: "talk-934fe.firebaseapp.com",
  databaseURL: "https://talk-934fe-default-rtdb.firebaseio.com",
  projectId: "talk-934fe",
  storageBucket: "talk-934fe.firebasestorage.app",
  messagingSenderId: "328479456312",
  appId: "1:328479456312:web:686b9b8aaa2abe0861bacd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Helpers ---

const convertTimestamp = (data: any) => {
  if (!data) return data;
  return {
    ...data,
    lastMessageTime: data.lastMessageTime instanceof Timestamp ? data.lastMessageTime.toDate() : new Date(),
    timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(),
  };
};

// --- User Management ---

export const syncUserToFirestore = async (user: User) => {
    try {
        const userRef = doc(db, 'users', user.id);
        const userData: any = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            key: user.key,
            lastSeen: serverTimestamp()
        };
        if (user.pin) {
            userData.pin = user.pin;
        }
        await setDoc(userRef, userData, { merge: true });
    } catch (error) {
        console.error("Error syncing user:", error);
    }
};

export const updateUserPin = async (userId: string, newPin: string) => {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { pin: newPin });
    } catch (error) {
        console.error("Error updating PIN:", error);
    }
};

// --- Session/Device Management ---

export const registerDeviceSession = async (userId: string, sessionId: string, deviceName: string) => {
    try {
        const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
        await setDoc(sessionRef, {
            sessionId,
            deviceName,
            lastActive: serverTimestamp()
        });
        
    } catch (error) {
        console.error("Error registering session", error);
    }
};

export const revokeDeviceSession = async (userId: string, sessionId: string) => {
    try {
        const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
        await deleteDoc(sessionRef);
    } catch (error) {
        console.error("Error revoking session", error);
    }
};

export const listenToUserSessions = (userId: string, callback: (sessions: DeviceSession[]) => void) => {
    const sessionsRef = collection(db, 'users', userId, 'sessions');
    return onSnapshot(sessionsRef, (snapshot) => {
        const sessions = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                sessionId: doc.id,
                deviceName: data.deviceName,
                lastActive: data.lastActive instanceof Timestamp ? data.lastActive.toDate() : new Date()
            };
        });
        callback(sessions);
    });
};

export const updateUserPresence = async (userId: string) => {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            lastSeen: serverTimestamp()
        });
    } catch (error) {
        // Silent fail is okay for presence
    }
};

export const listenToUserStatus = (userId: string, callback: (lastSeen: Date | null, isOnline: boolean) => void) => {
    const userRef = doc(db, 'users', userId);
    return onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const lastSeen = data.lastSeen instanceof Timestamp ? data.lastSeen.toDate() : null;
            
            let isOnline = false;
            if (lastSeen) {
                const now = new Date();
                const diff = (now.getTime() - lastSeen.getTime()) / 1000; // seconds
                isOnline = diff < 120;
            }
            callback(lastSeen, isOnline);
        } else {
            callback(null, false);
        }
    });
};

export const findUserByKey = async (key: string): Promise<User | null> => {
    try {
        const q = query(collection(db, 'users'), where('key', '==', key), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return {
                id: data.id,
                name: data.name,
                avatar: data.avatar,
                key: data.key,
                isSelf: false,
            };
        }
        return null;
    } catch (error) {
        console.error("Error finding user:", error);
        return null;
    }
};

export const loginWithKeyAndPin = async (key: string, pin: string): Promise<User | null> => {
    try {
        const q = query(collection(db, 'users'), where('key', '==', key), limit(1));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            if (data.pin === pin) {
                return {
                    id: data.id,
                    name: data.name,
                    avatar: data.avatar,
                    key: data.key,
                    pin: data.pin,
                    isSelf: true
                };
            }
        }
        return null;
    } catch (error) {
        console.error("Error logging in:", error);
        return null;
    }
};

// --- Seeding ---
export const seedInitialData = async () => {
  try {
    const contactsRef = collection(db, 'contacts');
    const q = query(contactsRef, where('ownerId', '==', 'GLOBAL'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('Seeding initial contacts to Firestore...');
      const batch = writeBatch(db);
      
      INITIAL_CONTACTS.forEach(contact => {
        const ref = doc(db, 'contacts', contact.id); 
        batch.set(ref, {
          ...contact,
          ownerId: 'GLOBAL', 
          lastMessageTime: serverTimestamp()
        });
      });
      
      await batch.commit();
    }
  } catch (error) {
    console.error("Error seeding data:", error);
  }
};

// --- Listeners ---

export const listenToContacts = (currentUserId: string, callback: (contacts: Contact[]) => void) => {
  const q = query(
      collection(db, 'contacts'), 
      where('ownerId', 'in', ['GLOBAL', currentUserId])
  );
  
  return onSnapshot(q, (snapshot) => {
    const contacts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as unknown as Contact[];
    
    const processedContacts = contacts.map(c => convertTimestamp(c));
    processedContacts.sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
    });
    
    callback(processedContacts);
  });
};

export const listenToMessages = (contact: Contact, callback: (messages: Message[]) => void) => {
  let q;
  if (contact.isAI) {
      q = query(
        collection(db, 'contacts', contact.id, 'messages'), 
        orderBy('timestamp', 'asc')
      );
  } else if (contact.chatRoomId) {
      q = query(
          collection(db, 'chats', contact.chatRoomId, 'messages'),
          orderBy('timestamp', 'asc')
      );
  } else {
      return () => {};
  }
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as unknown as Message[];
    
    const processedMessages = messages.map(m => convertTimestamp(m));
    callback(processedMessages);
  });
};

export const getLatestOfferMessage = async (contact: Contact) => {
    try {
        let q;
        if (contact.chatRoomId) {
            q = query(
                collection(db, 'chats', contact.chatRoomId, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(30)
            );
        } else {
            return null;
        }
        
        const snapshot = await getDocs(q);
        
        const offerDoc = snapshot.docs.find(doc => doc.data().type === 'webrtc-offer');
        
        if (offerDoc) {
            const data = offerDoc.data();
            return { id: offerDoc.id, ...data } as Message;
        }
        return null;
    } catch (e) {
        console.error("Error fetching offer", e);
        return null;
    }
};

// --- Actions ---

export const sendMessageToFirestore = async (contact: Contact, message: Omit<Message, 'id'>) => {
  try {
    // 1. Send the actual message
    if (contact.isAI) {
        await addDoc(collection(db, 'contacts', contact.id, 'messages'), {
            ...message,
            timestamp: serverTimestamp()
        });
        
        // Snippet update for AI
        if (!message.type.startsWith('webrtc')) {
            let snippet = getSnippet(message);
            await updateDoc(doc(db, 'contacts', contact.id), {
                lastMessage: snippet,
                lastMessageTime: serverTimestamp(),
                unreadCount: message.senderId !== 'user-me' ? 1 : 0,
                isTyping: false
            });
        }
    } 
    else if (contact.chatRoomId) {
        // Real Chat
        await addDoc(collection(db, 'chats', contact.chatRoomId, 'messages'), {
            ...message,
            chatId: contact.chatRoomId, 
            timestamp: serverTimestamp()
        });

        // If it's a signaling message, don't update the contact list snippet
        if (message.type.startsWith('webrtc')) return;

        // 2. Update Contact List Snippets for ALL participants
        const q = query(collection(db, 'contacts'), where('chatRoomId', '==', contact.chatRoomId));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        const snippet = getSnippet(message);
        
        snapshot.docs.forEach(docSnap => {
             const docData = docSnap.data();
             
             // --- BLOCK LOGIC START ---
             // If the owner of this contact document has blocked the connection (isBlocked is true),
             // then we DO NOT update their snippet or unread count. 
             // This effectively silences the sender from the blocker's perspective.
             if (docData.isBlocked) {
                 return; 
             }
             // --- BLOCK LOGIC END ---

             const isSender = docData.ownerId === message.senderId;
             const newUnread = isSender ? 0 : (docData.unreadCount || 0) + 1;

             batch.update(docSnap.ref, {
                 lastMessage: snippet,
                 lastMessageTime: serverTimestamp(),
                 unreadCount: newUnread, 
                 isTyping: false
             });
        });
        await batch.commit();
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

// Helper for snippets
const getSnippet = (message: Omit<Message, 'id'>) => {
    let snippet = message.type === 'text' ? message.content.substring(0, 50) : `📷 ${message.type}`;
    if (message.type === 'audio') snippet = '🎤 Audio message';
    if (message.type === 'video-call') snippet = '🎥 Video Call';
    if (message.type === 'voice-call') snippet = '📞 Voice Call';
    if (message.content === 'Call Accepted') snippet = '📞 Call Connected';
    if (message.content === 'Call Ended') snippet = '📞 Call Ended';
    return snippet;
};

export const updateMessage = async (chatId: string, messageId: string, data: Partial<Message>) => {
  try {
    if (chatId.includes('_') || chatId.startsWith('ff-') || chatId.startsWith('group_')) {
         const ref = doc(db, 'chats', chatId, 'messages', messageId);
         await updateDoc(ref, data);
    } else {
         const ref = doc(db, 'contacts', chatId, 'messages', messageId);
         await updateDoc(ref, data);
    }
  } catch (error) {
    console.error("Error updating message:", error);
  }
};

export const deleteMessage = async (chatId: string, messageId: string) => {
  try {
    if (chatId.includes('_') || chatId.startsWith('ff-') || chatId.startsWith('group_')) {
        const ref = doc(db, 'chats', chatId, 'messages', messageId);
        await deleteDoc(ref);
    } else {
        const ref = doc(db, 'contacts', chatId, 'messages', messageId);
        await deleteDoc(ref);
    }
  } catch (error) {
    console.error("Error deleting message:", error);
  }
};

export const deleteContact = async (contactId: string) => {
    try {
        const ref = doc(db, 'contacts', contactId);
        await deleteDoc(ref);
    } catch (error) {
        console.error("Error deleting contact:", error);
        throw error;
    }
};

export const toggleBlockContact = async (contactId: string, isBlocked: boolean) => {
    try {
        if (!contactId) return;
        const ref = doc(db, 'contacts', contactId);
        await updateDoc(ref, { isBlocked });
    } catch (error) {
        console.error("Error blocking contact:", error);
        throw new Error("Failed to update block status");
    }
};

export const setTypingStatus = async (contactId: string, isTyping: boolean) => {
  try {
     const ref = doc(db, 'contacts', contactId);
     await updateDoc(ref, { isTyping });
  } catch (error) {
    console.error("Error setting typing status:", error);
  }
};

export const sendUserTypingStatus = async (chatRoomId: string, currentUserId: string, isTyping: boolean) => {
    if (!chatRoomId || !currentUserId) return;
    try {
        const q = query(collection(db, 'contacts'), where('chatRoomId', '==', chatRoomId));
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let count = 0;
        
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            // Update the contact entry for the OTHER person (where ownerId != sender)
            if (data.ownerId !== currentUserId) {
                // If the other user has blocked me, or I have blocked them, do not show typing.
                if (data.isBlocked) return; 

                batch.update(docSnap.ref, { isTyping: isTyping });
                count++;
            }
        });
        
        if (count > 0) {
            await batch.commit();
        }
    } catch (error) {
        console.error("Error sending typing status:", error);
    }
};

export const markMessagesAsRead = async (contact: Contact) => {
    if (contact.isAI || !contact.chatRoomId) return;
    
    try {
        // Query unread messages in this chat sent by the OTHER person
        const messagesRef = collection(db, 'chats', contact.chatRoomId, 'messages');
        // We look for messages NOT from me, that are 'sent' or 'delivered'
        // Simplification: We just mark the latest 20 messages as read to be fast
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let updates = 0;
        
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.senderId !== contact.ownerId && data.status !== 'read') { // 'ownerId' here is actually current user ID in contact obj
                // Wait, 'contact.ownerId' is ME.
                // I want to mark messages sent by 'contact.targetUserId' (THEY) as read.
                if (data.senderId === contact.targetUserId) {
                    batch.update(doc.ref, { status: 'read' });
                    updates++;
                }
            }
        });
        
        if (updates > 0) {
            await batch.commit();
        }
    } catch (e) {
        console.error("Error marking read", e);
    }
};

export const resetUnreadCount = async (contactId: string) => {
    try {
        const ref = doc(db, 'contacts', contactId);
        await updateDoc(ref, { unreadCount: 0 });
    } catch (e) {
        console.error("Error resetting count", e);
    }
};

export const clearChatMessages = async (contactId: string) => {
    try {
        const contactRef = doc(db, 'contacts', contactId);
        const contactSnap = await getDoc(contactRef);
        
        if (!contactSnap.exists()) return;
        
        const contactData = contactSnap.data() as Contact;
        let messagesRef;

        if (contactData.isAI) {
             messagesRef = collection(db, 'contacts', contactId, 'messages');
        } else if (contactData.chatRoomId) {
             messagesRef = collection(db, 'chats', contactData.chatRoomId, 'messages');
        } else {
            return;
        }

        const snapshot = await getDocs(messagesRef);
        
        // Batch delete in chunks of 500 (Firestore limit)
        const CHUNK_SIZE = 400; // Safe limit
        const chunks = [];
        
        for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
            chunks.push(snapshot.docs.slice(i, i + CHUNK_SIZE));
        }

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }
        
        await updateDoc(contactRef, { lastMessage: '', unreadCount: 0 });
    } catch (e) {
        console.error("Error clearing chat messages:", e);
        throw e; // Propagate error to caller
    }
};

export const addNewContact = async (name: string, instruction: string, isAI: boolean, currentUserId: string) => {
    if (!isAI) return;

    try {
        await addDoc(collection(db, 'contacts'), {
            ownerId: currentUserId,
            name: name,
            avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
            unreadCount: 0,
            lastMessage: 'Tap to start chatting',
            lastMessageTime: serverTimestamp(),
            systemInstruction: instruction,
            isAI: true,
            isTyping: false,
            isBlocked: false
        });
    } catch (error) {
        console.error("Error adding AI contact:", error);
    }
};

export const addRealContact = async (currentUserId: string, targetUserKey: string) => {
    const targetUser = await findUserByKey(targetUserKey);
    if (!targetUser) {
        throw new Error("User not found with this key.");
    }
    
    if (targetUser.id === currentUserId) {
        throw new Error("You cannot add yourself.");
    }

    const sortedIds = [currentUserId, targetUser.id].sort();
    const chatRoomId = `${sortedIds[0]}_${sortedIds[1]}`;

    // Check if contact already exists
    const existingQ = query(
        collection(db, 'contacts'), 
        where('ownerId', '==', currentUserId),
        where('targetUserId', '==', targetUser.id)
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
        return existingSnap.docs[0].data().chatRoomId;
    }

    await addDoc(collection(db, 'contacts'), {
        ownerId: currentUserId,
        name: targetUser.name, 
        avatar: targetUser.avatar,
        unreadCount: 0,
        lastMessage: 'New connection established',
        lastMessageTime: serverTimestamp(),
        isAI: false,
        chatRoomId: chatRoomId,
        targetUserId: targetUser.id,
        isBlocked: false
    });

    const myUserDoc = await getDoc(doc(db, 'users', currentUserId));
    const myUserData = myUserDoc.data();
    
    // Also create the contact for the OTHER user if it doesn't exist
    const otherQ = query(
        collection(db, 'contacts'), 
        where('ownerId', '==', targetUser.id),
        where('targetUserId', '==', currentUserId)
    );
    const otherSnap = await getDocs(otherQ);
    
    if (otherSnap.empty) {
        await addDoc(collection(db, 'contacts'), {
            ownerId: targetUser.id,
            name: myUserData?.name || "New Contact",
            avatar: myUserData?.avatar || "https://picsum.photos/seed/unknown/200/200",
            unreadCount: 1,
            lastMessage: 'New connection established',
            lastMessageTime: serverTimestamp(),
            isAI: false,
            chatRoomId: chatRoomId,
            targetUserId: currentUserId,
            isBlocked: false
        });
    }

    return chatRoomId;
};

export const createGroup = async (groupName: string, memberIds: string[], currentUserId: string) => {
    const chatRoomId = `group_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const allMemberIds = [currentUserId, ...memberIds];
    const batch = writeBatch(db);
    const groupAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=00a884&color=fff`;

    for (const userId of allMemberIds) {
        const ref = doc(collection(db, 'contacts')); 
        batch.set(ref, {
            ownerId: userId,
            name: groupName,
            avatar: groupAvatar,
            unreadCount: 0,
            lastMessage: 'Group created',
            lastMessageTime: serverTimestamp(),
            isAI: false,
            isGroup: true,
            chatRoomId: chatRoomId,
            members: allMemberIds,
            isBlocked: false
        });
    }

    await batch.commit();
    return chatRoomId;
};
