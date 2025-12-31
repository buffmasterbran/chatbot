import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

//#region GET: Fetch all queue items
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin queue:', error);
      return NextResponse.json(
        { error: 'Failed to fetch queue items' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Admin queue API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

//#region DELETE: Delete a queue item
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
      .from('admin_queue')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting queue item:', error);
      return NextResponse.json(
        { error: 'Failed to delete queue item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin queue DELETE API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

