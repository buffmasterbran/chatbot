import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';

//#region GET: Fetch all knowledge base items
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('knowledge_base')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge base:', error);
      return NextResponse.json(
        { error: 'Failed to fetch knowledge base' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Knowledge base GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

//#region POST: Create new knowledge base entry
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { question, answer, queueId } = await request.json();

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 }
      );
    }

    // Generate embedding from question only (to match search queries)
    // CRITICAL: We search with question-only embeddings, so we must save with question-only embeddings
    const embedding = await generateEmbedding(question);

    // Insert into knowledge_base
    const { data: kbData, error: kbError } = await supabaseAdmin
      .from('knowledge_base')
      .insert({
        question: question.trim(),
        answer: answer.trim(),
        embedding,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (kbError) {
      console.error('Error creating knowledge base entry:', kbError);
      return NextResponse.json(
        { error: 'Failed to create knowledge base entry' },
        { status: 500 }
      );
    }

    // Update queue if queueId provided
    if (queueId) {
      await supabaseAdmin
        .from('admin_queue')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', queueId);
    }

    return NextResponse.json({ success: true, data: kbData });
  } catch (error) {
    console.error('Knowledge base POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

//#region PUT: Update existing knowledge base entry
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, question, answer } = await request.json();

    if (!id || !question || !answer) {
      return NextResponse.json(
        { error: 'ID, question, and answer are required' },
        { status: 400 }
      );
    }

    // Generate embedding from question only (to match search queries)
    // CRITICAL: We search with question-only embeddings, so we must save with question-only embeddings
    const embedding = await generateEmbedding(question);

    // Update entry
    const { data, error } = await supabaseAdmin
      .from('knowledge_base')
      .update({
        question: question.trim(),
        answer: answer.trim(),
        embedding,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating knowledge base entry:', error);
      return NextResponse.json(
        { error: 'Failed to update knowledge base entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Knowledge base PUT API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

//#region DELETE: Delete a knowledge base entry
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('knowledge_base')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting knowledge base entry:', error);
      return NextResponse.json(
        { error: 'Failed to delete knowledge base entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Knowledge base DELETE API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

