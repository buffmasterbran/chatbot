import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

//#region GET: Fetch all chat threads
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Get threads
    const { data: threads, error: threadsError } = await supabaseAdmin
      .from('chat_threads')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userData.id)
      .order('updated_at', { ascending: false });

    if (threadsError) {
      console.error('Error fetching threads:', threadsError);
      return NextResponse.json(
        { error: 'Failed to fetch chat threads' },
        { status: 500 }
      );
    }

    return NextResponse.json({ threads: threads || [] });
  } catch (error) {
    console.error('Chat threads GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

//#region POST: Create new chat thread
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title } = await request.json();

    // Get user ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', session.username)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create thread
    const { data: threadData, error: threadError } = await supabaseAdmin
      .from('chat_threads')
      .insert({
        user_id: userData.id,
        title: title || 'New Chat',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (threadError) {
      console.error('Error creating thread:', threadError);
      return NextResponse.json(
        { error: 'Failed to create chat thread' },
        { status: 500 }
      );
    }

    return NextResponse.json({ thread: threadData });
  } catch (error) {
    console.error('Chat threads POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

