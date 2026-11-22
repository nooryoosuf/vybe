# VYBE — Social Watch Party Platform ("Watch Together. Feel Closer.")

A production-quality social watch-party platform inspired by Teleparty, Discord, Netflix, and Apple TV. Watch YouTube videos and Netflix titles together in real time with drift-compensated synchronization, 9 signature floating scene reactions, live chat with GIFs & floating theater mode, shared upvoted watch queues, and optional LiveKit/WebRTC voice & video.

---

## 1. Architecture & Key Features

- **Design System & Visual Identity**:
  - Deep midnight charcoal (`#07080D`) and bluish-black surfaces (`#0D0F18` / `#131624`) with Electric Violet (`#6D5DFB`) and Royal Indigo (`#4F46E5`) accents.
  - Custom Aceternity-inspired components (`CinemaSpotlight`, `AnimatedAvatarStack`, `GlowButton`) and smooth 60 FPS Framer Motion animations with Reduced Motion accessibility support.
- **Dual-Transport Real-Time Synchronization Engine**:
  - **Supabase Cloud Mode**: Connects to Supabase Auth, PostgreSQL RLS tables (`supabase/migrations/001_vybe_schema.sql`), and Supabase Realtime Broadcast/Presence channels when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured.
  - **Built-in Multi-Session Server Realtime Broker**: Also runs a zero-config persistent server store (`.vybe-db.json`) with Server-Sent Events (`/api/realtime/stream`), low-latency event publishing (`/api/realtime/publish`), and browser `BroadcastChannel` so multiple browser windows, incognito tabs, and the Chrome Extension synchronize immediately out of the box.
- **YouTube Official IFrame API Integration**:
  - Validates and extracts 11-character IDs from any YouTube URL format (`youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/embed/...`, `youtube.com/shorts/...`).
  - Fetches real titles and thumbnails via YouTube oEmbed.
  - Synchronizes play, pause, seek, and buffering states with latency compensation, loop-prevention guards, drift detection badges, and 1-click resync.
- **Netflix Manifest V3 Chrome Extension Integration (`chrome-extension/`)**:
  - Respects Netflix DRM and never embeds Netflix in an iframe.
  - Each participant watches through their own authenticated Netflix account while `content-netflix.js` detects `<video>` playback state on `netflix.com/watch/*` and exchanges sync commands with the VYBE room via `content-vybe-bridge.js` and `background.js`.
- **9 Signature Animated Floating Reactions**:
  - ❤️ Love (`1`), 😂 Laugh (`2`), 😭 Cry (`3`), 😱 Shock (`4`), 🔥 Fire (`5`), 👏 Clap (`6`), 🤯 Mind blown (`7`), 💀 Dead (`8`), 🥹 Emotional (`9`).
  - Varied trajectories, rotation, sender avatar/name pills, special particle burst rings, hover toolbar, and spam-prevention cooldown.
- **Live Chat, Shared Watch Queue, Room Management & Voice/Video**:
  - Text messages, emoji picker, searchable Cinema GIF picker, message reactions, threaded replies, system join/leave alerts, unread indicators, and Floating Chat Mode.
  - Democratic watch queue with upvoting/downvoting, manual reordering, item removal, and automatic progression to the next queued YouTube video.
  - Room passwords, waiting room admission, lock room, host/co-host roles, chat mute, kick, and host transfer.
  - Optional WebRTC & LiveKit (`/api/livekit/token`) voice and camera sharing with live Web Audio API speaking indicators and device selection.

---

## 2. Environment Variables & Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Configure your environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous public key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Server-only service role key (never exposed to the client).
   - `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: Optional LiveKit Cloud/SFU credentials for voice & video rooms.
   - `NEXT_PUBLIC_TENOR_API_KEY`: Optional Tenor API key for extended GIF search.
3. Run the Supabase database migration:
   - Execute [`supabase/migrations/001_vybe_schema.sql`](./supabase/migrations/001_vybe_schema.sql) in your Supabase SQL Editor to create all tables, Row Level Security (RLS) policies, role helper functions, and Realtime publications.

---

## 3. Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`:
- **Landing Page**: `http://localhost:3000`
- **Dashboard**: `http://localhost:3000/dashboard`
- **Live YouTube 4K Watch Room**: `http://localhost:3000/room/VYB-4K1`
- **Netflix Companion Watch Room**: `http://localhost:3000/room/NFX-808`

---

## 4. Installing the Manifest V3 Chrome Extension (Netflix Sync)

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** ON in the top-right corner.
3. Click **Load unpacked** and select the `chrome-extension/` folder inside this repository.
4. Open a Netflix Watch Party room (e.g. `http://localhost:3000/room/NFX-808`) and click **Open Title on Netflix.com** to synchronize playback across your authenticated Netflix session.
