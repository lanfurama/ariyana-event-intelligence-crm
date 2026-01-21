import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import { User, ChatMessage } from '../types';
import { chatMessagesApi } from '../services/apiService';
import * as GPTService from '../services/gptService';
import { extractRetryDelay, isRateLimitError } from '../services/gptService';
import { formatMarkdown } from '../utils/markdownUtils';

export const ChatAssistant = ({ user }: { user: User }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Load messages from database when component mounts
  useEffect(() => {
    const loadMessages = async () => {
      if (!user) return;

      try {
        setMessagesLoading(true);
        console.log('📥 Loading chat messages for user:', user.username);
        const dbMessages = await chatMessagesApi.getByUsername(user.username);
        console.log('📥 Loaded', dbMessages.length, 'messages from database');

        // Map database format to frontend format
        const mappedMessages: ChatMessage[] = dbMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          text: msg.text,
          timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp,
        }));

        // If no messages exist, add the welcome message
        if (mappedMessages.length === 0) {
          const welcomeMsg: ChatMessage = {
            id: '1',
            role: 'assistant',
            text: 'Hello! I am your Ariyana Sales Assistant. How can I help you analyze the market today?',
            timestamp: new Date()
          };
          setMessages([welcomeMsg]);
          // Save welcome message to database
          try {
            console.log('💾 Saving welcome message to database:', {
              id: welcomeMsg.id,
              username: user.username,
              timestamp: welcomeMsg.timestamp
            });
            const saved = await chatMessagesApi.create({
              id: welcomeMsg.id,
              username: user.username,
              role: welcomeMsg.role,
              text: welcomeMsg.text,
              timestamp: welcomeMsg.timestamp instanceof Date ? welcomeMsg.timestamp.toISOString() : welcomeMsg.timestamp,
            });
            console.log('✅ Welcome message saved successfully:', saved.id);
          } catch (error: any) {
            console.error('❌ Error saving welcome message:', error);
            console.error('Error details:', error.message, error.stack);
            // Don't show alert for welcome message
          }
        } else {
          setMessages(mappedMessages);
        }
      } catch (error: any) {
        console.error('❌ Error loading chat messages:', error);
        console.error('Error details:', error.message, error.stack);
        // Fallback to welcome message if API fails
        console.log('⚠️ Falling back to local welcome message');
        const welcomeMsg: ChatMessage = {
          id: '1',
          role: 'assistant',
          text: 'Hello! I am your Ariyana Sales Assistant. How can I help you analyze the market today?',
          timestamp: new Date()
        };
        setMessages([welcomeMsg]);
      } finally {
        setMessagesLoading(false);
      }
    };

    loadMessages();
  }, [user]);

  // Countdown effect for rate limit
  useEffect(() => {
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0) {
      setRateLimitCountdown(null);
    }
  }, [rateLimitCountdown]);

  const handleSend = async () => {
    if (!input.trim() || (rateLimitCountdown !== null && rateLimitCountdown > 0) || !user) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true);
    setRateLimitCountdown(null);

    // Save user message to database
    try {
      console.log('💾 Saving user message to database:', {
        id: userMsg.id,
        username: user.username,
        role: userMsg.role,
        text: userMsg.text.substring(0, 50),
        timestamp: userMsg.timestamp
      });
      const saved = await chatMessagesApi.create({
        id: userMsg.id,
        username: user.username,
        role: userMsg.role,
        text: userMsg.text,
        timestamp: userMsg.timestamp instanceof Date ? userMsg.timestamp.toISOString() : userMsg.timestamp,
      });
      console.log('✅ User message saved successfully:', saved.id);
    } catch (error: any) {
      console.error('❌ Error saving user message:', error);
      console.error('Error details:', error.message, error.stack);
      // Show error to user but don't block the chat
      alert(`Warning: Could not save message to database. ${error.message || 'Please check console for details.'}`);
    }

    try {
      // Prepare history for API (GPT format)
      const history = messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role, // Convert 'model' to 'assistant' for GPT
        content: m.text
      }));

      const responseText = await GPTService.sendChatMessage(history, currentInput);

      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', text: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);

      // Save bot message to database
      try {
        console.log('💾 Saving bot message to database:', {
          id: botMsg.id,
          username: user.username,
          role: botMsg.role,
          text: botMsg.text.substring(0, 50),
          timestamp: botMsg.timestamp
        });
        const saved = await chatMessagesApi.create({
          id: botMsg.id,
          username: user.username,
          role: botMsg.role,
          text: botMsg.text,
          timestamp: botMsg.timestamp instanceof Date ? botMsg.timestamp.toISOString() : botMsg.timestamp,
        });
        console.log('✅ Bot message saved successfully:', saved.id);
      } catch (error: any) {
        console.error('❌ Error saving bot message:', error);
        console.error('Error details:', error.message, error.stack);
        // Don't show alert for bot messages to avoid spam
      }
    } catch (e: any) {
      console.error('❌ Error in handleSend:', e);
      console.error('Error details:', {
        message: e.message,
        name: e.name,
        stack: e.stack,
        code: e.code,
      });

      if (isRateLimitError(e)) {
        const retryDelay = extractRetryDelay(e);
        if (retryDelay) {
          setRateLimitCountdown(retryDelay);
        }
        const errorMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          text: `Rate limit exceeded. Please wait ${retryDelay || 'a moment'} seconds before trying again.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMsg]);

        // Save error message to database
        try {
          await chatMessagesApi.create({
            id: errorMsg.id,
            username: user.username,
            role: errorMsg.role,
            text: errorMsg.text,
            timestamp: errorMsg.timestamp,
          });
        } catch (error) {
          console.error('Error saving error message:', error);
        }
      } else {
        // Check for specific error types
        let errorText = "I'm having trouble connecting right now. Please try again.";

        // Check if API key is missing
        if (e.message && (e.message.includes('API Key not found') || e.message.includes('OPENAI_API_KEY'))) {
          errorText = "⚠️ OpenAI API Key is not configured. Please set OPENAI_API_KEY in your .env file.";
        }
        // Check for network errors
        else if (e.message && (e.message.includes('fetch failed') || e.message.includes('network') || e.message.includes('Failed to fetch'))) {
          errorText = "🌐 Network error. Please check your internet connection and try again.";
        }
        // Check for API errors
        else if (e.message && (e.message.includes('401') || e.message.includes('Unauthorized'))) {
          errorText = "🔑 Invalid API Key. Please check your OPENAI_API_KEY in .env file.";
        }
        // Check for API quota errors
        else if (e.message && (e.message.includes('quota') || e.message.includes('429'))) {
          errorText = "⏱️ API quota exceeded. Please try again later.";
        }
        // Show detailed error in development
        else if (import.meta.env.DEV && e.message) {
          errorText = `❌ Error: ${e.message.substring(0, 200)}`;
        }

        const errorMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          text: errorText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMsg]);

        // Save error message to database
        try {
          await chatMessagesApi.create({
            id: errorMsg.id,
            username: user.username,
            role: errorMsg.role,
            text: errorMsg.text,
            timestamp: errorMsg.timestamp,
          });
        } catch (error) {
          console.error('Error saving error message:', error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 flex items-center">
          <Bot className="mr-2 text-blue-600" /> AI Sales Assistant
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="flex items-center space-x-2 text-slate-500">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading chat history...</span>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-lg shadow-sm text-sm ${msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
                }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    {formatMarkdown(msg.text)}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-lg border border-slate-200 rounded-bl-none flex items-center space-x-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
        <div className="p-4 bg-yellow-50 border-t border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-800">Rate Limit Exceeded</p>
              <p className="text-xs text-yellow-700 mt-1">Please wait before sending another message</p>
            </div>
            <div className="text-xl font-bold text-yellow-600">
              {Math.floor(rateLimitCountdown / 60)}:{(rateLimitCountdown % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex items-center space-x-2">
          <input
            className="flex-1 p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            placeholder={rateLimitCountdown !== null && rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s...` : "Ask about leads, email templates, or market trends..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={rateLimitCountdown !== null && rateLimitCountdown > 0}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
