import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/netsuite-auth';

//#region POST: Authenticate user
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const result = await authenticateUser(username, password);

    if (!result.success) {
      const errorResponse: any = { error: result.error };
      if (process.env.NODE_ENV === 'development' && 'details' in result) {
        errorResponse.details = result.details;
      }
      return NextResponse.json(
        errorResponse,
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      isAdmin: result.isAdmin,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
//#endregion

