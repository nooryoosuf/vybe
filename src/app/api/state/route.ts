import { NextRequest, NextResponse } from 'next/server';
import { getVybeServerStore } from '@/lib/server/vybeStore';
import { RoomInvitation, SavedWatchlist, UserProfile } from '@/types/vybe';

export async function GET(req: NextRequest) {
  const store = getVybeServerStore();
  const db = store.getDb();
  const userId = req.nextUrl.searchParams.get('userId') || 'default';

  const rooms = Object.values(db.rooms)
    .filter((r) => r.isActive)
    .map(({ password, ...safeRoom }) => safeRoom);

  const users = Object.values(db.users).map(({ passwordHash, ...safeUser }) => safeUser);

  const userWatchlists =
    db.watchlistsByUser[userId] || db.watchlistsByUser['default'] || [];

  const invitations = db.invitations.filter(
    (inv) => !inv.recipientId || inv.recipientId === userId || inv.status === 'pending'
  );

  return NextResponse.json({
    rooms,
    users,
    watchlists: userWatchlists,
    invitations,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getVybeServerStore();

    if (body.action === 'UPSERT_USER') {
      const user = body.user as UserProfile;
      if (!user || !user.id) {
        return NextResponse.json({ error: 'Invalid user payload' }, { status: 400 });
      }
      store.mutate((db) => {
        db.users[user.id] = {
          ...(db.users[user.id] || {}),
          ...user,
        };
      });
      return NextResponse.json({ user: store.getDb().users[user.id] });
    }

    if (body.action === 'LOGIN_EMAIL') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }
      const db = store.getDb();
      const existing = Object.values(db.users).find(
        (u) => u.email?.toLowerCase() === email
      );
      if (existing) {
        const { passwordHash, ...safeUser } = existing;
        return NextResponse.json({ user: safeUser });
      }
      return NextResponse.json({ user: null });
    }

    if (body.action === 'SAVE_WATCHLIST') {
      const { userId, watchlist } = body as { userId: string; watchlist: SavedWatchlist };
      store.mutate((db) => {
        const current = db.watchlistsByUser[userId] || [...(db.watchlistsByUser['default'] || [])];
        const idx = current.findIndex((w) => w.id === watchlist.id);
        if (idx >= 0) {
          current[idx] = watchlist;
        } else {
          current.unshift(watchlist);
        }
        db.watchlistsByUser[userId] = current;
      });
      return NextResponse.json({
        watchlists: store.getDb().watchlistsByUser[userId],
      });
    }

    if (body.action === 'CREATE_INVITATION') {
      const invitation = body.invitation as RoomInvitation;
      store.mutate((db) => {
        db.invitations.unshift(invitation);
      });
      return NextResponse.json({ invitations: store.getDb().invitations });
    }

    if (body.action === 'RESPOND_INVITATION') {
      const { invitationId, status } = body as {
        invitationId: string;
        status: 'accepted' | 'declined';
      };
      store.mutate((db) => {
        const inv = db.invitations.find((i) => i.id === invitationId);
        if (inv) {
          inv.status = status;
        }
      });
      return NextResponse.json({ invitations: store.getDb().invitations });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
