import { eq } from 'drizzle-orm';
import { equivalentUserIds, userFromRequest } from '@/lib/auth/identity';
import { getDb } from '@/lib/db';
import { washers } from '@/lib/db/schema';
import { HttpError } from '@/lib/errors';

// The caller must be signed in and be the washer's current owner (any of their equivalent accounts).
export async function requireWasherOwner(request: Request, washerId: string) {
  const user = await userFromRequest(request);
  if (!user) throw new HttpError(401, 'Sign in required');
  const [washer] = await getDb().select().from(washers).where(eq(washers.id, washerId)).limit(1);
  if (!washer?.currentUserId || !(await equivalentUserIds(user.id)).includes(washer.currentUserId)) throw new HttpError(403, 'Not your washer');
  return washer;
}
