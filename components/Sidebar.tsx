
import React, { useState, useRef, useEffect } from 'react';
import { Contact, User, DeviceSession } from '../types';
import { MessageSquarePlus, MoreVertical, Search, Bot, User as UserIcon, X, Plus, Copy, Check, LogOut, Settings, MessageCircle, Phone, Video, ArrowDownLeft, ArrowUpRight, Users, Ban, Unlock, Bell, Shield, Moon, HelpCircle, ChevronRight, Smartphone, RefreshCw, PlusCircle, Lock, Key, LogIn, Laptop, Globe } from 'lucide-react';
import { addNewContact, addRealContact, syncUserToFirestore, createGroup, toggleBlockContact, loginWithKeyAndPin, updateUserPin, revokeDeviceSession, listenToUserSessions } from '../services/firebase';
import { updateUserProfile, getAvailableAccounts, createNewAccount, switchAccount, addExistingAccount } from '../services/userService';

interface SidebarProps {
  contacts: Contact[];
  activeChatId: string | null;
  onSelectContact: (id: string) => void;
  currentUser: User;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ contacts, activeChatId, onSelectContact, currentUser, className }) => {
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBlockedUsersOpen, setIsBlockedUsersOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false); 
  const [isDevicesOpen, setIsDevicesOpen] = useState(false); // Linked Devices
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'chats' | 'groups' | 'calls'>('chats');
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // New Chat State
  const [newContactName, setNewContactName] = useState('');
  const [newContactInstruction, setNewContactInstruction] = useState('');
  const [targetUserKey, setTargetUserKey] = useState('');
  const [contactType, setContactType] = useState<'ai' | 'real'>('ai');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // New Group State
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set());

  // Profile State
  const [myDisplayName, setMyDisplayName] = useState(currentUser.name);
  const [copied, setCopied] = useState(false);
  const [displayPin, setDisplayPin] = useState(currentUser.pin || 'Not Set');
  const [pinGenerated, setPinGenerated] = useState(false);

  // Devices State
  const [sessions, setSessions] = useState<DeviceSession[]>([]);

  // Settings State
  const [appSettings, setAppSettings] = useState({
      notifications: true,
      sound: true,
      readReceipts: true,
      compactView: false,
  });

  // Account Switching Data
  const [availableAccounts, setAvailableAccounts] = useState<User[]>([]);
  // Auth states for account actions
  const [accountAction, setAccountAction] = useState<'list' | 'create' | 'login' | 'verify'>('list');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPin, setNewAccountPin] = useState('');
  const [loginKey, setLoginKey] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [verifyPin, setVerifyPin] = useState('');
  const [targetSwitchId, setTargetSwitchId] = useState<string | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update display PIN if current user changes
  useEffect(() => {
      setDisplayPin(currentUser.pin || 'Not Set');
      setMyDisplayName(currentUser.name);
  }, [currentUser]);

  // Fetch accounts when opening modal
  useEffect(() => {
    if (isAccountsOpen) {
        setAvailableAccounts(getAvailableAccounts());
        setAccountAction('list');
        setErrorMsg('');
    }
  }, [isAccountsOpen]);

  // Fetch sessions when opening devices modal
  useEffect(() => {
    if (isDevicesOpen) {
        const unsubscribe = listenToUserSessions(currentUser.id, (fetchedSessions) => {
            // Mark current device
            const currentInstallId = localStorage.getItem('talkflow_install_id');
            const mapped = fetchedSessions.map(s => ({
                ...s,
                isCurrent: s.sessionId === currentInstallId
            }));
            setSessions(mapped);
        });
        return () => unsubscribe();
    }
  }, [isDevicesOpen, currentUser.id]);

  const formatTime = (date?: Date) => {
    if (!date) return '';
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    return isToday 
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : date.toLocaleDateString();
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsCreating(true);
    
    try {
      if (contactType === 'ai') {
         if (!newContactName.trim()) return;
         await addNewContact(newContactName, newContactInstruction, true, currentUser.id);
         setNewContactName('');
         setNewContactInstruction('');
      } else {
         if (!targetUserKey.trim()) {
             setErrorMsg("Please enter a user key.");
             return;
         }
         await addRealContact(currentUser.id, targetUserKey.trim());
         setTargetUserKey('');
      }
      setIsNewChatOpen(false);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Failed to add contact.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!groupName.trim()) {
          setErrorMsg("Group name is required");
          return;
      }
      if (selectedGroupMembers.size === 0) {
          setErrorMsg("Select at least one member");
          return;
      }
      
      setIsCreating(true);
      try {
          await createGroup(groupName, Array.from(selectedGroupMembers), currentUser.id);
          setIsNewGroupOpen(false);
          setGroupName('');
          setSelectedGroupMembers(new Set());
      } catch (error: any) {
          setErrorMsg(error.message);
      } finally {
          setIsCreating(false);
      }
  };

  const toggleGroupMember = (userId: string) => {
      const newSet = new Set(selectedGroupMembers);
      if (newSet.has(userId)) {
          newSet.delete(userId);
      } else {
          newSet.add(userId);
      }
      setSelectedGroupMembers(newSet);
  };

  const handleCopyKey = () => {
      if (currentUser.key) {
          navigator.clipboard.writeText(currentUser.key);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const handleSaveProfile = async () => {
      currentUser.name = myDisplayName;
      updateUserProfile(currentUser); 
      await syncUserToFirestore(currentUser);
      setIsProfileOpen(false);
  };

  const handleRegeneratePin = async () => {
      // Direct action without confirmation for smoother UX, or use a custom UI
      const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Update local state immediately
      setDisplayPin(randomPin);
      setPinGenerated(true);
      
      // Update User Object reference (mutation)
      currentUser.pin = randomPin;
      
      // Persist changes
      updateUserProfile(currentUser); // Update localStorage
      await updateUserPin(currentUser.id, randomPin); // Update Firestore
      
      // Clear success message after 3s
      setTimeout(() => setPinGenerated(false), 3000);
  };

  const handleLogout = () => {
      if(window.confirm("This will clear ALL your local accounts and reset the app. Are you sure?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const handleUnblock = async (contactId: string) => {
      await toggleBlockContact(contactId, false);
  };

  const toggleSetting = (key: keyof typeof appSettings) => {
      setAppSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRevokeSession = async (sessionId: string) => {
      if(window.confirm("Log out this device?")) {
          await revokeDeviceSession(currentUser.id, sessionId);
      }
  };

  // --- ACCOUNT SWITCHING LOGIC ---

  const initiateSwitchAccount = (account: User) => {
      if (account.id === currentUser.id) return;

      if (account.pin) {
          setTargetSwitchId(account.id);
          setAccountAction('verify');
          setVerifyPin('');
          setErrorMsg('');
      } else {
          switchAccount(account.id);
      }
  };

  const submitVerifyPin = () => {
      const targetAccount = availableAccounts.find(u => u.id === targetSwitchId);
      if (targetAccount && targetAccount.pin === verifyPin) {
          switchAccount(targetAccount.id);
      } else {
          setErrorMsg("Incorrect PIN");
      }
  };

  const submitCreateAccount = () => {
      if (!newAccountName.trim() || newAccountPin.length < 4) {
          setErrorMsg("Name required & PIN must be 4+ digits");
          return;
      }
      const newUser = createNewAccount(newAccountName, newAccountPin);
      syncUserToFirestore(newUser);
      // It auto switches in createNewAccount but we force reload
      window.location.reload();
  };

  const submitLoginAccount = async () => {
      setErrorMsg('');
      if (!loginKey.trim() || !loginPin.trim()) {
          setErrorMsg("Key and PIN required");
          return;
      }
      try {
          const user = await loginWithKeyAndPin(loginKey.trim(), loginPin.trim());
          if (user) {
              addExistingAccount(user);
              window.location.reload();
          } else {
              setErrorMsg("Invalid Key or PIN");
          }
      } catch (e) {
          setErrorMsg("Login failed");
      }
  };

  // ------------------------------

  // Filter contacts
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter blocked contacts
  const blockedContacts = contacts.filter(c => c.isBlocked);

  // Eligible contacts for group (Real people only, not self, not groups, not blocked)
  const eligibleGroupContacts = contacts.filter(c => !c.isAI && !c.isGroup && c.targetUserId && !c.isBlocked);

  // Render Contact Item Function
  const renderContactItem = (contact: Contact) => (
    <div 
      key={contact.id}
      onClick={() => onSelectContact(contact.id)}
      className={`flex items-center px-3 cursor-pointer transition-colors border-b border-gray-800 hover:bg-panel-header ${
        activeChatId === contact.id ? 'bg-panel-header' : ''
      } ${appSettings.compactView ? 'py-2' : 'py-3'}`}
    >
      <div className={`${appSettings.compactView ? 'w-10 h-10' : 'w-12 h-12'} rounded-full overflow-hidden mr-3 shrink-0 relative`}>
        <img src={contact.avatar} alt={contact.name} className={`w-full h-full object-cover ${contact.isBlocked ? 'grayscale opacity-50' : ''}`} />
        {contact.isAI && (
            <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-[2px] border border-panel-header" title="AI Assistant">
                <Bot size={10} className="text-white" />
            </div>
        )}
        {contact.isGroup && (
            <div className="absolute bottom-0 right-0 bg-teal-green rounded-full p-[2px] border border-panel-header" title="Group Chat">
                <Users size={10} className="text-black" />
            </div>
        )}
        {contact.isBlocked && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Ban size={20} className="text-red-500" />
            </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <h3 className={`text-text-primary text-base truncate ${contact.isBlocked ? 'text-text-secondary line-through' : ''}`}>{contact.name}</h3>
          <span className={`text-xs ${contact.unreadCount > 0 ? 'text-teal-green font-medium' : 'text-text-secondary'}`}>
            {formatTime(contact.lastMessageTime)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-text-secondary text-sm truncate pr-2 flex items-center">
            {contact.isBlocked ? (
                <span className="italic">Blocked</span>
            ) : contact.isTyping ? (
              <span className="text-teal-green font-medium animate-pulse">typing...</span>
            ) : (
              <span className="truncate">{contact.lastMessage}</span>
            )}
          </p>
          {contact.unreadCount > 0 && !contact.isBlocked && (
            <span className="bg-teal-green text-black text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
              {contact.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-full border-r border-gray-800 bg-conversation-panel ${className} relative`}>
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-panel-header shrink-0">
        <button 
            onClick={() => setIsProfileOpen(true)}
            className="w-10 h-10 rounded-full overflow-hidden bg-gray-600 hover:opacity-80 transition-opacity"
            title="My Profile"
        >
           <img src={currentUser.avatar} alt="My Profile" className="w-full h-full object-cover" />
        </button>
        <div className="flex gap-4 text-icon-gray">
          {activeTab === 'chats' && (
              <button 
                onClick={() => setIsNewChatOpen(true)}
                className="hover:text-white transition-colors" 
                title="New Chat"
              >
                <MessageSquarePlus size={24} />
              </button>
          )}
          {activeTab === 'groups' && (
              <button 
                onClick={() => setIsNewGroupOpen(true)}
                className="hover:text-white transition-colors" 
                title="New Group"
              >
                <Users size={24} />
              </button>
          )}
          
          <div className="relative" ref={menuRef}>
            <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`hover:text-white transition-colors ${isMenuOpen ? 'text-white' : ''}`}
            >
                <MoreVertical size={24} />
            </button>
            {isMenuOpen && (
                <div className="absolute right-0 top-10 w-56 bg-panel-header border border-gray-800 rounded-lg shadow-xl py-1 z-30 animate-in zoom-in-95 duration-100 origin-top-right">
                    <button 
                        onClick={() => { setIsNewGroupOpen(true); setIsMenuOpen(false); }} 
                        className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"
                    >
                        <Users size={18} /> New Group
                    </button>
                    <button 
                        onClick={() => { setIsProfileOpen(true); setIsMenuOpen(false); }} 
                        className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"
                    >
                        <UserIcon size={18} /> Profile
                    </button>
                    <button 
                        onClick={() => { setIsAccountsOpen(true); setIsMenuOpen(false); }} 
                        className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm border-t border-gray-700"
                    >
                        <RefreshCw size={18} /> Switch Accounts
                    </button>
                    <button 
                        onClick={() => { setIsDevicesOpen(true); setIsMenuOpen(false); }} 
                        className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm border-t border-gray-700"
                    >
                        <Laptop size={18} /> Linked Devices
                    </button>
                    <button 
                        onClick={() => { setIsBlockedUsersOpen(true); setIsMenuOpen(false); }} 
                        className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm border-t border-gray-700"
                    >
                        <Ban size={18} /> Blocked Users
                    </button>
                    <button 
                        onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }} 
                        className="w-full px-4 py-3 text-left text-text-primary hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"
                    >
                        <Settings size={18} /> Settings
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="w-full px-4 py-3 text-left text-red-400 hover:bg-conversation-panel transition-colors flex items-center gap-3 text-sm"
                    >
                        <LogOut size={18} /> Log out all
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 bg-conversation-panel shrink-0">
        <div className="relative flex items-center bg-panel-header rounded-lg px-4 py-2">
          <Search size={20} className="text-icon-gray mr-4" />
          <input 
            type="text" 
            placeholder={activeTab === 'chats' ? "Search chats" : activeTab === 'groups' ? "Search groups" : "Search contacts"} 
            className="bg-transparent text-sm text-text-primary w-full focus:outline-none placeholder-text-secondary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 && searchTerm && (
            <div className="p-4 text-center text-text-secondary text-sm">
                No items found
            </div>
        )}

        {/* CHATS TAB VIEW (1:1 Chats) */}
        {activeTab === 'chats' && filteredContacts
            .filter(c => !c.isGroup) // Filter out groups for the Chats tab
            .map(renderContactItem)
        }

        {/* GROUPS TAB VIEW (Group Chats) */}
        {activeTab === 'groups' && (
            <>
               {filteredContacts.filter(c => c.isGroup).length === 0 && !searchTerm && (
                   <div className="flex flex-col items-center justify-center p-8 text-center opacity-60">
                       <Users size={48} className="text-gray-500 mb-4" />
                       <p className="text-text-primary text-sm font-medium">No groups yet</p>
                       <p className="text-text-secondary text-xs mt-2">Create a group to start chatting with multiple friends.</p>
                       <button 
                         onClick={() => setIsNewGroupOpen(true)}
                         className="mt-4 text-teal-green text-sm hover:underline"
                       >
                           Create New Group
                       </button>
                   </div>
               )}
               {filteredContacts
                .filter(c => c.isGroup)
                .map(renderContactItem)
               }
            </>
        )}

        {/* CALLS TAB VIEW */}
        {activeTab === 'calls' && filteredContacts.map((contact) => {
            if (contact.isBlocked) return null; // Don't show blocked users in calls
            
            // Determine if the last message was a call
            const lastMsg = contact.lastMessage || '';
            const isVideo = lastMsg.toLowerCase().includes('video');
            const isVoice = lastMsg.toLowerCase().includes('voice') || lastMsg.toLowerCase().includes('call');
            const isCallMessage = isVideo || isVoice;
            const isMissed = contact.unreadCount > 0 && isCallMessage;
            
            return (
                <div 
                    key={contact.id}
                    className="flex items-center px-3 py-3 border-b border-gray-800 hover:bg-panel-header cursor-pointer"
                    onClick={() => onSelectContact(contact.id)}
                >
                    <div className="w-12 h-12 rounded-full overflow-hidden mr-3 shrink-0">
                        <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                        <h3 className={`text-base truncate ${isMissed ? 'text-red-400 font-medium' : 'text-text-primary'}`}>
                            {contact.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-text-secondary mt-1">
                            {isCallMessage ? (
                                <>
                                    {isMissed ? (
                                        <ArrowDownLeft size={16} className="text-red-500" />
                                    ) : (
                                        <ArrowDownLeft size={16} className="text-teal-green" />
                                    )}
                                    <span className="text-xs">{formatTime(contact.lastMessageTime)}</span>
                                </>
                            ) : (
                                <span className="text-xs">Tap icon to call</span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 mr-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onSelectContact(contact.id); }} 
                            className="text-teal-green p-2 rounded-full hover:bg-gray-700 transition-colors"
                        >
                            <Phone size={20} />
                        </button>
                    </div>
                </div>
            );
        })}
      </div>
      
      {/* Bottom Navigation Tabs */}
      <div className="flex bg-panel-header border-t border-gray-800">
        <button 
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors relative ${
                activeTab === 'chats' ? 'text-teal-green' : 'text-icon-gray hover:bg-white/5'
            }`}
        >
            <div className="relative">
                <MessageCircle size={24} fill={activeTab === 'chats' ? 'currentColor' : 'none'} />
                {contacts.filter(c => !c.isGroup).reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-teal-green text-black text-[10px] font-bold px-1 rounded-full">
                        {contacts.filter(c => !c.isGroup).reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
                    </span>
                )}
            </div>
            <span className="text-xs font-medium">Chats</span>
            {activeTab === 'chats' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-teal-green" />}
        </button>

        {/* Groups Tab */}
        <button 
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors relative ${
                activeTab === 'groups' ? 'text-teal-green' : 'text-icon-gray hover:bg-white/5'
            }`}
        >
            <div className="relative">
                <Users size={24} fill={activeTab === 'groups' ? 'currentColor' : 'none'} />
                {contacts.filter(c => c.isGroup).reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-teal-green text-black text-[10px] font-bold px-1 rounded-full">
                        {contacts.filter(c => c.isGroup).reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
                    </span>
                )}
            </div>
            <span className="text-xs font-medium">Groups</span>
            {activeTab === 'groups' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-teal-green" />}
        </button>

        <button 
            onClick={() => setActiveTab('calls')}
            className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors relative ${
                activeTab === 'calls' ? 'text-teal-green' : 'text-icon-gray hover:bg-white/5'
            }`}
        >
            <Phone size={24} fill={activeTab === 'calls' ? 'currentColor' : 'none'} />
            <span className="text-xs font-medium">Calls</span>
            {activeTab === 'calls' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-teal-green" />}
        </button>
      </div>

      {/* ACCOUNTS SWITCHER MODAL */}
      {isAccountsOpen && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-panel-header rounded-xl w-full max-w-sm shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-conversation-panel">
                      <h3 className="text-text-primary font-medium text-lg">
                          {accountAction === 'list' && "Switch Accounts"}
                          {accountAction === 'create' && "Create New Account"}
                          {accountAction === 'login' && "Login Existing"}
                          {accountAction === 'verify' && "Enter PIN"}
                      </h3>
                      <button onClick={() => {
                          if (accountAction === 'list') setIsAccountsOpen(false);
                          else setAccountAction('list');
                      }} className="text-text-secondary hover:text-white">
                          {accountAction === 'list' ? <X size={20}/> : "Back"}
                      </button>
                  </div>
                  
                  <div className="p-4">
                      {/* LIST VIEW */}
                      {accountAction === 'list' && (
                          <>
                              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                                  {availableAccounts.map(account => (
                                      <div 
                                        key={account.id}
                                        onClick={() => initiateSwitchAccount(account)}
                                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${
                                            account.id === currentUser.id 
                                            ? 'bg-teal-green/10 border-teal-green' 
                                            : 'bg-conversation-panel border-transparent hover:bg-gray-800'
                                        }`}
                                      >
                                          <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-full overflow-hidden">
                                                  <img src={account.avatar} className="w-full h-full object-cover"/>
                                              </div>
                                              <div>
                                                  <p className={`font-medium ${account.id === currentUser.id ? 'text-teal-green' : 'text-text-primary'}`}>
                                                      {account.name}
                                                  </p>
                                                  <p className="text-xs text-text-secondary font-mono flex items-center gap-1">
                                                      {account.key}
                                                      {account.pin && <Lock size={10} className="text-teal-green"/>}
                                                  </p>
                                              </div>
                                          </div>
                                          {account.id === currentUser.id && (
                                              <div className="bg-teal-green rounded-full p-1">
                                                  <Check size={14} className="text-black"/>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>

                              <div className="flex gap-2">
                                  <button 
                                    onClick={() => setAccountAction('create')}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-gray-600 rounded-lg text-text-secondary hover:text-teal-green hover:border-teal-green transition-colors text-sm"
                                  >
                                      <PlusCircle size={18} /> New Account
                                  </button>
                                  <button 
                                    onClick={() => setAccountAction('login')}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-gray-600 rounded-lg text-text-secondary hover:text-teal-green hover:border-teal-green transition-colors text-sm"
                                  >
                                      <LogIn size={18} /> Login Existing
                                  </button>
                              </div>
                          </>
                      )}

                      {/* VERIFY PIN VIEW */}
                      {accountAction === 'verify' && (
                          <div className="space-y-4">
                              <p className="text-sm text-center text-text-secondary">Enter PIN to access this account</p>
                              <input 
                                  type="password" 
                                  maxLength={4}
                                  value={verifyPin}
                                  onChange={(e) => setVerifyPin(e.target.value)}
                                  className="w-full text-center text-2xl tracking-widest bg-black/20 border-b-2 border-teal-green py-2 text-white focus:outline-none font-mono"
                                  autoFocus
                              />
                              {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}
                              <button onClick={submitVerifyPin} className="w-full bg-teal-green text-black font-bold py-2 rounded-lg">Access Account</button>
                          </div>
                      )}

                      {/* CREATE NEW VIEW */}
                      {accountAction === 'create' && (
                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs text-teal-green font-bold">Account Name</label>
                                  <input 
                                      value={newAccountName}
                                      onChange={(e) => setNewAccountName(e.target.value)}
                                      className="w-full bg-conversation-panel border border-gray-700 rounded p-2 text-white focus:border-teal-green outline-none"
                                      placeholder="My Second Account"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-teal-green font-bold">Set PIN (4 digits)</label>
                                  <input 
                                      type="password"
                                      maxLength={4}
                                      value={newAccountPin}
                                      onChange={(e) => setNewAccountPin(e.target.value)}
                                      className="w-full bg-conversation-panel border border-gray-700 rounded p-2 text-white focus:border-teal-green outline-none font-mono tracking-widest"
                                      placeholder="0000"
                                  />
                                  <p className="text-[10px] text-text-secondary mt-1">Used to switch back to this account later.</p>
                              </div>
                              {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}
                              <button onClick={submitCreateAccount} className="w-full bg-teal-green text-black font-bold py-2 rounded-lg">Create</button>
                          </div>
                      )}

                      {/* LOGIN EXISTING VIEW */}
                      {accountAction === 'login' && (
                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs text-teal-green font-bold">User Key (ff-xxxxx)</label>
                                  <input 
                                      value={loginKey}
                                      onChange={(e) => setLoginKey(e.target.value)}
                                      className="w-full bg-conversation-panel border border-gray-700 rounded p-2 text-white focus:border-teal-green outline-none font-mono"
                                      placeholder="ff-a1b2c"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-teal-green font-bold">Account PIN</label>
                                  <input 
                                      type="password"
                                      maxLength={4}
                                      value={loginPin}
                                      onChange={(e) => setLoginPin(e.target.value)}
                                      className="w-full bg-conversation-panel border border-gray-700 rounded p-2 text-white focus:border-teal-green outline-none font-mono tracking-widest"
                                      placeholder="0000"
                                  />
                              </div>
                              {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}
                              <button onClick={submitLoginAccount} className="w-full bg-teal-green text-black font-bold py-2 rounded-lg">Verify & Login</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* LINKED DEVICES MODAL */}
      {isDevicesOpen && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-panel-header rounded-xl w-full max-w-sm shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-conversation-panel">
                      <h3 className="text-text-primary font-medium text-lg">Linked Devices</h3>
                      <button onClick={() => setIsDevicesOpen(false)} className="text-text-secondary hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="p-4 bg-conversation-panel">
                      <div className="flex flex-col items-center py-6 border-b border-gray-700 mb-4">
                           <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                               <Laptop size={48} className="text-teal-green" />
                           </div>
                           <p className="text-sm text-text-secondary text-center">
                               Use Talk Flow on other devices.<br/>
                               You can log out of sessions remotely.
                           </p>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto">
                           {sessions.map(session => (
                               <div key={session.sessionId} className="flex items-center justify-between p-3 hover:bg-gray-800 rounded-lg transition-colors">
                                   <div className="flex items-center gap-3">
                                       <div className="bg-teal-green/10 p-2 rounded-full">
                                            {session.isCurrent ? <Smartphone size={20} className="text-teal-green"/> : <Globe size={20} className="text-icon-gray"/>}
                                       </div>
                                       <div>
                                           <p className="text-text-primary text-sm font-medium">
                                               {session.deviceName}
                                               {session.isCurrent && <span className="text-teal-green text-xs ml-2">(This Device)</span>}
                                           </p>
                                           <p className="text-text-secondary text-xs">
                                               Last active: {session.lastActive ? new Date(session.lastActive).toLocaleTimeString() : 'Unknown'}
                                           </p>
                                       </div>
                                   </div>
                                   {!session.isCurrent && (
                                       <button 
                                          onClick={() => handleRevokeSession(session.sessionId)}
                                          className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg text-xs font-medium"
                                       >
                                           Log Out
                                       </button>
                                   )}
                               </div>
                           ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-panel-header rounded-xl w-full max-w-sm shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200 h-[80%] flex flex-col">
                  <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-conversation-panel shrink-0">
                      <h3 className="text-text-primary font-medium text-lg">Settings</h3>
                      <button onClick={() => setIsSettingsOpen(false)} className="text-text-secondary hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                      
                      {/* Account Section */}
                      <div className="flex items-center gap-4 pb-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 p-2 rounded-lg transition-colors" onClick={() => setIsProfileOpen(true)}>
                          <div className="w-14 h-14 rounded-full overflow-hidden">
                              <img src={currentUser.avatar} alt="Profile" className="w-full h-full object-cover"/>
                          </div>
                          <div className="flex-1">
                              <h4 className="text-text-primary font-medium text-lg">{currentUser.name}</h4>
                              <p className="text-text-secondary text-sm">Online</p>
                          </div>
                          <Settings size={20} className="text-icon-gray"/>
                      </div>

                      {/* Notifications */}
                      <div>
                          <h4 className="text-teal-green text-xs font-bold uppercase mb-2 ml-2">Notifications</h4>
                          <div className="space-y-1">
                              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50">
                                  <div className="flex items-center gap-3">
                                      <Bell size={20} className="text-icon-gray"/>
                                      <div>
                                          <p className="text-text-primary text-sm">Message Sounds</p>
                                          <p className="text-text-secondary text-xs">Play sound for incoming messages</p>
                                      </div>
                                  </div>
                                  <button onClick={() => toggleSetting('sound')} className={`w-10 h-5 rounded-full relative transition-colors ${appSettings.sound ? 'bg-teal-green' : 'bg-gray-600'}`}>
                                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${appSettings.sound ? 'left-5.5' : 'left-0.5'}`}></div>
                                  </button>
                              </div>
                          </div>
                      </div>

                      {/* Privacy */}
                      <div>
                          <h4 className="text-teal-green text-xs font-bold uppercase mb-2 ml-2">Privacy & Security</h4>
                          <div className="space-y-1">
                              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50">
                                  <div className="flex items-center gap-3">
                                      <Shield size={20} className="text-icon-gray"/>
                                      <div>
                                          <p className="text-text-primary text-sm">Read Receipts</p>
                                          <p className="text-text-secondary text-xs">If turned off, you won't send or receive Read receipts.</p>
                                      </div>
                                  </div>
                                  <button onClick={() => toggleSetting('readReceipts')} className={`w-10 h-5 rounded-full relative transition-colors ${appSettings.readReceipts ? 'bg-teal-green' : 'bg-gray-600'}`}>
                                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${appSettings.readReceipts ? 'left-5.5' : 'left-0.5'}`}></div>
                                  </button>
                              </div>
                              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 cursor-pointer" onClick={() => setIsBlockedUsersOpen(true)}>
                                  <div className="flex items-center gap-3">
                                      <Ban size={20} className="text-icon-gray"/>
                                      <p className="text-text-primary text-sm">Blocked Contacts</p>
                                  </div>
                                  <ChevronRight size={16} className="text-icon-gray"/>
                              </div>
                              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 cursor-pointer" onClick={() => setIsDevicesOpen(true)}>
                                  <div className="flex items-center gap-3">
                                      <Laptop size={20} className="text-icon-gray"/>
                                      <p className="text-text-primary text-sm">Linked Devices</p>
                                  </div>
                                  <ChevronRight size={16} className="text-icon-gray"/>
                              </div>
                          </div>
                      </div>

                      {/* Appearance */}
                      <div>
                          <h4 className="text-teal-green text-xs font-bold uppercase mb-2 ml-2">Appearance</h4>
                          <div className="space-y-1">
                              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50">
                                  <div className="flex items-center gap-3">
                                      <Moon size={20} className="text-icon-gray"/>
                                      <div>
                                          <p className="text-text-primary text-sm">Compact View</p>
                                          <p className="text-text-secondary text-xs">Show more contacts at once</p>
                                      </div>
                                  </div>
                                  <button onClick={() => toggleSetting('compactView')} className={`w-10 h-5 rounded-full relative transition-colors ${appSettings.compactView ? 'bg-teal-green' : 'bg-gray-600'}`}>
                                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${appSettings.compactView ? 'left-5.5' : 'left-0.5'}`}></div>
                                  </button>
                              </div>
                          </div>
                      </div>

                      {/* Help */}
                      <div>
                          <h4 className="text-teal-green text-xs font-bold uppercase mb-2 ml-2">Help</h4>
                          <div className="space-y-1">
                              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 cursor-pointer" onClick={() => alert("Talk Flow v1.0\nCreated with Google Gemini API")}>
                                  <div className="flex items-center gap-3">
                                      <HelpCircle size={20} className="text-icon-gray"/>
                                      <p className="text-text-primary text-sm">App Info</p>
                                  </div>
                              </div>
                          </div>
                      </div>

                  </div>
              </div>
          </div>
      )}

      {/* Blocked Users Modal */}
      {isBlockedUsersOpen && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-panel-header rounded-xl w-full max-w-sm shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-conversation-panel">
                      <h3 className="text-text-primary font-medium text-lg">Blocked Users</h3>
                      <button onClick={() => setIsBlockedUsersOpen(false)} className="text-text-secondary hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-4 max-h-96 overflow-y-auto">
                      {blockedContacts.length === 0 ? (
                          <div className="text-center text-text-secondary text-sm py-4">
                              You haven't blocked anyone yet.
                          </div>
                      ) : (
                          blockedContacts.map(c => (
                              <div key={c.id} className="flex items-center justify-between p-3 border-b border-gray-800 last:border-0 hover:bg-gray-800 rounded-lg">
                                  <div className="flex items-center">
                                      <div className="w-8 h-8 rounded-full overflow-hidden mr-3">
                                          <img src={c.avatar} alt={c.name} className="w-full h-full object-cover grayscale" />
                                      </div>
                                      <span className="text-text-primary text-sm font-medium">{c.name}</span>
                                  </div>
                                  <button 
                                    onClick={() => handleUnblock(c.id)}
                                    className="bg-gray-700 hover:bg-gray-600 text-text-primary text-xs px-3 py-1.5 rounded flex items-center gap-1"
                                  >
                                      <Unlock size={12} /> Unblock
                                  </button>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* New Group Modal */}
      {isNewGroupOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel-header rounded-xl w-full max-w-sm shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-conversation-panel">
               <h3 className="text-text-primary font-medium text-lg">New Group</h3>
               <button onClick={() => setIsNewGroupOpen(false)} className="text-text-secondary hover:text-white"><X size={20}/></button>
             </div>
             <form onSubmit={handleCreateGroup} className="p-6">
                <div className="mb-4">
                    <label className="block text-teal-green text-xs uppercase font-bold mb-2">Group Subject</label>
                    <input 
                       value={groupName}
                       onChange={(e) => setGroupName(e.target.value)}
                       placeholder="Type group subject here..."
                       className="w-full bg-conversation-panel border border-gray-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-teal-green"
                       maxLength={25}
                       autoFocus
                    />
                </div>
                
                <div className="mb-4">
                    <label className="block text-teal-green text-xs uppercase font-bold mb-2">Participants: {selectedGroupMembers.size}</label>
                    <div className="bg-conversation-panel border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                        {eligibleGroupContacts.length === 0 ? (
                            <div className="p-4 text-center text-text-secondary text-xs">
                                No contacts available. Add Real People first!
                            </div>
                        ) : (
                            eligibleGroupContacts.map(c => (
                                <div 
                                    key={c.targetUserId} 
                                    className="flex items-center p-3 border-b border-gray-800 last:border-0 cursor-pointer hover:bg-gray-800"
                                    onClick={() => c.targetUserId && toggleGroupMember(c.targetUserId)}
                                >
                                    <div className={`w-5 h-5 border-2 rounded mr-3 flex items-center justify-center ${selectedGroupMembers.has(c.targetUserId!) ? 'bg-teal-green border-teal-green' : 'border-gray-500'}`}>
                                        {selectedGroupMembers.has(c.targetUserId!) && <Check size={14} className="text-black"/>}
                                    </div>
                                    <img src={c.avatar} className="w-8 h-8 rounded-full mr-2"/>
                                    <span className="text-text-primary text-sm">{c.name}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {errorMsg && <div className="text-red-400 text-xs mb-3 text-center">{errorMsg}</div>}

                <button 
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-teal-green hover:bg-teal-600 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={20} /> Create Group
                </button>
             </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {isProfileOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-panel-header rounded-xl w-full max-w-sm shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-conversation-panel">
                      <h3 className="text-text-primary font-medium text-lg">My Profile</h3>
                      <button onClick={() => setIsProfileOpen(false)} className="text-text-secondary hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 flex flex-col items-center gap-4">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-teal-green">
                          <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover"/>
                      </div>
                      
                      <div className="w-full space-y-4">
                          <div>
                              <label className="text-teal-green text-xs font-bold uppercase">Display Name</label>
                              <input 
                                  value={myDisplayName}
                                  onChange={(e) => setMyDisplayName(e.target.value)}
                                  className="w-full bg-transparent border-b border-gray-600 py-1 text-text-primary focus:outline-none focus:border-teal-green"
                              />
                          </div>
                          
                          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                              <label className="text-teal-green text-xs font-bold uppercase block mb-2">My Share Key</label>
                              <div className="flex items-center gap-2">
                                  <code className="bg-black/30 px-3 py-2 rounded text-blue-300 font-mono text-lg flex-1 text-center select-all">
                                      {currentUser.key}
                                  </code>
                                  <button 
                                    onClick={handleCopyKey}
                                    className="p-2 bg-teal-green rounded hover:bg-teal-600 transition-colors"
                                  >
                                      {copied ? <Check size={18} className="text-black"/> : <Copy size={18} className="text-black"/>}
                                  </button>
                              </div>
                          </div>

                          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 relative overflow-hidden">
                              <label className="text-teal-green text-xs font-bold uppercase block mb-2">Security PIN</label>
                              <div className="flex items-center gap-2">
                                  <code className="bg-black/30 px-3 py-2 rounded text-white font-mono text-lg flex-1 text-center tracking-widest">
                                      {displayPin}
                                  </code>
                                  <button 
                                    onClick={handleRegeneratePin}
                                    className="p-2 bg-gray-600 rounded hover:bg-teal-600 transition-colors text-xs"
                                    title="Regenerate Random PIN"
                                  >
                                      <RefreshCw size={18} className="text-white"/>
                                  </button>
                              </div>
                              <p className="text-[10px] text-text-secondary mt-1 text-center">Randomize this to secure your account.</p>
                              
                              {/* SUCCESS OVERLAY */}
                              {pinGenerated && (
                                <div className="absolute inset-0 bg-teal-green/90 flex items-center justify-center animate-in fade-in duration-200">
                                    <div className="flex items-center gap-2 text-black font-bold">
                                        <Check size={20} /> New PIN Set!
                                    </div>
                                </div>
                              )}
                          </div>
                      </div>
                      
                      <button onClick={handleSaveProfile} className="w-full bg-teal-green text-black font-bold py-2 rounded-lg mt-2">
                          Save & Update
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* New Chat Modal */}
      {isNewChatOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel-header rounded-xl w-full max-w-sm shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-conversation-panel">
              <h3 className="text-text-primary font-medium text-lg">New Chat</h3>
              <button 
                onClick={() => setIsNewChatOpen(false)}
                className="text-text-secondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateContact} className="p-6 space-y-4">
              
              {/* Type Toggle */}
              <div className="flex p-1 bg-conversation-panel rounded-lg border border-gray-700">
                <button
                    type="button"
                    onClick={() => setContactType('ai')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${
                        contactType === 'ai' 
                        ? 'bg-teal-green text-black shadow-sm' 
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <Bot size={16} /> AI Persona
                </button>
                <button
                    type="button"
                    onClick={() => setContactType('real')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${
                        contactType === 'real' 
                        ? 'bg-teal-green text-black shadow-sm' 
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <UserIcon size={16} /> Real Person
                </button>
              </div>

              {contactType === 'ai' ? (
                  <>
                    <div>
                        <label className="block text-teal-green text-xs uppercase font-bold mb-2">Name</label>
                        <input 
                        type="text"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="e.g. Yoda, Jarvis"
                        className="w-full bg-conversation-panel border border-gray-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-teal-green transition-colors"
                        autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-teal-green text-xs uppercase font-bold mb-2">Persona Instruction</label>
                        <textarea 
                        value={newContactInstruction}
                        onChange={(e) => setNewContactInstruction(e.target.value)}
                        placeholder="Describe how this AI should behave..."
                        className="w-full bg-conversation-panel border border-gray-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-teal-green transition-colors h-24 resize-none"
                        />
                    </div>
                  </>
              ) : (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-teal-green text-xs uppercase font-bold mb-2">User Key (ff-xxxxx)</label>
                      <div className="relative">
                          <input 
                            type="text"
                            value={targetUserKey}
                            onChange={(e) => setTargetUserKey(e.target.value)}
                            placeholder="Enter friend's key"
                            className="w-full bg-conversation-panel border border-gray-700 rounded-lg pl-4 pr-10 py-3 text-text-primary focus:outline-none focus:border-teal-green transition-colors font-mono"
                            autoFocus
                          />
                          <div className="absolute right-3 top-3 text-icon-gray">
                              <Search size={20} />
                          </div>
                      </div>
                      <p className="text-[10px] text-text-secondary mt-2">
                          Ask your friend for their Key found in their profile.
                      </p>
                  </div>
              )}

              {errorMsg && (
                  <div className="p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-200 text-center">
                      {errorMsg}
                  </div>
              )}
              
              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-teal-green hover:bg-teal-600 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Adding...' : (
                    <>
                      <Plus size={20} /> {contactType === 'ai' ? 'Create AI Chat' : 'Add Contact'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
