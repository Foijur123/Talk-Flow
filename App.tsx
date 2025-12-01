
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import CallOverlay from './components/CallOverlay';
import { Contact, Message, User, CallState } from './types';
import { streamChatResponse } from './services/geminiService';
import { 
    seedInitialData, 
    listenToContacts, 
    listenToMessages, 
    sendMessageToFirestore, 
    setTypingStatus, 
    clearChatMessages,
    syncUserToFirestore,
    deleteContact,
    updateUserPresence,
    registerDeviceSession,
    listenToUserSessions,
    getLatestOfferMessage,
    sendUserTypingStatus
} from './services/firebase';
import { getOrCreateUserIdentity } from './services/userService';
import { v4 as uuidv4 } from 'uuid';

// STUN servers for WebRTC to traverse NATs
const rtcConfig = {
    iceServers: [
        { urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302',
        ]},
    ],
    iceCandidatePoolSize: 10,
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // CALL STATE
  const [currentCall, setCurrentCall] = useState<CallState>({
      isActive: false,
      status: 'ended',
      type: 'audio',
      contact: null
  });

  // WebRTC State
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);

  // Audio Refs
  const incomingAudioRef = useRef<HTMLAudioElement | null>(null);
  const outgoingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Track last processed call timestamp to prevent loops
  const lastProcessedMessageTimeRef = useRef<number>(0);

  // Typing Timeout Ref
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initialize User & Contacts & Sessions
  useEffect(() => {
    // A. Get Identity
    const user = getOrCreateUserIdentity();
    setCurrentUser(user);
    
    // B. Sync to Global Directory
    syncUserToFirestore(user);

    // C. Register Device Session (for "Linked Devices")
    let installId = localStorage.getItem('talkflow_install_id');
    if (!installId) {
        installId = uuidv4();
        localStorage.setItem('talkflow_install_id', installId);
    }
    const deviceName = `${navigator.platform} - ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`;
    registerDeviceSession(user.id, installId, deviceName);

    // D. Seed Initial Data (AI Bots) if global
    seedInitialData();

    // E. Listen to contacts relevant to ME
    const unsubscribeContacts = listenToContacts(user.id, (fetchedContacts) => {
      setContacts(fetchedContacts);
    });
    
    // F. Listen to SESSIONS (Security: Remote Logout)
    const unsubscribeSessions = listenToUserSessions(user.id, (sessions) => {
        // If my current install ID is NOT in the list of valid sessions on the server,
        // it means I have been logged out remotely.
        const mySession = sessions.find(s => s.sessionId === installId);
        if (sessions.length > 0 && !mySession) {
             alert("You have been logged out from another device.");
             localStorage.clear();
             window.location.reload();
        }
    });

    // G. Presence Heartbeat
    const heartbeatInterval = setInterval(() => {
        updateUserPresence(user.id);
    }, 60000); // Every 60 seconds
    updateUserPresence(user.id); // Immediate update

    // Setup Audio assets
    incomingAudioRef.current = new Audio('https://cdn.pixabay.com/download/audio/2021/08/09/audio_27bd67d6d5.mp3'); // Phone Ringtone
    incomingAudioRef.current.loop = true;
    
    outgoingAudioRef.current = new Audio('https://cdn.pixabay.com/download/audio/2022/03/24/audio_c8c8a73467.mp3'); // Dialing
    outgoingAudioRef.current.loop = true;

    return () => {
        unsubscribeContacts();
        unsubscribeSessions();
        clearInterval(heartbeatInterval);
        if(incomingAudioRef.current) {
            incomingAudioRef.current.pause();
            incomingAudioRef.current = null;
        }
        if(outgoingAudioRef.current) {
            outgoingAudioRef.current.pause();
            outgoingAudioRef.current = null;
        }
    };
  }, []);

  // 2. WebRTC Setup Helper
  // IMPORTANT: Pass contact and callType explicitly to avoid stale state in closures
  const setupWebrtc = async (targetContact: Contact, isVideoCall: boolean) => {
      if (pc.current) {
          pc.current.close();
      }

      console.log("Setting up WebRTC for contact:", targetContact.name);

      const newPc = new RTCPeerConnection(rtcConfig);
      pc.current = newPc;

      // Handle Remote Stream - IMPROVED LOGIC
      newPc.ontrack = (event) => {
          console.log("Received Remote Track:", event.track.kind, event.streams);
          
          if (event.streams && event.streams[0]) {
              // Best practice: Use the stream provided by the remote peer
              setRemoteStream(event.streams[0]);
          } else {
              // Fallback: Create stream if not provided (older browsers)
              setRemoteStream((prev) => {
                  if (!prev) return new MediaStream([event.track]);
                  // Avoid duplicate
                  if (prev.getTracks().find(t => t.id === event.track.id)) return prev;
                  return new MediaStream([...prev.getTracks(), event.track]);
              });
          }
      };

      // Handle Local Stream
      try {
          console.log("Getting Local Stream...");
          const stream = await navigator.mediaDevices.getUserMedia({ 
              video: isVideoCall, 
              audio: true 
          });
          localStreamRef.current = stream;
          
          stream.getTracks().forEach((track) => {
              console.log("Adding Local Track:", track.kind);
              newPc.addTrack(track, stream);
          });
      } catch (e) {
          console.error("Error accessing media devices:", e);
          alert("Could not access Camera/Microphone. Please check permissions.");
      }

      // Handle ICE Candidates (Network info)
      newPc.onicecandidate = async (event) => {
          if (event.candidate && currentUser) {
               console.log("Sending ICE Candidate");
               // Send candidate to Firestore
               await sendMessageToFirestore(targetContact, {
                  chatId: targetContact.chatRoomId || targetContact.id,
                  senderId: currentUser.id,
                  content: JSON.stringify(event.candidate.toJSON()),
                  timestamp: new Date(),
                  status: 'sent',
                  type: 'webrtc-ice'
               });
          }
      };

      // Connection State Monitoring
      newPc.onconnectionstatechange = () => {
          console.log("WebRTC Connection State:", newPc.connectionState);
      };

      return newPc;
  };

  // 3. Incoming Call & Signal Detection Logic
  useEffect(() => {
      if (contacts.length === 0) return;

      const now = Date.now();

      // CASE A: INCOMING CALL DETECTION
      // Only look for new calls if we are NOT active
      if (!currentCall.isActive) {
          const callerContact = contacts.find(c => {
              const msg = c.lastMessage?.toLowerCase() || '';
              const isCallMsg = msg.includes('video call') || msg.includes('voice call'); 
              const isUnread = c.unreadCount > 0;
              
              const msgTime = c.lastMessageTime ? new Date(c.lastMessageTime).getTime() : 0;
              
              // Increase window to 45 seconds
              const isRecent = (now - msgTime) < 45000;
              const isNew = msgTime > lastProcessedMessageTimeRef.current;
              
              return isCallMsg && isUnread && isRecent && isNew;
          });

          if (callerContact) {
              const msgTime = callerContact.lastMessageTime ? new Date(callerContact.lastMessageTime).getTime() : now;
              lastProcessedMessageTimeRef.current = msgTime;

              const isVideo = callerContact.lastMessage?.toLowerCase().includes('video');
              
              setCurrentCall({
                  isActive: true,
                  status: 'incoming',
                  type: isVideo ? 'video' : 'audio',
                  contact: callerContact,
                  startTime: now
              });

              // Play Ringtone
              if (incomingAudioRef.current) {
                  incomingAudioRef.current.currentTime = 0;
                  incomingAudioRef.current.play().catch(e => console.log("Auto-play blocked", e));
              }
          }
      } 
  }, [contacts, currentCall.isActive]);

  // 4. Active Call Signaling Listener (WebRTC Handshake)
  useEffect(() => {
      // We only listen for signals if we are in a call
      if (!currentCall.isActive || !currentCall.contact) return;

      const contact = currentCall.contact;
      
      const unsubscribe = listenToMessages(contact, async (fetchedMessages) => {
          // Only process messages that are NEWER than call start time (or slightly before for ICE)
          // We allow some buffer for offer/ice that arrived just as we opened
          const validMessages = fetchedMessages.filter(m => {
             const time = m.timestamp ? new Date(m.timestamp).getTime() : 0;
             return time > (currentCall.startTime! - 15000); // 15s buffer
          });

          // Sort by time to process in order
          validMessages.sort((a, b) => (a.timestamp.getTime() - b.timestamp.getTime()));

          for (const msg of validMessages) {
              // Ignore my own messages
              if (msg.senderId === currentUser?.id) continue;

              // Handle Call Ended
              if (msg.type === 'text' && msg.content.toLowerCase().includes('call ended')) {
                   terminateCall();
                   return; 
              }

              // Handle Call Accepted (Caller Side)
              if (currentCall.status === 'outgoing' && msg.type === 'text' && msg.content.toLowerCase().includes('call accepted')) {
                    if (outgoingAudioRef.current) {
                        outgoingAudioRef.current.pause();
                        outgoingAudioRef.current.currentTime = 0;
                    }
                    setCurrentCall(prev => ({ ...prev, status: 'connected' }));
              }

              // Handle WebRTC Answer (Caller Side)
              if (msg.type === 'webrtc-answer' && pc.current) {
                  console.log("Received Answer");
                  const answer = JSON.parse(msg.content);
                  if (!pc.current.currentRemoteDescription) {
                      await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
                  }
              }

              // Handle ICE Candidates
              if (msg.type === 'webrtc-ice' && pc.current) {
                  console.log("Received ICE Candidate");
                  const candidate = JSON.parse(msg.content);
                  try {
                      if (pc.current.remoteDescription) {
                        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                      } else {
                        // Buffer if remote description not set yet
                        console.log("Buffering ICE Candidate");
                        pendingCandidates.current.push(new RTCIceCandidate(candidate));
                      }
                  } catch (e) {
                      console.error("Error adding ice candidate", e);
                  }
              }
          }
      });

      return () => unsubscribe();
  }, [currentCall.isActive, currentCall.contact, currentUser, currentCall.status, currentCall.startTime]);


  // 3. Listen to Messages when Chat Changes (Standard Chat)
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    
    const activeContact = contacts.find(c => c.id === activeChatId);
    if (!activeContact) return;

    const unsubscribe = listenToMessages(activeContact, (fetchedMessages) => {
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [activeChatId, contacts]);

  // Responsive handling
  const handleSelectContact = (id: string) => {
    setActiveChatId(id);
    setIsSidebarVisible(false);
  };

  const handleBackToSidebar = () => {
    setIsSidebarVisible(true);
    setActiveChatId(null);
  };

  const activeContact = contacts.find(c => c.id === activeChatId);

  // Reusable function to trigger AI response
  const triggerAIResponse = async (contact: Contact, userMessageText: string, contextMessages: Message[]) => {
      if (!contact.isAI) return; 

      await setTypingStatus(contact.id, true);
      const contactInstruction = contact.systemInstruction;
      
      const requestHistory = [...contextMessages, {
          id: 'temp', 
          chatId: contact.id, 
          senderId: 'user-me', 
          content: userMessageText, 
          timestamp: new Date(), 
          status: 'sent', 
          type: 'text' 
      } as Message];

      let fullResponse = "";
      
      await streamChatResponse({
        history: requestHistory,
        newMessage: userMessageText,
        systemInstruction: contactInstruction
      }, (chunkText) => {
        fullResponse = chunkText;
      });

      if (fullResponse) {
          await sendMessageToFirestore(contact, {
              chatId: contact.id,
              senderId: contact.id, // AI sends as itself
              content: fullResponse,
              timestamp: new Date(),
              status: 'read',
              type: 'text'
          });
      }
      await setTypingStatus(contact.id, false);
  };

  // --- TYPING HANDLER ---
  const handleTyping = useCallback((isTyping: boolean) => {
      if (!activeContact || activeContact.isAI || !currentUser) return;
      
      const chatRoomId = activeContact.chatRoomId || activeContact.id;

      if (isTyping) {
          // Clear existing timeout so we don't send "stop" while user is still typing
          if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
          } else {
              // If no timeout exists, we were idle. Send "start typing" immediately.
              sendUserTypingStatus(chatRoomId, currentUser.id, true);
          }

          // Set a new timeout to stop typing after 3 seconds of inactivity
          typingTimeoutRef.current = setTimeout(() => {
              sendUserTypingStatus(chatRoomId, currentUser.id, false);
              typingTimeoutRef.current = null;
          }, 3000);
      }
  }, [activeContact, currentUser]);

  // Cleanup typing timeout when chat changes or unmounts
  useEffect(() => {
    return () => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
            // Best effort to clear status if we navigate away while typing
            if (activeContact && currentUser && !activeContact.isAI) {
                 sendUserTypingStatus(activeContact.chatRoomId || activeContact.id, currentUser.id, false);
            }
        }
    };
  }, [activeChatId, activeContact, currentUser]);

  const handleSendMessage = useCallback(async (content: string, type: 'text' | 'image' | 'audio') => {
    if (!activeContact || !currentUser) return;

    const senderId = activeContact.isAI ? 'user-me' : currentUser.id;

    // Clear typing status immediately upon sending
    if (!activeContact.isAI && typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        sendUserTypingStatus(activeContact.chatRoomId || activeContact.id, currentUser.id, false);
    }

    await sendMessageToFirestore(activeContact, {
      chatId: activeContact.chatRoomId || activeContact.id,
      senderId: senderId,
      content: content,
      timestamp: new Date(),
      status: 'sent',
      type: type
    });

    // 2. Trigger AI (Only if it's an AI contact and message is text, AIs don't process images yet in this flow)
    if (activeContact.isAI) {
        if (type === 'text') {
            await triggerAIResponse(activeContact, content, messages);
        } else {
             // Simple AI response to media
             await setTypingStatus(activeContact.id, true);
             setTimeout(async () => {
                 const reply = type === 'image' ? "That looks interesting!" : "I can't listen to audio yet, sorry!";
                 await sendMessageToFirestore(activeContact, {
                    chatId: activeContact.id,
                    senderId: activeContact.id,
                    content: reply,
                    timestamp: new Date(),
                    status: 'read',
                    type: 'text'
                 });
                 await setTypingStatus(activeContact.id, false);
             }, 1000);
        }
    }

  }, [activeContact, currentUser, messages]);

  // --- CALL HANDLERS ---

  const handleStartCall = useCallback(async (type: 'video-call' | 'voice-call') => {
      if (!activeContact || !currentUser) return;

      const isVideo = type === 'video-call';

      // 1. Set Local UI State to Outgoing
      setCurrentCall({
          isActive: true,
          status: 'outgoing',
          type: isVideo ? 'video' : 'audio',
          contact: activeContact,
          startTime: Date.now()
      });

      // 2. Play Dialing Sound
      if (outgoingAudioRef.current) {
          outgoingAudioRef.current.currentTime = 0;
          outgoingAudioRef.current.play().catch(() => {});
      }

      // 3. Send Signal to Firestore
      const content = isVideo ? 'Video call started' : 'Voice call started';
      const senderId = activeContact.isAI ? 'user-me' : currentUser.id;

      await sendMessageToFirestore(activeContact, {
          chatId: activeContact.chatRoomId || activeContact.id,
          senderId: senderId,
          content: content,
          timestamp: new Date(),
          status: 'sent',
          type: type
      });

      // 4. Setup WebRTC (Generate Offer)
      // We start gathering candidates immediately using the EXPLICIT contact arg
      const newPc = await setupWebrtc(activeContact, isVideo);
      const offer = await newPc.createOffer();
      await newPc.setLocalDescription(offer);

      console.log("Sending Offer");
      // Send Offer
      await sendMessageToFirestore(activeContact, {
          chatId: activeContact.chatRoomId || activeContact.id,
          senderId: senderId,
          content: JSON.stringify(offer),
          timestamp: new Date(),
          status: 'sent',
          type: 'webrtc-offer'
      });

      // 5. AI Rejection Logic
      if (activeContact.isAI) {
        setTimeout(() => {
            endCall(true); 
            triggerAIResponse(activeContact, "I can't answer calls right now, I am an AI.", messages);
        }, 3000);
      } 

  }, [activeContact, currentUser, messages]);

  const answerCall = async () => {
      if (!currentCall.contact) return;

      // 1. Stop Ringtone
      if (incomingAudioRef.current) {
          incomingAudioRef.current.pause();
          incomingAudioRef.current.currentTime = 0;
      }
      
      // 2. Update Status
      setCurrentCall(prev => ({ ...prev, status: 'connected' }));

      // 3. Setup WebRTC & FORCE PROCESS OFFER
      const isVideo = currentCall.type === 'video';
      const newPc = await setupWebrtc(currentCall.contact, isVideo);
      
      // Look for the latest offer in Firestore explicitly to avoid race conditions
      const offerMsg = await getLatestOfferMessage(currentCall.contact);
      
      if (offerMsg && offerMsg.type === 'webrtc-offer') {
          console.log("Found Offer, Processing...");
          const offer = JSON.parse(offerMsg.content);
          await newPc.setRemoteDescription(new RTCSessionDescription(offer));
          
          // Process buffered candidates
          console.log(`Processing ${pendingCandidates.current.length} buffered candidates`);
          while (pendingCandidates.current.length > 0) {
              const candidate = pendingCandidates.current.shift();
              if (candidate) await newPc.addIceCandidate(candidate);
          }

          const answer = await newPc.createAnswer();
          await newPc.setLocalDescription(answer);

          console.log("Sending Answer");
          // Send Answer
          await sendMessageToFirestore(currentCall.contact, {
              chatId: currentCall.contact.chatRoomId || currentCall.contact.id,
              senderId: currentUser!.id,
              content: JSON.stringify(answer),
              timestamp: new Date(),
              status: 'sent',
              type: 'webrtc-answer'
          });
      } else {
          console.error("No offer found!");
      }

      // 4. Send "Call Accepted" Signal
      if (currentUser) {
          await sendMessageToFirestore(currentCall.contact, {
              chatId: currentCall.contact.chatRoomId || currentCall.contact.id,
              senderId: currentUser.id,
              content: 'Call Accepted',
              timestamp: new Date(),
              status: 'sent',
              type: 'text'
          });
      }
  };

  const terminateCall = () => {
      // Close WebRTC
      if (pc.current) {
          pc.current.close();
          pc.current = null;
      }
      // Stop Tracks
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
      }
      setRemoteStream(null);
      pendingCandidates.current = [];

       // Reset Audio
      if (incomingAudioRef.current) {
          incomingAudioRef.current.pause();
          incomingAudioRef.current.currentTime = 0;
      }
      if (outgoingAudioRef.current) {
          outgoingAudioRef.current.pause();
          outgoingAudioRef.current.currentTime = 0;
      }
      setCurrentCall(prev => ({ ...prev, isActive: false, status: 'ended' }));
  };

  const endCall = async (notifyOtherParty = true) => {
      // 1. Send Signal (only if I initiated the end)
      if (notifyOtherParty && currentCall.isActive && currentCall.contact && currentUser) {
           await sendMessageToFirestore(currentCall.contact, {
              chatId: currentCall.contact.chatRoomId || currentCall.contact.id,
              senderId: currentUser.id,
              content: 'Call Ended',
              timestamp: new Date(),
              status: 'sent',
              type: 'text'
          });
      }
      // 2. Close UI
      terminateCall();
  };

  const handleClearChat = useCallback(async () => {
      if (activeChatId) {
          try {
             await clearChatMessages(activeChatId);
             alert("Messages cleared successfully.");
          } catch (e) {
             alert("Failed to clear messages. Please try again.");
          }
      }
  }, [activeChatId]);

  const handleDeleteContact = useCallback(async (id: string) => {
      try {
          await deleteContact(id);
          setActiveChatId(null);
          setIsSidebarVisible(true);
      } catch (e) {
          alert("Failed to delete contact.");
      }
  }, []);

  if (!currentUser) return <div className="flex h-screen items-center justify-center bg-app-bg text-white">Loading...</div>;

  return (
    <div className="flex h-screen bg-app-bg text-text-primary overflow-hidden font-sans">
      
      {/* FULL SCREEN CALL OVERLAY */}
      {currentCall.isActive && currentCall.contact && (
          <CallOverlay 
             callState={currentCall} 
             onEndCall={() => endCall(true)}
             onAnswerCall={answerCall}
             remoteStream={remoteStream}
          />
      )}

      <div className="container mx-auto max-w-[1600px] h-full flex shadow-lg relative">
        
        {/* Sidebar Panel */}
        <div className={`
          w-full md:w-[350px] lg:w-[400px] h-full flex-shrink-0 absolute md:static z-20 transition-transform duration-300
          ${isSidebarVisible ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <Sidebar 
            contacts={contacts} 
            activeChatId={activeChatId} 
            onSelectContact={handleSelectContact} 
            currentUser={currentUser}
          />
        </div>

        {/* Chat Panel */}
        <div className={`
          flex-1 h-full flex flex-col bg-conversation-panel absolute md:static w-full z-10 transition-transform duration-300
          ${!isSidebarVisible ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
          {activeChatId && activeContact ? (
            <ChatWindow 
              contact={activeContact}
              messages={messages}
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
              onSendCall={handleStartCall}
              onClearChat={handleClearChat}
              onDeleteContact={handleDeleteContact}
              onBack={handleBackToSidebar}
              isTyping={activeContact.isTyping}
              onTyping={handleTyping}
            />
          ) : (
            // Empty State
            <div className="hidden md:flex flex-col items-center justify-center h-full bg-app-bg text-center px-10 border-b-[6px] border-teal-green">
              <div className="mb-8 opacity-80">
                 <div className="w-[300px] h-[200px] bg-slate-800 rounded-lg flex items-center justify-center text-slate-600">
                    <span className="text-6xl font-light">Talk Flow</span>
                 </div>
              </div>
              <h1 className="text-3xl font-light text-text-primary mb-4">Talk Flow Web</h1>
              <p className="text-text-secondary text-sm leading-6">
                Send and receive messages with AI personas & Real People.<br/>
                Messages are synced with Firestore.
              </p>
              <div className="mt-10 flex items-center gap-2 text-text-secondary text-xs">
                <span className="w-3 h-3 bg-slate-600 rounded-full"></span>
                <span>Your ID: <code className="bg-black/20 px-1 rounded">{currentUser.key}</code></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
