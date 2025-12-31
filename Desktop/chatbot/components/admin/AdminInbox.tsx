'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Search, Trash2, Sparkles } from 'lucide-react';

interface AdminQueueItem {
  id: string;
  user_question: string;
  status: string;
  created_at: string;
}

interface ProposedAnswer {
  proposedAnswer: string;
  sources: Array<{ title: string; url: string; snippet: string }>;
}

export default function AdminInbox() {
  const [items, setItems] = useState<AdminQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AdminQueueItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [question, setQuestion] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [proposedAnswers, setProposedAnswers] = useState<Record<string, ProposedAnswer>>({});
  const [generatingProposedAnswer, setGeneratingProposedAnswer] = useState<string | null>(null);

  useEffect(() => {
    fetchItems(true); // Show loading spinner on initial load only
  }, []);

  const fetchItems = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await fetch('/api/admin/queue');
      if (response.ok) {
        const data = await response.json();
        const pendingItems = data.filter((item: AdminQueueItem) => item.status === 'pending');
        setItems(pendingItems);
      } else {
        console.error('[AdminInbox] Failed to fetch queue items:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[AdminInbox] Error fetching queue items:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const generateProposedAnswer = async (itemId: string) => {
    setGeneratingProposedAnswer(itemId);
    try {
      const response = await fetch(`/api/admin/queue/${itemId}/proposed-answer`);
      if (response.ok) {
        const data = await response.json();
        setProposedAnswers((prev) => ({
          ...prev,
          [itemId]: data,
        }));
        // If dialog is open for this item, pre-fill the answer
        if (selectedItem?.id === itemId) {
          setAnswer(data.proposedAnswer);
        }
      } else {
        console.error('Failed to generate proposed answer');
      }
    } catch (error) {
      console.error('Error generating proposed answer:', error);
    } finally {
      setGeneratingProposedAnswer(null);
    }
  };

  const handleRowClick = async (item: AdminQueueItem) => {
    setSelectedItem(item);
    setQuestion(item.user_question);
    
    // Check if we have a proposed answer for this item
    if (proposedAnswers[item.id]) {
      setAnswer(proposedAnswers[item.id].proposedAnswer);
    } else {
      setAnswer('');
      // Auto-generate proposed answer when opening dialog
      generateProposedAnswer(item.id);
    }
    
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedItem || !answer.trim() || !question.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          queueId: selectedItem.id,
        }),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setSelectedItem(null);
        setQuestion('');
        setAnswer('');
        // Remove proposed answer from cache since item is resolved
        if (selectedItem) {
          setProposedAnswers((prev) => {
            const updated = { ...prev };
            delete updated[selectedItem.id];
            return updated;
          });
        }
        fetchItems(); // Refresh the list
      } else {
        alert('Failed to save. Please try again.');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering dialog
    
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/queue?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchItems(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(`Failed to delete: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredItems = items.filter((item) =>
    item.user_question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No pending questions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div 
                      onClick={() => handleRowClick(item)}
                      className="flex-1 cursor-pointer min-w-0"
                    >
                      <p className="font-medium">{item.user_question}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                      {proposedAnswers[item.id] && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm overflow-hidden">
                          <p className="text-blue-900 font-medium mb-1">AI Proposed Answer:</p>
                          <p className="text-blue-800 line-clamp-2 break-words overflow-hidden">{proposedAnswers[item.id].proposedAnswer}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!proposedAnswers[item.id] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateProposedAnswer(item.id);
                          }}
                          disabled={generatingProposedAnswer === item.id}
                          className="flex items-center gap-1"
                        >
                          {generatingProposedAnswer === item.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3" />
                              Generate Answer
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(item.id, e)}
                        disabled={deletingId === item.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            // Reset state when dialog closes
            setSelectedItem(null);
            setQuestion('');
            setAnswer('');
          }
        }}
      >
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Answer This Question</DialogTitle>
            <DialogDescription>
              Provide an answer that will be added to the knowledge base
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="answer">Answer</Label>
                {selectedItem && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectedItem && generateProposedAnswer(selectedItem.id)}
                    disabled={generatingProposedAnswer === selectedItem.id || saving}
                    className="flex items-center gap-2"
                  >
                    {generatingProposedAnswer === selectedItem.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {proposedAnswers[selectedItem.id] ? 'Regenerate AI Answer' : 'Generate AI Answer'}
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {selectedItem && proposedAnswers[selectedItem.id] && !generatingProposedAnswer && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <p className="text-sm font-medium text-blue-900">AI Proposed Answer:</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAnswer(proposedAnswers[selectedItem.id].proposedAnswer)}
                      className="h-6 text-xs shrink-0"
                    >
                      Use This
                    </Button>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm text-blue-800 whitespace-pre-wrap break-words">{proposedAnswers[selectedItem.id].proposedAnswer}</p>
                  </div>
                  {proposedAnswers[selectedItem.id].sources && proposedAnswers[selectedItem.id].sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-200 overflow-hidden">
                      <p className="text-xs font-medium text-blue-900 mb-1">Sources:</p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        {proposedAnswers[selectedItem.id].sources.slice(0, 3).map((source, idx) => (
                          <li key={idx} className="break-words overflow-hidden">
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                              {source.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <Textarea
                id="answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={8}
                disabled={saving}
                placeholder="Enter the answer or use the AI proposed answer above..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !answer.trim() || !question.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save to Knowledge Base'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

