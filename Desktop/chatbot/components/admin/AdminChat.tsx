'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, Loader2, Search, X } from 'lucide-react';
import { parseMarkdownLinks } from '@/lib/markdown-links';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AdminChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const MAX_DISPLAYED_MESSAGES = 50; // Limit displayed messages to last 50

  // Load or create thread on mount
  useEffect(() => {
    loadOrCreateThread();
  }, []);

  // Save messages to localStorage when they change (for tab switching persistence)
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('admin_chat_messages', JSON.stringify(messages));
      localStorage.setItem('admin_chat_thread_id', currentThreadId || '');
    }
  }, [messages, currentThreadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const loadOrCreateThread = async () => {
    try {
      // FIRST: Try to load from localStorage immediately (for tab switching)
      // This works even if database isn't set up yet
      const savedMessages = localStorage.getItem('admin_chat_messages');
      const savedThreadId = localStorage.getItem('admin_chat_thread_id');
      
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
            // Restore from localStorage immediately
            setMessages(parsedMessages);
            if (savedThreadId) {
              setCurrentThreadId(savedThreadId);
            }
            setIsLoadingThread(false);
            
            // Then try to sync with database in background (non-blocking)
            if (savedThreadId) {
              fetch(`/api/chat/threads/${savedThreadId}`)
                .then(response => {
                  if (response.ok) {
                    return response.json();
                  }
                  return null;
                })
                .then(data => {
                  if (data && data.messages) {
                    const loadedMessages: Message[] = data.messages.map((m: any) => ({
                      id: m.id,
                      role: m.role,
                      content: m.content,
                      timestamp: new Date(m.created_at),
                    }));
                    setMessages(loadedMessages);
                  }
                })
                .catch(() => {
                  // Database sync failed, but we already have localStorage data
                });
            }
            return;
          }
        } catch (error) {
          // Invalid localStorage data, continue to create new thread
        }
      }

      // SECOND: Try to create new thread in database (optional)
      try {
        const response = await fetch('/api/chat/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Admin Chat' }),
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentThreadId(data.thread.id);
          localStorage.setItem('admin_chat_thread_id', data.thread.id);
        }
      } catch (error) {
        // Database not available, but we can still use localStorage
        console.warn('Database not available, using localStorage only:', error);
      }
      
      // If no saved messages, start fresh
      if (!savedMessages) {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading thread:', error);
      // Fallback: try to load from localStorage anyway
      const savedMessages = localStorage.getItem('admin_chat_messages');
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          if (Array.isArray(parsedMessages)) {
            setMessages(parsedMessages);
          }
        } catch (e) {
          // Invalid data
        }
      }
    } finally {
      setIsLoadingThread(false);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    // Always save to localStorage immediately (for tab switching)
    // This works even if database isn't available
    
    // Try to save to database (non-blocking, optional)
    if (currentThreadId) {
      fetch(`/api/chat/threads/${currentThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      }).catch(error => {
        // Database save failed, but localStorage already saved it
        console.warn('Database save failed, using localStorage only:', error);
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearChat = () => {
    if (confirm('Are you sure you want to clear all chat messages? This cannot be undone.')) {
      setMessages([]);
      localStorage.removeItem('admin_chat_messages');
      // Optionally create a new thread
      if (currentThreadId) {
        fetch('/api/chat/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Admin Chat' }),
        })
          .then(response => response.json())
          .then(data => {
            if (data.thread) {
              setCurrentThreadId(data.thread.id);
              localStorage.setItem('admin_chat_thread_id', data.thread.id);
            }
          })
          .catch(() => {
            // Database not available, continue anyway
          });
      }
    }
  };

  // Filter messages based on search query and limit to last 50
  const filteredMessages = messages.filter(message => {
    if (!searchQuery.trim()) return true;
    return message.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Show only last 50 messages (or all if less than 50)
  const displayedMessages = filteredMessages.length > MAX_DISPLAYED_MESSAGES
    ? filteredMessages.slice(-MAX_DISPLAYED_MESSAGES)
    : filteredMessages;

  const hiddenMessageCount = filteredMessages.length - displayedMessages.length;

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

  if (isLoadingThread) {
    return (
      <Card className="h-[600px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="mt-2 text-sm text-gray-500">Loading chat...</p>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">Quick Chat</h2>
            <p className="text-sm text-gray-500">Query the knowledge base quickly</p>
          </div>
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
        </div>
        {/* Search */}
        {messages.length > 0 && (
          <div className="relative">
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
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
                className={`max-w-[80%] p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-50'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">
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
              <Card className="max-w-[80%] p-3 bg-gray-50">
                <p className="whitespace-pre-wrap text-sm">{streamingMessage}</p>
              </Card>
            </div>
          )}

          {loading && !streamingMessage && (
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-3 bg-gray-50">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}

