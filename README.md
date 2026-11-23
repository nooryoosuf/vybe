# VYBE — Netflix-Only Social Watch Party Platform ("Watch Together. Feel Closer.")

A production-quality social watch-party platform inspired by Teleparty and Netflix. Every participant plays the same Netflix title through their **own authenticated Netflix account** on netflix.com, while the VYBE Chrome Extension keeps play, pause, and seek in sync room-wide. Real-time floating scene reactions, live chat with GIFs & message reactions, threaded replies, shared upvoted watch queues, room permissions, and host controls.

---

## 1. Architecture & Key Features

- **Design System & Visual Identity**:
  - Deep midnight charcoal (`#07080D`) and bluish-black surfaces (`#0D0F18` / `#131624`) with Electric Violet (`#6D5DFB`) and Royal Indigo (`#4F46E5`) accents.
  - Custom Aceternity-inspired components (`CinemaSpotlight`, `AnimatedAvatarStack`, `GlowButton`) and smooth 60 FPS Framer Motion animations with Reduced Motion accessibility support.
- **Backend** (Next.js App Router):
  - Supabase-compatible optional Cloud mode: connects to Supabase Auth, PostgreSQL tables (`supabase/migrations/001_vybe_schema.sql`, Netflix-only via `002_netflix_only.sql`), and Supabase Realtime Broadcast channels when `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured.
  - Built-in zero-config Multi-Session Server Realtime Broker (Server-Sent Events `/api/realtime/stream`, event publishing `/api/realtime/publish`, browser `BroadcastChannel`) so multiple browser windows and the Chrome Extension sync immediately out of the box.
  - Room management (create/join/invite), participant membership, room permissions, chat, message reactions, and room state recovery — Netflix rooms only.
- **Netflix Sync Chrome Extension (MV3, `chrome-extension/`)**:
  - Detects Netflix playback on `netflix.com/watch/*` pages and reports heartbeats (2s) including position, play state, and buffering.
  - Executes authorized play/pause/seek commands on the Netflix tab (`APPLY_TO_NETFLIX_VIDEO`), with a **different-title guard** that rejects commands targeting another title.
  - Persists session state in `chrome.storage.local` and re-requests state on startup/install, so pairing survives MV3 service-worker restarts; a 15s poller recovers after suspensions.
  - Poll-based playback reporting covers tab changes and Netflix SPA navigation (video remounts via MutationObserver + 2s poll).
  - Protected content plays on the official Netflix site — the extension never embeds, proxies, or bypasses DRM; each participant uses their own Netflix account.
- **9 Signature Animated Floating Reactions**:
  - ❤️ Love (`1`), 😂 Laugh (`2`), 😭 Cry (`3`), 😱 Shock (`4`), 🔥 Fire (`5`), 👏 Clap (`6`), 🤯 Mind blown (`7`), 💀 Dead (`8`), 🥹 Emotional (`9`).
  - Varied trajectories, rotation, sender avatar/name pills, special particle burst rings, hover toolbar, and spam-prevention cooldown.
- **Live Chat, Shared Watch Queue, Room Management & Voice/Camera**:
  - Text messages, emoji picker, searchable Cinema GIF picker, message reactions, threaded replies, system join/leave alerts, unread indicators, and Floating Chat Mode.
  - Democratic watch queue with upvoting/downvoting, manual reordering, item removal, and "Play Now" (Netflix titles only).
  - Room passwords, waiting room admission, lock room, host/co-host roles, chat mute, kick, and host transfer.
  - Optional mic/camera sharing with live speaking indicators and device selection (user-controlled;Netflix account audio/video settings stay with the viewer).
- **Mobile-Safe**: The Netflix companion deck works on phones — it shows the active room + Netflix title + playback position, offers manual sync (Resync) and the "Open Netflix.com" link, while clearly stating mobile web can't control the Netflix mobile app. Chat and reactions work throughout.

---

## 2. Environment Variables & Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Configure environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous public key.
   - `NEXT_PUBLIC_APP_URL`: Public base URL.
3. (Optional) Run the Supabase migration for the Netflix-only schema:
   - Apply `supabase/migrations/001_vybe_schema.sql` then `supabase/migrations/002_netflix_only.sql` in your Supabase SQL Editor.

---

## 3. Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`:
- **Landing Page**: `http://localhost:3000`
- **Dashboard (Movies & Lobby)**: `http://localhost:3000/dashboard`
- **Netflix Room**: `http://localhost:3000/room/NFX-808`

---

## 4. Installing the Manifest V3 Chrome Extension (Netflix Sync)

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** ON in the top-right corner.
3. Click **Load unpacked** and select the `chrome-extension/` folder inside this repository.
4. Open a Netflix Watch Party room (e.g. `http://localhost:3000/room/NFX-808`), press **Open Netflix.com**, and start watching. The extension pairs your room automatically via the `?vybeRoom=` query param, and the room page's "Open Party Chat" button embeds a chat view directly into Netflix.
