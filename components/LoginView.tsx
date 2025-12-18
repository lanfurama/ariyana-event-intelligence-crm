import React, { useState, useEffect } from 'react';
import { Users, ChevronRight, Loader2, X } from 'lucide-react';
import { User } from '../types';
import { usersApi } from '../services/apiService';
import { USERS } from '../constants';

export const LoginView = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(true);

  useEffect(() => {
    // Fetch users from API
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const fetchedUsers = await usersApi.getAll();
        setUsers(fetchedUsers);
        if (fetchedUsers.length > 0) {
          setSelectedUser(fetchedUsers[0].username);
        }
      } catch (err: any) {
        console.error('Error fetching users:', err);
        // Only show warning in UI if it's an API connection error
        if (err.message && err.message.includes('Cannot connect to API')) {
          setError(err.message);
          // Log to console for debugging
          console.warn('⚠️ Backend API not available. Using local data.');
        } else {
          setError(err.message || 'Failed to load users');
        }
        // Fallback to constants if API fails
        setUsers(USERS);
        if (USERS.length > 0) {
          setSelectedUser(USERS[0].username);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleLogin = async () => {
    if (!selectedUser) return;
    
    try {
      const user = await usersApi.getByUsername(selectedUser);
      if (user) {
        onLogin(user);
      } else {
        // Fallback: try to find in local users array
        const localUser = users.find(u => u.username === selectedUser);
        if (localUser) {
          onLogin(localUser);
        } else {
          setError('User not found');
        }
      }
    } catch (err: any) {
      console.error('Error logging in:', err);
      // Fallback: try to find in local users array
      const localUser = users.find(u => u.username === selectedUser);
      if (localUser) {
        onLogin(localUser);
      } else {
        setError(err.message || 'Failed to login');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden p-8 text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-600" size={32} />
          <p className="text-slate-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-slate-200">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-white mb-1.5 tracking-tight">Ariyana CRM</h1>
            <p className="text-blue-50 text-sm font-medium">Event Intelligence System</p>
          </div>
        </div>
        <div className="p-6 space-y-5 bg-white">
          {error && error.includes('Cannot connect to API') && showWarning && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm space-y-2 relative">
              <button
                onClick={() => setShowWarning(false)}
                className="absolute top-2 right-2 text-yellow-600 hover:text-yellow-800"
                aria-label="Close warning"
              >
                <X size={16} />
              </button>
              <p className="font-semibold">⚠️ Warning:</p>
              <p>{error}</p>
              <div className="text-xs mt-2 text-yellow-700 space-y-1">
                {import.meta.env.DEV ? (
                  <p>
                    Make sure the backend API is running: <code className="bg-yellow-100 px-1 rounded">npm run dev:api</code>
                    <br />
                    <span className="text-yellow-600 italic">(App is using local data. You can dismiss this warning.)</span>
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p>In production, please check:</p>
                    <ul className="list-disc list-inside ml-2 space-y-0.5">
                      <li>Backend API is deployed and accessible at <code className="bg-yellow-100 px-1 rounded">/api/v1</code></li>
                      <li>API routes are properly configured in Vercel</li>
                      <li>Database connection is working</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          {error && !error.includes('Cannot connect to API') && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              <p className="font-semibold">❌ Error:</p>
              <p>{error}</p>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Select User Role</label>
            <div className="relative">
              <select 
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-3.5 pl-11 border-2 border-slate-200 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-slate-900 font-medium transition-all hover:border-slate-300"
                disabled={users.length === 0}
              >
                {users.map(u => (
                  <option key={u.username} value={u.username}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
              <Users className="absolute left-3.5 top-4 text-slate-400" size={18} />
            </div>
          </div>
          
          <button 
            onClick={handleLogin}
            disabled={!selectedUser || users.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 flex justify-center items-center transform hover:scale-[1.02] disabled:transform-none"
          >
            Sign In <ChevronRight size={18} className="ml-2" />
          </button>
          
          <div className="text-center text-xs text-slate-500 mt-4 font-medium">
             🔒 Access is restricted to authorized personnel only.
          </div>
        </div>
      </div>
    </div>
  );
};






