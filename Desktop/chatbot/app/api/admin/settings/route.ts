import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

//#region GET: Fetch system settings
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('system_prompt, updated_at, updated_by')
      .eq('id', SETTINGS_ID)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      systemPrompt: data?.system_prompt || '',
      updatedAt: data?.updated_at || null,
    });
  } catch (error) {
    console.error('Settings GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

//#region PUT: Update system settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { systemPrompt } = await request.json();

    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return NextResponse.json(
        { error: 'System prompt is required' },
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

    // Upsert the settings (inserts if doesn't exist, updates if it does)
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert(
        {
          id: SETTINGS_ID,
          system_prompt: systemPrompt,
          updated_by: userData.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return NextResponse.json(
        { error: `Failed to save settings: ${error.message || error.details || 'Database error'}. Please ensure the system_settings table exists in your database.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      systemPrompt: data.system_prompt,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    console.error('Settings PUT API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

