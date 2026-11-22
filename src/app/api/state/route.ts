import { NextRequest, NextResponse } from 'next/server';
import { getVybeServerStore } from '@/lib/server/vybeStore';
import {
  RoomInvitation,
  SavedWatchlist,
  SiteMovieItem,
  UserProfile,
} from '@/types/vybe';
import { INITIAL_SITE_MOVIES } from '@/lib/constants';

export async function GET(req: NextRequest) {
  const store = getVybeServerStore();
  const db = store.getDb();
  const userId = req.nextUrl.searchParams.get('userId') || 'default';

  const rooms = Object.values(db.rooms)
    .filter((r) => r.isActive)
    .map(({ password, ...safeRoom }) => safeRoom);

  const users = Object.values(db.users).map(({ passwordHash, ...safeUser }) => safeUser);

  const userWatchlists = db.watchlistsByUser[userId] || [];

  const invitations = db.invitations.filter(
    (inv) =>
      !inv.recipientId ||
      inv.recipientId === userId ||
      inv.recipientEmail?.toLowerCase() === db.users[userId]?.username?.toLowerCase() ||
      inv.recipientEmail?.toLowerCase() === db.users[userId]?.email?.toLowerCase()
  );

  return NextResponse.json({
    rooms,
    users,
    watchlists: userWatchlists,
    invitations,
    siteMovies: db.siteMovies?.length ? db.siteMovies : INITIAL_SITE_MOVIES,
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
        const existing = db.users[user.id];
        db.users[user.id] = {
          ...(existing || {}),
          ...user,
          friendIds: user.friendIds || existing?.friendIds || [],
        };
      });
      return NextResponse.json({ user: store.getDb().users[user.id] });
    }

    if (body.action === 'LOGIN_EMAIL') {
      const identifier = String(body.email || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
      if (!identifier) {
        return NextResponse.json({ error: 'Username or email is required' }, { status: 400 });
      }
      const db = store.getDb();
      const existing = Object.values(db.users).find(
        (u) =>
          u.email?.toLowerCase() === identifier ||
          u.username?.toLowerCase() === identifier
      );
      if (existing) {
        const { passwordHash, ...safeUser } = existing;
        return NextResponse.json({ user: safeUser });
      }
      return NextResponse.json({ user: null });
    }

    if (body.action === 'ADD_FRIEND') {
      const { userId, targetQuery } = body as {
        userId: string;
        targetQuery: string;
      };
      const cleanQuery = String(targetQuery || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
      if (!cleanQuery) {
        return NextResponse.json({ error: 'Enter a friend username' }, { status: 400 });
      }

      const db = store.getDb();
      const me = db.users[userId];
      const targetUser = Object.values(db.users).find(
        (u) =>
          u.id !== userId &&
          (u.id.toLowerCase() === cleanQuery ||
            u.username?.toLowerCase() === cleanQuery ||
            u.displayName?.toLowerCase() === cleanQuery ||
            u.email?.toLowerCase() === cleanQuery)
      );

      if (!targetUser) {
        return NextResponse.json(
          {
            error: `No user found with username "@${cleanQuery}". Ask your friend to sign up first!`,
          },
          { status: 404 }
        );
      }

      store.mutate((state) => {
        if (state.users[userId]) {
          const myFriends = new Set(state.users[userId].friendIds || []);
          myFriends.add(targetUser.id);
          state.users[userId].friendIds = Array.from(myFriends);
        }
        if (state.users[targetUser.id] && me) {
          const theirFriends = new Set(state.users[targetUser.id].friendIds || []);
          theirFriends.add(userId);
          state.users[targetUser.id].friendIds = Array.from(theirFriends);
        }
      });

      return NextResponse.json({
        user: store.getDb().users[userId],
        addedFriend: targetUser,
      });
    }

    if (body.action === 'REMOVE_FRIEND') {
      const { userId, friendId } = body as { userId: string; friendId: string };
      store.mutate((state) => {
        if (state.users[userId]) {
          state.users[userId].friendIds = (state.users[userId].friendIds || []).filter(
            (id) => id !== friendId
          );
        }
      });
      return NextResponse.json({ user: store.getDb().users[userId] });
    }

    if (body.action === 'ADD_SITE_MOVIE') {
      const movie = body.movie as SiteMovieItem;
      if (!movie || !movie.title || !movie.videoId) {
        return NextResponse.json({ error: 'Invalid movie details' }, { status: 400 });
      }
      store.mutate((state) => {
        if (!Array.isArray(state.siteMovies)) {
          state.siteMovies = [...INITIAL_SITE_MOVIES];
        }
        state.siteMovies.unshift(movie);
      });
      return NextResponse.json({ siteMovies: store.getDb().siteMovies });
    }

    if (body.action === 'SAVE_WATCHLIST') {
      const { userId, watchlist } = body as { userId: string; watchlist: SavedWatchlist };
      store.mutate((db) => {
        const current = db.watchlistsByUser[userId] || [];
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
