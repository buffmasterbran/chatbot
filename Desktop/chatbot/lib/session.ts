import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const secretKey = process.env.SESSION_SECRET!;
const key = new TextEncoder().encode(secretKey);

export interface SessionData {
  userId: string;
  username: string;
  isAdmin: boolean;
  netsuiteId: string;
}

export async function encrypt(payload: SessionData): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function decrypt(session: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });
    return payload as SessionData;
  } catch (error) {
    return null;
  }
}

export async function createSession(data: SessionData): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await encrypt(data);
  
  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  
  if (!session) {
    return null;
  }
  
  return await decrypt(session);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

