import { useState } from 'react';
import type React from 'react';
import { ChevronRight, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react';
import type { User } from '../types';
import { authApi } from '../services/apiService';

export const LoginView = ({ onLogin }: { onLogin: (user: User, token: string) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { token, user } = await authApi.login(username.trim(), password);
      onLogin(user, token);
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Failed to log in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-slate-200">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-500/20 blur-2xl"
            aria-hidden="true"
          ></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg mb-3">
              <Mail size={26} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
              Ariyana <span className="text-brand-400">Mail</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium">Email Marketing Suite</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="Your username"
                className="w-full p-3.5 pl-11 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none bg-white text-slate-900 font-medium"
              />
              <UserIcon className="absolute left-3.5 top-4 text-slate-400" size={18} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Your password"
                className="w-full p-3.5 pl-11 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none bg-white text-slate-900 font-medium"
              />
              <Lock className="absolute left-3.5 top-4 text-slate-400" size={18} />
            </div>
          </div>

          <button
            type="submit"
            disabled={!username.trim() || !password || submitting}
            className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg shadow-brand-500/30 flex justify-center items-center transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign In <ChevronRight size={18} className="ml-2" />
              </>
            )}
          </button>

          <div className="text-center text-xs text-slate-500 mt-4 font-medium">
            🔒 Access is restricted to authorized personnel only.
          </div>
        </form>
      </div>
    </div>
  );
};
