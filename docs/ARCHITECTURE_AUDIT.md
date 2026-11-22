# VYBE — Comprehensive Repository & Architecture Audit

**Author:** Senior Full-Stack Engineer & Software Architect  
**Date:** November 2026  
**Repository:** [github.com/nooryoosuf/vybe](https://github.com/nooryoosuf/vybe)  
**Target:** Hybrid Social Watch Party Platform (Web App, Cloudflare Worker, Chrome Extension, Supabase)

---

## 1. Executive Summary

VYBE is a high-fidelity social watch-party platform with a distinct midnight-glass aesthetic (`#07080D`, `#0D0F18`, `#131624`, `#6D5DFB`, `#4F46E5`), animated canvas effects, floating reactions, WebRTC audio/video mesh, and a shared theater room.

While the visual presentation and frontend foundations are well-crafted, an exhaustive deep-dive of the codebase reveals critical architectural friction points:
1. **Coupled & Fragmented Playback Logic:** Playback management is fragmented across disparate components (`YouTubeSyncPlayer.tsx` and `NetflixCompanionDeck.tsx`). Each component independently reinvents drift estimation, event handling, seek locks, and transport controls without a unified player contract.
2. **Chrome Extension (Manifest V3) State Fragility:** The background service worker (`chrome-extension/background.js`) stores its state in volatile module-level memory variables (`let sessionState`). When the MV3 service worker is terminated by Chrome after ~30 seconds of inactivity, active room pairings and timestamps are lost. Additionally, messages are blindly broadcast to every open tab in the browser without URL filtering.
3. **Command Ping-Pong & Feedback Loops:** Content scripts and web app players lack a monotonic sequence-number validation and origin-tagging system. When an authoritative remote seek/play command is applied, native player DOM events (`seeked`, `play`) fire and immediately re-broadcast the action back to the network, resulting in feedback loops.
4. **Cloudflare Worker Hybrid Persistence vs. Supabase:** The edge worker (`cloudflare/worker.ts`) maintains an in-memory database (`db: EdgeDb`) that resets across cold starts or isolate re-assignments, while Supabase tables exist in schema migrations but are bypassed in several core room flows.
5. **Mobile Incompatibilities:** Media controls and companion playback interfaces assume desktop browser capabilities (e.g., `getDisplayMedia` screen casting, Chrome extension messaging), which fail silently on iOS Safari and mobile Chrome.

---

## 2. Component-by-Component Repository Inspection

### 2.1 Package & Toolchain (`package.json`, `next.config.mjs`, `wrangler.jsonc`)
- **Dependencies:**
  - `next`: `15.1.7` (App Router)
  - `react` / `react-dom`: `19.0.0`
  - `framer-motion`: `11.18.2`
  - `@supabase/supabase-js`: `^2.48.1`, `@supabase/ssr`: `^0.5.2`
  - `lucide-react`: `^0.475.0`
  - `tailwindcss`: `^3.4.17`
- **Findings:**
  - `next.config.mjs` configures static export (`output: 'export'`) when `process.env.CF_BUILD === '1'`.
  - Next.js static export does not support dynamic server route handlers (`POST`/`PATCH` endpoints) during `next build`. The build pipeline temporarily backups `src/app/api`, builds static HTML/JS into `./out`, and deploys via `cloudflare/worker.ts`, which proxies `/api/*` requests in edge code.
  - While this allows zero-serverless Cloudflare deployment, `cloudflare/worker.ts` stores state in isolate memory (`const db: EdgeDb = createInitialDb()`). When Cloudflare routes requests to different edge data centers (e.g., US-East vs. EU-Central), memory is isolated per worker instance.

### 2.2 Watch Room Client (`src/components/room/WatchRoomClient.tsx`)
- **Status:** Functional UI, but architectural bottlenecks in state orchestration.
- **Strengths:**
  - Excellent layout split (desktop theater + sidebar tabs; mobile-first stacked theater with floating reactions and chat).
  - Tri-layer realtime bus: Browser `BroadcastChannel` (for same-browser tab sync), Server-Sent Events (SSE) `/api/realtime/stream`, and optional Supabase Realtime Broadcast.
- **Vulnerabilities & Issues:**
  - **No Unified Playback Interface:** Direct conditional switching between `<YouTubeSyncPlayer />` and `<NetflixCompanionDeck />`. If personal files or new providers (e.g. Vimeo, HLS streams) are added, the room client must be rewritten with more branching.
  - **Heartbeat Flooding:** Uses high-frequency periodic telemetry reports that call `publishRealtimeEvent` every 3.5 seconds per connected participant, causing network saturation in larger rooms.
  - **Reconnection Race Conditions:** On SSE disconnection, it calls `fetch(/api/rooms?code=...)`. If a user is host, an interrupted response can trigger client fallback hydration that overwrites remote room playback state.

### 2.3 YouTube Playback Provider (`src/components/room/YouTubeSyncPlayer.tsx`)
- **Status:** Working embedded player with basic auto-sync.
- **Vulnerabilities & Issues:**
  - **Hard-Coded Drift Throttling:** Uses a fixed `autoSyncThresholdSec` (typically 1.5–2.0s). If drift is 1.6s, it performs a hard `player.seekTo()`. Hard seeks interrupt audio buffering and cause stutter. There is no subtle micro-playback rate adjustment (e.g., 1.05x / 0.95x) for moderate drift (0.3s – 1.5s).
  - **Command Echoing:** When `player.seekTo` is called from a remote event, YouTube's `onStateChange` fires with `BUFFERING` (3) and `PLAYING` (1), which triggers `onLocalPlaybackChange` if `isApplyingRemoteRef` expires before YouTube finishes seeking.
  - **IFrame API Script Loading:** Injects `<script src="https://www.youtube.com/iframe_api">` dynamically on every mount without a shared script singleton promise, risking duplicate script tags or dropped `onYouTubeIframeAPIReady` callbacks.

### 2.4 Netflix Companion & Local Player (`src/components/room/NetflixCompanionDeck.tsx`)
- **Status:** Hybrid companion deck (YouTube episode trailers, HTML5 `<video>` for local files, screen-cast stream, Netflix external launcher).
- **Vulnerabilities & Issues:**
  - **Role Confusion:** Mixes YouTube trailer embeds, local file Object URLs, WebRTC `getDisplayMedia` tab casting, and Netflix deep-linking into a single monolithic 540-line component.
  - **Extension Disconnect Handling:** Does not reliably display whether the extension is installed, idle, active, or missing permissions.
  - **Memory Leaks:** `URL.createObjectURL` is created when loading local files but not consistently revoked on component unmount or episode changes.

### 2.5 Chrome Extension (`chrome-extension/`)
- **Status:** Manifest V3 extension with content scripts for Netflix and VYBE.
- **Critical Architectural Defects:**
  1. **MV3 Service Worker Lifespan:** `background.js` keeps `sessionState` in a top-level JavaScript variable. When Chrome unloads the background worker after inactivity, all session state is lost. When subsequent events wake the worker, `sessionState.roomCode` reverts to default `"NFX-808"`.
  2. **Blind Tab Broadcasts:** `broadcastToAllTabs()` runs `chrome.tabs.query({}, (tabs) => ...)` and messages every tab in Chrome without verifying the URL or recipient frame. This spams unrelated websites and logs `Unchecked runtime.lastError: Could not establish connection`.
  3. **No Bi-directional Acknowledgment:** Content scripts send messages via `sendMessage` without timeout recovery or retries. If the background script is suspended, messages fail silently.
  4. **Ping-Pong Loop in Netflix Content Script:** `content-netflix.js` listens to `<video>` `play`, `pause`, and `seeked` events and calls `NETFLIX_LOCAL_ACTION`. When receiving `APPLY_TO_NETFLIX_VIDEO`, it locks local actions with a simple `setTimeout(900ms)`. If Netflix takes 1100ms to buffer and resume, the `play` event fires after the lock expires, sending a duplicate command back to VYBE.

### 2.6 Supabase Migrations & Security (`supabase/migrations/001_vybe_schema.sql`)
- **Status:** Comprehensive PostgreSQL schema with RLS and Realtime publication.
- **Strengths:**
  - Clean separation into `profiles`, `watch_rooms`, `room_playback_state`, `room_memberships`, `chat_messages`, `watch_queue_items`.
  - Security definer helper functions: `is_room_member()`, `is_room_moderator()`, `can_control_playback()`.
- **Gaps & Risks:**
  - `room_playback_state` update policy: `using (public.can_control_playback(room_id))` verifies permissions, but has no monotonically increasing `sequence_num` check in the database constraint. Stale network packets can overwrite newer state if network latency fluctuates.
  - Realtime publication publishes raw table inserts/updates, but client components do not currently implement optimistic conflict resolution based on `sequence_num`.

---

## 3. Detailed Audit Matrix

| Dimension | Current Implementation | Risk / Vulnerability | Required Engineering Action |
| :--- | :--- | :--- | :--- |
| **Playback Abstraction** | Separate bespoke components (`YouTubeSyncPlayer`, `NetflixCompanionDeck`) | Code duplication; cannot add new providers without modifying room UI; no common capability system | Create `src/lib/playback/` unified playback manager, capability interface, and provider adapters |
| **Sync Authority** | Host publishes via SSE / BroadcastChannel / Supabase | Participants can overwrite playback if control permission isn't validated locally; race conditions on simultaneous actions | Server-validated / authority-validated sequence numbers; client-side authoritative state machine |
| **Drift Correction** | Hard `seekTo` if drift exceeds threshold (1.5s–2.0s) | Audio skipping, video stutter, visual disruption during minor latency spikes | Gradual playback rate correction (e.g. 0.95x / 1.05x) for moderate drift (0.3s – 1.5s); seek only for large drift (>1.5s) |
| **Command Loops** | Time-based lock flags (`isApplyingRemoteRef` with arbitrary `setTimeout`) | Fragile; network latency or slow buffering breaks the timeout and echoes commands | State-machine command tagging (`origin: 'remote' | 'user'`), sequence filtering, and state lock until media fires `playing` |
| **Chrome Extension State** | In-memory `let sessionState` in `background.js` | MV3 service worker suspensions wipe state; defaults to room `NFX-808` | Persist session state in `chrome.storage.local`; rehydrate on service worker wakeup |
| **Extension Tab Targeting** | `chrome.tabs.query({})` to all browser tabs | Security risk; browser console errors; excessive IPC overhead | Target specific tab IDs and filter by URL pattern (`*://*.netflix.com/*`, `*://vybe.nooryoosuf.com/*`) |
| **Mobile Web Compatibility** | Uses screen casting (`getDisplayMedia`) and extension assumptions | Fails on iOS Safari and Android Chrome; leaves mobile users with no playback companion | Mobile-adaptive playback mode with native HTML5 inline player, shared personal media, and clear companion status |
| **Edge Worker Persistence** | Cloudflare Worker in-memory `db: EdgeDb` | State resets on isolate restart or multi-region routing | Seamless hybrid: persist authoritative state to Supabase when configured, with resilient local cache fallback |

---

## 4. Preservation Commitments

All upgrades strictly preserve:
1. **Design System & Palette:** `#07080D` background, `#0D0F18` / `#131624` cards, `#6D5DFB` / `#4F46E5` accents, glassmorphic pill buttons (`rounded-full`), and typography.
2. **Interactive UI Elements:** Aceternity-inspired Cinema Spotlight, Canvas ASCII Wave Backdrop, animated floating reactions, live chat drawer, voice/video docks, and member moderation modals.
3. **User Workflows:** Dashboard lobby, 1-click movie party launching, invite link copying (`room?code=...`), queue voting, and profile customization.
4. **Zero Unnecessary Dependencies:** All architectural improvements utilize standard Web APIs (`BroadcastChannel`, `PerformanceObserver`, `MediaSource`, HTML5 Video, EventSource) and existing dependencies.
