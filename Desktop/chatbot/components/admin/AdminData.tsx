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
import { Loader2, Search, Edit2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface KnowledgeBaseItem {
  id: string;
  question: string;
  answer: string;
  updated_at: string;
}

export default function AdminData() {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<KnowledgeBaseItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/admin/knowledge');
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: KnowledgeBaseItem) => {
    setSelectedItem(item);
    setQuestion(item.question);
    setAnswer(item.answer);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedItem(null);
    setQuestion('');
    setAnswer('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!answer.trim() || !question.trim()) return;

    setSaving(true);
    try {
      // If selectedItem exists, it's an edit. Otherwise, it's a new entry.
      const url = '/api/admin/knowledge';
      const method = selectedItem ? 'PUT' : 'POST';
      const body = selectedItem
        ? {
          id: selectedItem.id,
          question: question.trim(),
          answer: answer.trim(),
          }
        : {
            question: question.trim(),
            answer: answer.trim(),
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setSelectedItem(null);
        setQuestion('');
        setAnswer('');
        fetchItems(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(`Failed to save: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering edit dialog or toggle
    
    if (!confirm('Are you sure you want to delete this entry? This cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/knowledge?id=${id}`, {
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

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const filteredItems = items.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
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
          <div className="flex items-center justify-between">
          <CardTitle>Knowledge Base</CardTitle>
            <Button onClick={handleAddNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No knowledge base entries found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 flex items-start gap-3">
                          <div className="mt-1">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-lg">{item.question}</p>
                            {isExpanded && (
                              <>
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                                  <p className="text-sm text-gray-500 mt-3">
                                    Updated: {new Date(item.updated_at).toLocaleString()}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
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
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Edit Knowledge Base Entry' : 'Add New Knowledge Base Entry'}
            </DialogTitle>
            <DialogDescription>
              {selectedItem
                ? 'Update the question and answer. The embedding will be regenerated automatically.'
                : 'Add a new question and answer to the knowledge base. An embedding will be generated automatically.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-question">Question</Label>
              <Input
                id="edit-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-answer">Answer</Label>
              <Textarea
                id="edit-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={8}
                disabled={saving}
                placeholder="Enter the answer..."
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
                  {selectedItem ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                selectedItem ? 'Save Changes' : 'Create Entry'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

