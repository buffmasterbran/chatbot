import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

//#region GET: Fetch messages for thread
export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId } = params;

    // Get user ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', session.username)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify thread belongs to user
    const { data: threadData, error: threadError } = await supabaseAdmin
      .from('chat_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', userData.id)
      .single();

    if (threadError || !threadData) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error('Chat thread GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

//#region POST: Add message to thread
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId } = params;
    const { role, content } = await request.json();

    if (!role || !content || !['user', 'assistant'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid message data' },
        { status: 400 }
      );
    }

    // Get user ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', session.username)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify thread belongs to user
    const { data: threadData, error: threadError } = await supabaseAdmin
      .from('chat_threads')
      .select('id, title')
      .eq('id', threadId)
      .eq('user_id', userData.id)
      .single();

    if (threadError || !threadData) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Add message
    const { data: messageData, error: messageError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        role,
        content,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error adding message:', messageError);
      return NextResponse.json(
        { error: 'Failed to add message' },
        { status: 500 }
      );
    }

    // Update thread timestamp
    await supabaseAdmin
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    // Set title if first user message
    if (role === 'user' && !threadData.title) {
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
      await supabaseAdmin
        .from('chat_threads')
        .update({ title })
        .eq('id', threadId);
    }

    return NextResponse.json({ message: messageData });
  } catch (error) {
    console.error('Chat thread POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

