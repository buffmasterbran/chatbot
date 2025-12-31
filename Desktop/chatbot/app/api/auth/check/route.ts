import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

//#region GET: Check authentication status
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      username: session.username,
      isAdmin: session.isAdmin,
    },
  });
}
//#endregion

