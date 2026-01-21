import { useState, useEffect } from 'react';
import { User } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const savedUser = localStorage.getItem('ariyana_user');
            if (savedUser) {
                return JSON.parse(savedUser);
            }
        } catch (error) {
            console.error('Error loading user from localStorage:', error);
        }
        return null;
    });

    const login = (u: User) => {
        setUser(u);
        try {
            localStorage.setItem('ariyana_user', JSON.stringify(u));
        } catch (error) {
            console.error('Error saving user to localStorage:', error);
        }
    };

    const logout = () => {
        setUser(null);
        try {
            localStorage.removeItem('ariyana_user');
            localStorage.removeItem('ariyana_activeTab');
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    };

    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
        try {
            localStorage.setItem('ariyana_user', JSON.stringify(updatedUser));
        } catch (error) {
            console.error('Error updating user in localStorage:', error);
        }
    };

    return { user, login, logout, updateUser };
};
