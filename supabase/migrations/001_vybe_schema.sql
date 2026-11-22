-- ============================================================================
-- VYBE — Social Watch Party Platform
-- Complete Supabase PostgreSQL Schema, RLS Policies, Functions & Realtime
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. USER PROFILES & PREFERENCES
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  username text unique,
  avatar_url text not null default 'https://api.dicebear.com/9.x/glass/svg?seed=vybe',
  bio text default 'Cinema lover & late-night watch party host.',
  presence_status text not null default 'online' check (presence_status in ('online', 'watching', 'away', 'offline')),
  current_room_code text,
  accent_color text not null default '#6D5DFB',
  is_guest boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reduced_motion boolean not null default false,
  reaction_sounds boolean not null default false,
  auto_sync_threshold_sec numeric(4,2) not null default 2.00,
  floating_chat_default boolean not null default false,
  show_presence_to_friends boolean not null default true,
  default_room_privacy text not null default 'public' check (default_room_privacy in ('public', 'private')),
  updated_at timestamptz not null default now()
);

-- Trigger to auto-create profile and preferences upon Supabase Auth registration
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, username, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'guest'), '@', 1)),
    lower(regexp_replace(split_part(coalesce(new.email, 'user_' || substr(new.id::text, 1, 6)), '@', 1), '[^a-zA-Z0-9_]', '', 'g')) || '_' || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/9.x/glass/svg?seed=' || new.id::text)
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. WATCH ROOMS & PLAYBACK STATE
-- ----------------------------------------------------------------------------
create table if not exists public.watch_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  host_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'youtube' check (platform in ('youtube', 'netflix')),
  privacy text not null default 'public' check (privacy in ('public', 'private')),
  password_hash text,
  has_password boolean not null default false,
  allow_guests boolean not null default true,
  waiting_room_enabled boolean not null default false,
  is_locked boolean not null default false,
  is_active boolean not null default true,
  participant_limit integer not null default 25 check (participant_limit between 2 and 100),
  control_permission text not null default 'host_only' check (control_permission in ('host_only', 'cohosts', 'everyone')),
  current_video_id text not null default 'aqz-KE-bpKQ',
  current_video_title text not null default 'Big Buck Bunny — 4K Open Movie Screening',
  current_video_thumbnail text,
  netflix_watch_id text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.room_playback_state (
  room_id uuid primary key references public.watch_rooms(id) on delete cascade,
  platform text not null default 'youtube' check (platform in ('youtube', 'netflix')),
  video_id text not null,
  video_title text not null,
  is_playing boolean not null default false,
  playback_time_sec double precision not null default 0,
  playback_rate numeric(3,2) not null default 1.00,
  sequence_num bigint not null default 1,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. ROOM MEMBERSHIPS (ROLES, WAITING ROOM, MUTE & SYNC STATUS)
-- ----------------------------------------------------------------------------
create table if not exists public.room_memberships (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'cohost', 'member', 'guest')),
  status text not null default 'joined' check (status in ('joined', 'waiting', 'kicked', 'left')),
  is_chat_muted boolean not null default false,
  is_voice_muted boolean not null default true,
  is_camera_on boolean not null default false,
  reported_time_sec double precision not null default 0,
  sync_drift_sec double precision not null default 0,
  extension_connected boolean not null default false,
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  unique(room_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 4. CHAT MESSAGES & MESSAGE REACTIONS
-- ----------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  sender_name text not null,
  sender_avatar text not null,
  sender_role text not null default 'member',
  message_type text not null default 'text' check (message_type in ('text', 'gif', 'system')),
  content text not null,
  gif_url text,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  reactions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. ANIMATED ROOM REACTIONS (PERSISTED HIGHLIGHTS / ANALYTICS)
-- ----------------------------------------------------------------------------
create table if not exists public.room_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  sender_name text not null,
  emoji text not null,
  label text not null,
  video_timestamp_sec double precision not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. SHARED WATCH QUEUE & VOTING
-- ----------------------------------------------------------------------------
create table if not exists public.watch_queue_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  platform text not null default 'youtube' check (platform in ('youtube', 'netflix')),
  video_id text not null,
  title text not null,
  thumbnail_url text not null,
  duration_label text not null default 'HD',
  netflix_synopsis text,
  added_by_id uuid references public.profiles(id) on delete set null,
  added_by_name text not null,
  position integer not null default 0,
  score integer not null default 1,
  upvoter_ids uuid[] not null default '{}',
  downvoter_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. SAVED USER WATCHLISTS & INVITATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.saved_watchlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  room_code text not null,
  room_title text not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_email text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) & ROLE-BASED ACCESS VALIDATION
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.watch_rooms enable row level security;
alter table public.room_playback_state enable row level security;
alter table public.room_memberships enable row level security;
alter table public.chat_messages enable row level security;
alter table public.room_reactions enable row level security;
alter table public.watch_queue_items enable row level security;
alter table public.saved_watchlists enable row level security;
alter table public.room_invitations enable row level security;

-- Helper function: check if current user is an active member of a room
create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.room_memberships
    where room_id = target_room_id
      and user_id = auth.uid()
      and status = 'joined'
  );
$$;

-- Helper function: check if current user is host or cohost of a room
create or replace function public.is_room_moderator(target_room_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.room_memberships
    where room_id = target_room_id
      and user_id = auth.uid()
      and status = 'joined'
      and role in ('host', 'cohost')
  );
$$;

-- Helper function: check if current user has playback control permission in a room
create or replace function public.can_control_playback(target_room_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.watch_rooms r
    join public.room_memberships m on m.room_id = r.id
    where r.id = target_room_id
      and m.user_id = auth.uid()
      and m.status = 'joined'
      and (
        m.role = 'host'
        or (r.control_permission = 'cohosts' and m.role in ('host', 'cohost'))
        or r.control_permission = 'everyone'
      )
  );
$$;

-- Profiles RLS
create policy "Profiles are viewable by authenticated and guest users"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- User Preferences RLS
create policy "Users can read own preferences"
  on public.user_preferences for select using (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for all using (auth.uid() = user_id);

-- Watch Rooms RLS
create policy "Public rooms or joined rooms are viewable"
  on public.watch_rooms for select
  using (privacy = 'public' or host_id = auth.uid() or public.is_room_member(id));

create policy "Authenticated users can create rooms"
  on public.watch_rooms for insert
  with check (auth.uid() = host_id);

create policy "Host and cohosts can update room settings"
  on public.watch_rooms for update
  using (host_id = auth.uid() or public.is_room_moderator(id));

-- Playback State RLS
create policy "Room members can read playback state"
  on public.room_playback_state for select
  using (public.is_room_member(room_id));

create policy "Permitted controllers can update playback state"
  on public.room_playback_state for all
  using (public.can_control_playback(room_id));

-- Room Memberships RLS
create policy "Room memberships viewable by room participants"
  on public.room_memberships for select
  using (true);

create policy "Users can join unlocked rooms"
  on public.room_memberships for insert
  with check (auth.uid() = user_id);

create policy "Users can update own membership or moderators can manage members"
  on public.room_memberships for update
  using (auth.uid() = user_id or public.is_room_moderator(room_id));

-- Chat Messages RLS
create policy "Room members can view chat messages"
  on public.chat_messages for select
  using (public.is_room_member(room_id));

create policy "Unmuted room members can post chat messages"
  on public.chat_messages for insert
  with check (
    public.is_room_member(room_id)
    and not exists (
      select 1 from public.room_memberships
      where room_id = chat_messages.room_id
        and user_id = auth.uid()
        and is_chat_muted = true
    )
  );

create policy "Room members can react to chat messages"
  on public.chat_messages for update
  using (public.is_room_member(room_id));

-- Reactions & Queue RLS
create policy "Room members can view and create reactions"
  on public.room_reactions for all
  using (public.is_room_member(room_id));

create policy "Room members can view and manage watch queue"
  on public.watch_queue_items for all
  using (public.is_room_member(room_id));

-- Saved Watchlists & Invitations RLS
create policy "Users manage own watchlists"
  on public.saved_watchlists for all
  using (auth.uid() = owner_id);

create policy "Users can view sent or received invitations"
  on public.room_invitations for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can create and respond to invitations"
  on public.room_invitations for all
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- ----------------------------------------------------------------------------
-- 9. SUPABASE REALTIME PUBLICATION
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.watch_rooms;
alter publication supabase_realtime add table public.room_playback_state;
alter publication supabase_realtime add table public.room_memberships;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.watch_queue_items;
alter publication supabase_realtime add table public.room_invitations;
