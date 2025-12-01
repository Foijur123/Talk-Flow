
import React, { useState, useRef, useEffect } from 'react';
import { Contact, Message, User } from '../types';
import MessageBubble from './MessageBubble';
import { ArrowLeft, MoreVertical, Paperclip, Send, Search, Smile, Mic, Video, Phone, Trash2, User as UserIcon, XCircle, Copy, Trash, X, StopCircle, ImageIcon, Download, Palette, UserMinus, Ban, Unlock, Check } from 'lucide-react';
import { updateMessage, deleteMessage, toggleBlockContact, listenToUserStatus } from '../services/firebase';

interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  currentUser: User;
  onSendMessage: (text: string, type: 'text' | 'image' | 'audio') => void;
  onSendCall: (type: 'video-call' | 'voice-call') => void;
  onClearChat: () => void;
  onDeleteContact: (id: string) => void;
  onBack: () => void;
  isTyping?: boolean;
  onTyping?: (isTyping: boolean) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  message: Message | null;
}

// --- WALLPAPER LIBRARY ---
const WALLPAPERS = {
  defaults: [
    '#0b141a', // Default Dark
    'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', // WhatsApp Doodle
  ],
  iphone: [
    'linear-gradient(180deg, #FFB6C1 0%, #FF69B4 100%)', // Pink Aura
    'linear-gradient(180deg, #A1C4FD 0%, #C2E9FB 100%)', // Blue Sky
    'linear-gradient(180deg, #D4FC79 0%, #96E6A1 100%)', // Fresh Green
    'linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)', // Peach
    'linear-gradient(to top, #30cfd0 0%, #330867 100%)', // Deep Purple
    'url("https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80")', // Gradient Mesh
    'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80")', // Abstract Oil
    'url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80")', // Neon Tokyo
    'url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80")', // Ocean
    'url("https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80")', // Foggy Forest
    'url("https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80")', // Mountains
    'url("https://images.unsplash.com/photo-1534067783741-514d4dddb79e?w=800&q=80")', // Aurora
    'url("https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80")', // Stars
  ],
  colors: [
    '#1f2c34', '#ffffff', '#000000', '#dcf8c6', '#ece5dd', 
    '#ffe4e1', '#e0ffff', '#f0f8ff', '#f5f5dc', '#fffacd',
    '#2c3e50', '#34495e', '#2c2c54', '#40407a', '#706fd3',
    '#b33939', '#218c74', '#33d9b2', '#cd6133', '#84817a'
  ],
  patterns: [
    'url("https://www.transparenttextures.com/patterns/cubes.png")',
    'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")',
    'url("https://www.transparenttextures.com/patterns/diagmonds-light.png")',
    'url("https://www.transparenttextures.com/patterns/dark-matter.png")',
    'url("https://www.transparenttextures.com/patterns/food.png")',
    'url("https://www.transparenttextures.com/patterns/graphy.png")',
    'url("https://www.transparenttextures.com/patterns/hexellence.png")',
    'url("https://www.transparenttextures.com/patterns/stardust.png")',
    'url("https://www.transparenttextures.com/patterns/wood-pattern.png")',
    'url("https://www.transparenttextures.com/patterns/zig-zag.png")',
  ],
  gradients: [
     'linear-gradient(to right, #243949 0%, #517fa4 100%)',
     'linear-gradient(to top, #37ecba 0%, #72afd3 100%)',
     'linear-gradient(to right, #b8cbb8 0%, #b8cbb8 0%, #b465da 0%, #cf6cc9 33%, #ee609c 66%, #ee609c 100%)',
     'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
     'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)',
     'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)',
     'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
     'linear-gradient(to top, #fbc2eb 0%, #a6c1ee 100%)',
     'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)',
     'linear-gradient(to top, #accbee 0%, #e7f0fd 100%)',
  ]
};

const ChatWindow: React.FC<ChatWindowProps> = ({ contact, messages, currentUser, onSendMessage, onSendCall, onClearChat, onDeleteContact, onBack, isTyping, onTyping }) => {
  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, message: null });
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());
  
  // Presence State
  const [friendStatus, setFriendStatus] = useState<{isOnline: boolean, lastSeen: Date | null}>({ isOnline: false, lastSeen: null });
  
  // New Feature States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isWallpaperPickerOpen, setIsWallpaperPickerOpen] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState<string>(WALLPAPERS.defaults[1]); // Default to Doodle
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingCancelled = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Listen to Friend Status
  useEffect(() => {
    if (contact.isAI || !contact.targetUserId) {
        // AI is always online
        setFriendStatus({ isOnline: true, lastSeen: new Date() });
        return;
    }

    const unsubscribe = listenToUserStatus(contact.targetUserId, (lastSeen, isOnline) => {
        setFriendStatus({ isOnline, lastSeen });
    });

    return () => unsubscribe();
  }, [contact.id, contact.targetUserId, contact.isAI]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', (e) => handleClickOutside(e as unknown as MouseEvent));
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', (e) => handleClickOutside(e as unknown as MouseEvent));
    };
  }, []);

  // Timer for recording
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
        interval = setInterval(() => {
            setRecordingDuration(prev => prev + 1);
        }, 1000);
    } else {
        setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (contact.isBlocked) return 'Blocked';
    if (isTyping) return 'typing...';
    if (contact.isAI) return 'Always active';
    if (friendStatus.isOnline) return 'Online';
    if (friendStatus.lastSeen) {
        return `Last seen ${friendStatus.lastSeen.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    return 'Offline';
  };

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText, 'text');
      setInputText('');
      setShowEmojiPicker(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExportChat = () => {
      const chatContent = messages.map(m => {
          const sender = m.senderId === 'user-me' || m.senderId === currentUser.id ? 'Me' : contact.name;
          const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : 'Unknown Time';
          return `[${time}] ${sender}: ${m.type === 'text' ? m.content : `<${m.type} attachment>`}`;
      }).join('\n\n');

      const blob = new Blob([chatContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_with_${contact.name.replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleDeleteContact = () => {
      if(window.confirm(`Are you sure you want to delete ${contact.name}? This will remove the chat from your list.`)) {
          onDeleteContact(contact.id);
      }
  };

  const handleToggleBlock = async () => {
      const newStatus = !contact.isBlocked;
      const action = newStatus ? "Block" : "Unblock";
      if(window.confirm(`Are you sure you want to ${action} ${contact.name}?`)) {
          await toggleBlockContact(contact.id, newStatus);
      }
  };

  const handleMenuAction = (action: string) => {
    setIsMenuOpen(false);
    switch(action) {
        case 'clear':
            if (window.confirm('Are you sure you want to clear all messages in this chat?')) {
                onClearChat();
            }
            break;
        case 'info':
            alert(`Contact Info:\nName: ${contact.name}\nStatus: ${contact.systemInstruction || "No status"}\nID: ${contact.id}`);
            break;
        case 'close':
            onBack();
            break;
        case 'export':
            handleExportChat();
            break;
        case 'wallpaper':
            setIsWallpaperPickerOpen(true);
            break;
        case 'delete-contact':
            handleDeleteContact();
            break;
        case 'toggle-block':
            handleToggleBlock();
            break;
    }
  };

  const handleLongPress = (message: Message, position: { x: number; y: number }) => {
    if (navigator.vibrate) navigator.vibrate(50);
    setContextMenu({
      visible: true,
      x: position.x,
      y: position.y,
      message: message
    });
  };

  const handleReaction = async (emoji: string) => {
    if (!contextMenu.message) return;
    await updateMessage(contact.id, contextMenu.message.id, { reaction: emoji });
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleCopy = () => {
    if (!contextMenu.message) return;
    navigator.clipboard.writeText(contextMenu.message.content);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleDeleteForMe = () => {
    if (!contextMenu.message) return;
    setHiddenMessageIds(prev => new Set(prev).add(contextMenu.message!.id));
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleDeleteForEveryone = async () => {
    if (!contextMenu.message) return;
    if (window.confirm("Delete this message for everyone?")) {
        const messageId = contextMenu.message.id;
        const chatId = contextMenu.message.chatId || contact.chatRoomId || contact.id;
        
        setHiddenMessageIds(prev => new Set(prev).add(messageId));
        setContextMenu(prev => ({ ...prev, visible: false }));
        
        try {
            await deleteMessage(chatId, messageId);
        } catch (error) {
            console.error(error);
            alert("Failed to delete.");
            setHiddenMessageIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(messageId);
                return newSet;
            });
        }
    } else {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  // --- Image Sending ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) { // 2MB limit
          alert("File too large. Please select an image under 2MB.");
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          const base64 = reader.result as string;
          onSendMessage(base64, 'image');
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Voice Recording ---
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          isRecordingCancelled.current = false;
          const chunks: BlobPart[] = [];

          mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
              const streamTracks = stream.getTracks();
              streamTracks.forEach(track => track.stop());

              if (isRecordingCancelled.current) {
                  return; // Discard recording
              }

              const blob = new Blob(chunks, { type: 'audio/webm' });
              const reader = new FileReader();
              reader.onloadend = () => {
                   const base64 = reader.result as string;
                   onSendMessage(base64, 'audio');
              };
              reader.readAsDataURL(blob);
          };

          mediaRecorder.start();
          setIsRecording(true);
      } catch (err) {
          console.error("Mic access denied", err);
          alert("Microphone access denied. Please allow microphone permissions in your browser settings.");
      }
  };

  const stopAndSendRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const cancelRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          isRecordingCancelled.current = true;
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  // --- Emoji ---
  const emojiList = ["😀", "😂", "🥰", "😍", "😎", "🤔", "😢", "😭", "😤", "👍", "👎", "👋", "🔥", "✨", "❤️", "💯"];

  const filteredMessages = messages
    .filter(m => !hiddenMessageIds.has(m.id))
    // Hide WebRTC signaling messages
    .filter(m => !m.type.startsWith('webrtc')) 
    .filter(m => !messageSearchTerm || m.content.toLowerCase().includes(messageSearchTerm.toLowerCase()));

  const isMessageFromMe = contextMenu.message?.senderId === 'user-me' || contextMenu.message?.senderId === currentUser.id;

  return (
    <div className="flex flex-col h-full bg-app-bg relative">
        
        {/* Background Wallpaper Layer */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div 
                className="w-full h-full transition-all duration-500 ease-in-out"
                style={{ 
                    background: currentWallpaper,
                    backgroundRepeat: currentWallpaper.includes('http') && !currentWallpaper.includes('pattern') ? 'no-repeat' : 'repeat',
                    backgroundSize: currentWallpaper.includes('http') && !currentWallpaper.includes('pattern') ? 'cover' : 'auto',
                    backgroundPosition: 'center',
                    opacity: currentWallpaper === WALLPAPERS.defaults[0] ? 1 : 0.8 // Dark default is opaque, others slightly transparent to blend if needed
                }}
            />
            {/* Dark overlay for contrast on bright wallpapers */}
            {currentWallpaper !== WALLPAPERS.defaults[0] && (
                <div className="absolute inset-0 bg-black/30" />
            )}
        </div>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-panel-header z-20 shrink-0 border-b border-gray-800">
        <div className="flex items-center overflow-hidden">
          <button onClick={onBack} className="mr-2 md:hidden text-icon-gray">
            <ArrowLeft size={24} />
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden mr-3 cursor-pointer shrink-0">
            <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col justify-center cursor-pointer min-w-0">
            <h2 className="text-text-primary font-medium leading-tight truncate">{contact.name}</h2>
            <span className={`text-xs truncate ${friendStatus.isOnline && !contact.isAI && !contact.isBlocked ? 'text-teal-green font-medium' : 'text-text-secondary'}`}>
              {getStatusText()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 text-icon-gray relative shrink-0">
          {!contact.isBlocked && (
              <>
                <button onClick={() => onSendCall('video-call')} className="p-2 rounded-full hover:bg-white/10 transition-colors" title="Video Call">
                    <Video size={20} />
                </button>
                <button onClick={() => onSendCall('voice-call')} className="p-2 rounded-full hover:bg-white/10 transition-colors" title="Voice Call">
                    <Phone size={20} />
                </button>
                <div className="hidden sm:block w-[1px] h-6 bg-gray-700 mx-1"></div>
              </>
          )}
          
          <button 
             onClick={() => setIsSearchOpen(!isSearchOpen)}
             className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isSearchOpen ? 'text-teal-green' : ''}`}
          >
              <Search size={20} />
          </button>
          
          <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isMenuOpen ? 'bg-white/10' : ''}`}
              >
                <MoreVertical size={20} />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-10 w-52 bg-panel-header border border-gray-800 rounded-lg shadow-xl py-1 z-30 overflow-hidden animate-in zoom-in-95 duration-100 origin-top-right">
                    <button onClick={() => handleMenuAction('info')} className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"><UserIcon size={16} /> Contact info</button>
                    <button onClick={() => handleMenuAction('wallpaper')} className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"><Palette size={16} /> Wallpaper</button>
                    <button onClick={() => handleMenuAction('export')} className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"><Download size={16} /> Export chat</button>
                    <button onClick={() => handleMenuAction('clear')} className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"><Trash2 size={16} /> Clear messages</button>
                    <button onClick={() => handleMenuAction('toggle-block')} className="w-full px-4 py-3 text-left text-red-400 hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm">
                        {contact.isBlocked ? <><Unlock size={16}/> Unblock Contact</> : <><Ban size={16}/> Block Contact</>}
                    </button>
                    <button onClick={() => handleMenuAction('delete-contact')} className="w-full px-4 py-3 text-left text-red-400 hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"><UserMinus size={16} /> Delete Contact</button>
                    <button onClick={() => handleMenuAction('close')} className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"><XCircle size={16} /> Close chat</button>
                </div>
              )}
          </div>
        </div>
      </header>

      {/* Search Bar Overlay */}
      {isSearchOpen && (
          <div className="bg-conversation-panel px-4 py-2 border-b border-gray-700 flex items-center gap-2 animate-in slide-in-from-top-2 z-10">
              <Search size={18} className="text-icon-gray" />
              <input 
                 autoFocus
                 value={messageSearchTerm}
                 onChange={(e) => setMessageSearchTerm(e.target.value)}
                 className="flex-1 bg-transparent text-sm text-text-primary focus:outline-none"
                 placeholder="Search messages..."
              />
              <button onClick={() => { setIsSearchOpen(false); setMessageSearchTerm(''); }} className="text-icon-gray"><X size={18}/></button>
          </div>
      )}

      {/* WALLPAPER PICKER MODAL */}
      {isWallpaperPickerOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-panel-header rounded-xl w-full max-w-2xl h-[80%] shadow-2xl border border-gray-700 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-conversation-panel shrink-0">
                      <h3 className="text-text-primary font-medium text-lg">Set Chat Wallpaper</h3>
                      <button onClick={() => setIsWallpaperPickerOpen(false)} className="text-text-secondary hover:text-white"><X size={24}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      {/* Section: iPhone / Gradients */}
                      <div className="mb-6">
                          <h4 className="text-teal-green text-sm font-bold uppercase mb-3">iPhone & Gradients</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              {WALLPAPERS.iphone.map((wp, i) => (
                                  <button 
                                      key={`iphone-${i}`}
                                      onClick={() => setCurrentWallpaper(wp)}
                                      className="aspect-[9/16] rounded-lg border-2 border-transparent hover:border-teal-green transition-all relative overflow-hidden group"
                                      style={{ background: wp, backgroundSize: 'cover' }}
                                  >
                                      {currentWallpaper === wp && (
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                              <Check size={24} className="text-white" />
                                          </div>
                                      )}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Section: Classics */}
                      <div className="mb-6">
                          <h4 className="text-teal-green text-sm font-bold uppercase mb-3">Classics</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                               {WALLPAPERS.defaults.map((wp, i) => (
                                  <button 
                                      key={`def-${i}`}
                                      onClick={() => setCurrentWallpaper(wp)}
                                      className="aspect-[9/16] rounded-lg border-2 border-transparent hover:border-teal-green transition-all relative overflow-hidden"
                                      style={{ background: wp }}
                                  >
                                      {i === 1 && <span className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white/80 px-1 rounded">Doodle</span>}
                                      {currentWallpaper === wp && (
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                              <Check size={24} className="text-white" />
                                          </div>
                                      )}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Section: Colors */}
                      <div className="mb-6">
                          <h4 className="text-teal-green text-sm font-bold uppercase mb-3">Solid Colors</h4>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                              {WALLPAPERS.colors.map((wp, i) => (
                                  <button 
                                      key={`col-${i}`}
                                      onClick={() => setCurrentWallpaper(wp)}
                                      className="aspect-square rounded-full border-2 border-transparent hover:border-teal-green transition-all relative"
                                      style={{ background: wp }}
                                  >
                                       {currentWallpaper === wp && (
                                          <div className="absolute inset-0 flex items-center justify-center">
                                              <Check size={16} className="text-black/50" />
                                          </div>
                                      )}
                                  </button>
                              ))}
                          </div>
                      </div>
                      
                      {/* Section: Patterns */}
                      <div className="mb-6">
                          <h4 className="text-teal-green text-sm font-bold uppercase mb-3">Patterns</h4>
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                              {WALLPAPERS.patterns.map((wp, i) => (
                                  <button 
                                      key={`pat-${i}`}
                                      onClick={() => setCurrentWallpaper(wp)}
                                      className="aspect-square rounded-lg border-2 border-transparent hover:border-teal-green transition-all relative bg-conversation-panel"
                                      style={{ backgroundImage: wp, backgroundSize: 'auto' }}
                                  >
                                       {currentWallpaper === wp && (
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                              <Check size={16} className="text-white" />
                                          </div>
                                      )}
                                  </button>
                              ))}
                          </div>
                      </div>

                  </div>
                  
                  <div className="p-4 bg-conversation-panel border-t border-gray-700 flex justify-end">
                      <button 
                        onClick={() => setIsWallpaperPickerOpen(false)}
                        className="bg-teal-green text-black font-bold py-2 px-6 rounded-lg hover:bg-teal-600 transition-colors"
                      >
                          Done
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]" onClick={() => setContextMenu(prev => ({...prev, visible: false}))}>
            <div 
                ref={contextMenuRef}
                className="bg-panel-header rounded-xl shadow-2xl border border-gray-700 w-64 overflow-hidden animate-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
                style={{ top: Math.min(contextMenu.y, window.innerHeight - 250), left: Math.min(Math.max(contextMenu.x - 128, 10), window.innerWidth - 266), position: 'absolute' }}
            >
                <div className="flex justify-around p-3 border-b border-gray-700 bg-conversation-panel">
                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                        <button key={emoji} onClick={() => handleReaction(emoji)} className="text-xl hover:scale-125 transition-transform p-1">{emoji}</button>
                    ))}
                </div>
                <div className="py-1">
                    <button onClick={handleCopy} className="w-full px-4 py-3 text-left text-text-primary hover:bg-gray-700 flex items-center gap-3 text-sm"><Copy size={18} className="text-icon-gray" /> Copy</button>
                    <button onClick={handleDeleteForMe} className="w-full px-4 py-3 text-left text-text-primary hover:bg-gray-700 flex items-center gap-3 text-sm"><Trash size={18} className="text-icon-gray" /> Delete for me</button>
                    {isMessageFromMe && (
                        <button onClick={handleDeleteForEveryone} className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-700 flex items-center gap-3 text-sm"><Trash2 size={18} /> Delete for everyone</button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 z-10 custom-scrollbar relative">
        {filteredMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} currentUserId={currentUser.id} onLongPress={handleLongPress} />
        ))}
        {isTyping && !contact.isBlocked && (
             <div className="flex justify-start mb-2">
                 <div className="bg-incoming-bg px-4 py-3 rounded-lg rounded-tl-none shadow-sm flex items-center space-x-1">
                     <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                     <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                     <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                 </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {contact.isBlocked ? (
        <div className="bg-panel-header px-4 py-4 flex items-center justify-center z-10 shrink-0 border-t border-gray-800">
            <div className="bg-black/20 text-text-secondary px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                <Ban size={16} /> You blocked this contact. Tap the menu to unblock.
            </div>
        </div>
      ) : (
      <div className="bg-panel-header px-4 py-2 flex items-center z-10 shrink-0 gap-3 relative min-h-[62px]">
        {isRecording ? (
            /* Recording UI Overlay */
            <div className="flex-1 flex items-center justify-between animate-in fade-in duration-200 w-full">
                <button 
                    onClick={cancelRecording}
                    className="p-3 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                    title="Delete Recording"
                >
                    <Trash2 size={24} />
                </button>
                
                <div className="flex items-center gap-3 text-text-primary font-mono text-lg">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    {formatDuration(recordingDuration)}
                </div>
                
                <button 
                    onClick={stopAndSendRecording}
                    className="p-3 bg-teal-green text-black rounded-full hover:bg-teal-600 transition-colors shadow-lg"
                    title="Send Voice Message"
                >
                    <Send size={24} />
                </button>
            </div>
        ) : (
            /* Standard Input UI */
            <>
                {showEmojiPicker && (
                    <div ref={emojiRef} className="absolute bottom-16 left-4 bg-panel-header border border-gray-700 rounded-lg shadow-xl p-4 grid grid-cols-8 gap-2 w-72 h-64 overflow-y-auto z-50">
                        {emojiList.map(e => (
                            <button key={e} onClick={() => setInputText(prev => prev + e)} className="text-2xl hover:bg-white/10 rounded p-1">{e}</button>
                        ))}
                    </div>
                )}

                <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                    className={`text-icon-gray hover:text-text-primary transition-colors ${showEmojiPicker ? 'text-teal-green' : ''}`}
                >
                    <Smile size={24} />
                </button>
                
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-icon-gray hover:text-text-primary transition-colors"
                >
                    <Paperclip size={24} />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    accept="image/*" 
                    className="hidden" 
                />
                
                <div className="flex-1 bg-conversation-panel rounded-lg px-4 py-2 flex items-center">
                    <input 
                        type="text" 
                        className="bg-transparent w-full text-text-primary placeholder-text-secondary focus:outline-none max-h-24"
                        placeholder="Type a message"
                        value={inputText}
                        onChange={(e) => {
                            setInputText(e.target.value);
                            if (onTyping) onTyping(true);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {inputText.trim() ? (
                    <button onClick={handleSend} className="text-teal-green hover:text-teal-500 transition-colors p-2">
                        <Send size={24} />
                    </button>
                ) : (
                    <button 
                        onClick={startRecording}
                        className="text-icon-gray hover:text-text-primary transition-colors p-2"
                        title="Record Voice"
                    >
                        <Mic size={24} />
                    </button>
                )}
            </>
        )}
      </div>
      )}
    </div>
  );
};

export default ChatWindow;
