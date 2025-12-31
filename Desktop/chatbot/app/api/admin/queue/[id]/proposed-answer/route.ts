import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { streamAnswer } from '@/lib/openai';

//#region GET: Generate proposed answer for queue item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getSession();
    
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve params
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    // Fetch queue item
    const { data: queueItem, error: queueError } = await supabaseAdmin
      .from('admin_queue')
      .select('user_question')
      .eq('id', id)
      .single();

    if (queueError || !queueItem) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      );
    }

    const question = queueItem.user_question;
    let proposedAnswer = '';

    try {
      for await (const chunk of streamAnswer(question)) {
        proposedAnswer += chunk;
      }

    } catch (error) {
      console.error('Error generating proposed answer:', error);
      return NextResponse.json(
        { error: 'Failed to generate proposed answer' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      proposedAnswer,
      sources: [],
    });
  } catch (error) {
    console.error('Proposed answer API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

