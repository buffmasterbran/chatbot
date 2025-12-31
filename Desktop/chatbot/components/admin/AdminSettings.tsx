'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';

export default function AdminSettings() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.systemPrompt || '');
        if (data.updatedAt) {
          setLastSaved(new Date(data.updatedAt));
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!systemPrompt.trim()) {
      alert('System prompt cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt }),
      });

      if (response.ok) {
        const data = await response.json();
        setLastSaved(new Date(data.updatedAt));
        alert('Settings saved successfully!');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Save error:', errorData);
        alert(`Failed to save settings: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(`Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Prompt Settings</CardTitle>
        {lastSaved && (
          <p className="text-sm text-gray-500">
            Last saved: {lastSaved.toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            System Prompt
          </label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="font-mono text-sm min-h-[500px]"
            placeholder="Enter system prompt..."
          />
          <p className="text-sm text-gray-500 mt-2">
            This prompt controls how the AI responds to questions. Changes take effect immediately after saving.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

