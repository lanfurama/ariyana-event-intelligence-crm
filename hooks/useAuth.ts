import { useState } from 'react';
import type { User } from '../types';

const USER_KEY = 'ariyana_user';
const TOKEN_KEY = 'ariyana_token';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      const savedToken = localStorage.getItem(TOKEN_KEY);
      // Both must exist — a user without a token cannot call the API anyway.
      if (savedUser && savedToken) {
        return JSON.parse(savedUser);
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
    }
    return null;
  });

  const login = (u: User, token: string) => {
    setUser(u);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      localStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving session to localStorage:', error);
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('ariyana_activeTab');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Error updating user in localStorage:', error);
    }
  };

  return { user, login, logout, updateUser };
};
