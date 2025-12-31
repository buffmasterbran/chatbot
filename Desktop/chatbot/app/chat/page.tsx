'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, LogOut, Loader2, Search, X } from 'lucide-react';
import { parseMarkdownLinks } from '@/lib/markdown-links';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const MAX_DISPLAYED_MESSAGES = 50; // Limit displayed messages to last 50

  useEffect(() => {
    checkAuth();
  }, []);

  // Load or create thread on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadOrCreateThread();
    }
  }, [isAuthenticated]);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0 && currentThreadId) {
      localStorage.setItem('chat_messages', JSON.stringify(messages));
      localStorage.setItem('chat_thread_id', currentThreadId);
    }
  }, [messages, currentThreadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const loadOrCreateThread = async () => {
    try {
      // Try to load from localStorage first
      const savedMessages = localStorage.getItem('chat_messages');
      const savedThreadId = localStorage.getItem('chat_thread_id');
      
      if (savedMessages && savedThreadId) {
        try {
          // Verify thread still exists and load messages
          const response = await fetch(`/api/chat/threads/${savedThreadId}`);
          if (response.ok) {
            const data = await response.json();
            const loadedMessages: Message[] = data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.created_at),
            }));
            setMessages(loadedMessages);
            setCurrentThreadId(savedThreadId);
            setIsLoadingThread(false);
            return;
          }
        } catch (error) {
          // Thread doesn't exist, create new one
        }
      }

      // Create new thread
      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentThreadId(data.thread.id);
        localStorage.setItem('chat_thread_id', data.thread.id);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading thread:', error);
    } finally {
      setIsLoadingThread(false);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!currentThreadId) return;

    try {
      await fetch(`/api/chat/threads/${currentThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
    } catch (error) {
      console.error('Error saving message:', error);
      // Don't fail the UI if save fails
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearChat = () => {
    if (confirm('Are you sure you want to clear all chat messages? This cannot be undone.')) {
      setMessages([]);
      localStorage.removeItem('chat_messages');
      setCurrentThreadId(null);
      localStorage.removeItem('chat_thread_id');
    }
  };

  const filteredMessages = messages.filter(message => {
    if (!searchQuery.trim()) return true;
    return message.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const displayedMessages = filteredMessages.length > MAX_DISPLAYED_MESSAGES
    ? filteredMessages.slice(-MAX_DISPLAYED_MESSAGES)
    : filteredMessages;

  const hiddenMessageCount = filteredMessages.length - displayedMessages.length;

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/check');
      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingMessage('');

    // Save user message to database
    await saveMessage('user', userMessage.content);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Check if it's a JSON response (admin queue case)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        // Save assistant message to database
        await saveMessage('assistant', data.message);
        setLoading(false);
        return;
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullContent += chunk;
          setStreamingMessage(fullContent);
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessage('');

      // Save assistant message to database
      await saveMessage('assistant', fullContent);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || isLoadingThread) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold">RAG Chatbot</h1>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
        {/* Search */}
        {messages.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-12">
              <p className="text-lg">Start a conversation</p>
              <p className="text-sm mt-2">Ask me anything from the knowledge base</p>
            </div>
          )}

          {hiddenMessageCount > 0 && (
            <div className="text-center text-xs text-gray-500 py-2">
              Showing last {MAX_DISPLAYED_MESSAGES} of {filteredMessages.length} messages
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          )}

          {displayedMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-[80%] p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white'
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {searchQuery ? (
                    message.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, idx) =>
                      part.toLowerCase() === searchQuery.toLowerCase() ? (
                        <mark key={idx} className="bg-yellow-200">{part}</mark>
                      ) : (
                        <span key={idx}>{parseMarkdownLinks(part)}</span>
                      )
                    )
                  ) : (
                    parseMarkdownLinks(message.content)
                  )}
                </div>
              </Card>
            </div>
          ))}

          {filteredMessages.length === 0 && messages.length > 0 && (
            <div className="text-center text-gray-500 mt-12">
              <p className="text-sm">No messages found matching "{searchQuery}"</p>
            </div>
          )}

          {streamingMessage && (
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-4 bg-white">
                <p className="whitespace-pre-wrap">{streamingMessage}</p>
              </Card>
            </div>
          )}

          {loading && !streamingMessage && (
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-4 bg-white">
                <Loader2 className="h-5 w-5 animate-spin" />
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

