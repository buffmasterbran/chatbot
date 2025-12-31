import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/session';

//#region POST: Logout user
export async function POST(request: NextRequest) {
  await deleteSession();
  return NextResponse.json({ success: true });
}
//#endregion

