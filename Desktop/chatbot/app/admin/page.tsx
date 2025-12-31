'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Loader2, Search } from 'lucide-react';
import AdminInbox from '@/components/admin/AdminInbox';
import AdminData from '@/components/admin/AdminData';
import AdminChat from '@/components/admin/AdminChat';
import AdminSettings from '@/components/admin/AdminSettings';

interface AdminQueueItem {
  id: string;
  user_question: string;
  status: string;
  created_at: string;
}

interface KnowledgeBaseItem {
  id: string;
  question: string;
  answer: string;
  updated_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/check');
      if (response.ok) {
        const data = await response.json();
        if (data.user?.isAdmin) {
          setIsAuthenticated(true);
          setIsAdmin(true);
        } else {
          router.push('/chat');
        }
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-6">
            <AdminChat />
          </TabsContent>

          <TabsContent value="inbox" className="mt-6">
            <AdminInbox />
          </TabsContent>

          <TabsContent value="data" className="mt-6">
            <AdminData />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

