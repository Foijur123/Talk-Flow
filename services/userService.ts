import { v4 as uuidv4 } from 'uuid';
import { User } from '../types';

const STORAGE_KEY = 'talkflow_user_identity'; // Legacy key (will migrate from this)
const ACCOUNTS_KEY = 'talkflow_accounts';     // New key for array of users
const ACTIVE_ACCOUNT_KEY = 'talkflow_active_id'; // Key for current active user ID

// Helper to generate a new user object
const generateUser = (name?: string, pin?: string): User => {
  const newId = uuidv4();
  const randomKey = Math.floor(Math.random() * 0xfffff).toString(16).padStart(5, '0');
  const userKey = `ff-${randomKey}`;
  
  return {
    id: newId,
    name: name || 'User ' + randomKey,
    avatar: `https://picsum.photos/seed/${newId}/200/200`,
    isSelf: true,
    key: userKey,
    pin: pin
  };
};

export const getOrCreateUserIdentity = (): User => {
  // 1. Check for new multi-account storage
  const accountsJson = localStorage.getItem(ACCOUNTS_KEY);
  const activeId = localStorage.getItem(ACTIVE_ACCOUNT_KEY);

  if (accountsJson) {
    const accounts: User[] = JSON.parse(accountsJson);
    if (accounts.length > 0) {
      // Find active, or default to first
      const activeUser = accounts.find(u => u.id === activeId) || accounts[0];
      // Ensure we save the active ID if it was missing
      if (!activeId) localStorage.setItem(ACTIVE_ACCOUNT_KEY, activeUser.id);
      return activeUser;
    }
  }

  // 2. Migration: Check for legacy single-user storage
  const legacyStored = localStorage.getItem(STORAGE_KEY);
  if (legacyStored) {
    const legacyUser: User = JSON.parse(legacyStored);
    // Migrate to new structure
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([legacyUser]));
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, legacyUser.id);
    localStorage.removeItem(STORAGE_KEY); // Cleanup
    return legacyUser;
  }

  // 3. No data exists at all -> Create first account
  const newUser = generateUser();
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([newUser]));
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, newUser.id);
  return newUser;
};

export const getAvailableAccounts = (): User[] => {
  const accountsJson = localStorage.getItem(ACCOUNTS_KEY);
  return accountsJson ? JSON.parse(accountsJson) : [];
};

export const createNewAccount = (name: string, pin: string): User => {
  const newUser = generateUser(name, pin);
  const accounts = getAvailableAccounts();
  
  // Add to list
  accounts.push(newUser);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  
  // Set as active
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, newUser.id);
  
  return newUser;
};

export const addExistingAccount = (user: User) => {
    const accounts = getAvailableAccounts();
    // Check if already exists
    if (!accounts.find(u => u.id === user.id)) {
        accounts.push(user);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, user.id);
};

export const switchAccount = (userId: string) => {
  const accounts = getAvailableAccounts();
  const targetUser = accounts.find(u => u.id === userId);
  
  if (targetUser) {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, targetUser.id);
    // Reload page to refresh Firebase listeners and App state cleanly
    window.location.reload();
  }
};

export const updateUserProfile = (updatedUser: User) => {
  const accounts = getAvailableAccounts();
  const index = accounts.findIndex(u => u.id === updatedUser.id);
  
  if (index !== -1) {
    accounts[index] = updatedUser;
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
};