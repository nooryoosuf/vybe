# VYBE — Known Issues & Technical Vulnerability Register

**Date:** November 2026  
**Document Status:** Active  

This document catalogs all verified architectural, synchronization, security, and browser-extension issues discovered during the repository audit.

---

## 1. Playback & Synchronization Issues

### ISSUE-PLY-01: Fragmented Playback Abstraction
- **Severity:** High
- **Component:** `src/components/room/YouTubeSyncPlayer.tsx`, `src/components/room/NetflixCompanionDeck.tsx`
- **Description:** There is no common playback interface or capability descriptor. YouTube and Netflix/Local players use completely separate state variables, event dispatchers, and seek handlers.
- **Impact:** Any new provider requires modifying `WatchRoomClient.tsx`. Features like subtitles, speed adjustments, and buffering states behave inconsistently between providers.

### ISSUE-PLY-02: Playback Command Feedback Loops (Ping-Pong Effect)
- **Severity:** Critical
- **Component:** `YouTubeSyncPlayer.tsx`, `NetflixCompanionDeck.tsx`, `content-netflix.js`
- **Description:** When a participant receives a remote command (e.g. `PLAYBACK_SYNC` with `isPlaying: true`), the component calls the native player method (`playVideo()` or `video.play()`). In response, the underlying player fires a native event (`onStateChange: 1` or `video.onplay`), which triggers the component's local change listener and publishes a new event back to the room.
- **Root Cause:** Relying on arbitrary `setTimeout` locks (`remoteGuardTimeout` = 850–1000ms) rather than state-machine command origin tagging. If buffering takes longer than the timeout, a loop occurs.

### ISSUE-PLY-03: Sudden Seek Stutter on Moderate Drift
- **Severity:** Medium
- **Component:** `YouTubeSyncPlayer.tsx`, `NetflixCompanionDeck.tsx`
- **Description:** When participant playback drifts by ~1.6 seconds (common over mobile or Wi-Fi networks), the player immediately issues a hard seek (`seekTo`). This causes an audio pop, video buffering spinner, and disrupts the viewer.
- **Fix Required:** Implement a tiered drift-correction algorithm:
  - **Minor drift (<0.3s):** Natural playback, zero intervention.
  - **Moderate drift (0.3s – 1.5s):** Smooth playback rate pitch-invariant nudge (0.95x / 1.05x).
  - **Major drift (>1.5s):** Hard seek to authoritative timestamp.

### ISSUE-PLY-04: Stale Sequence Number Acceptance
- **Severity:** High
- **Component:** `WatchRoomClient.tsx`, `cloudflare/worker.ts`, `vybeStore.ts`
- **Description:** In rapid succession (e.g. host clicks Pause then Play quickly), out-of-order network packets can arrive such that an older Pause arrives after a newer Play. If sequence numbers are not monotonically strictly increasing and enforced, the room state can regress.

---

## 2. Chrome Extension & Companion Integration Issues

### ISSUE-EXT-01: Manifest V3 Service Worker Suspension Wipes State
- **Severity:** Critical
- **Component:** `chrome-extension/background.js`
- **Description:** The background service worker stores room configuration and player status in module-scoped variables (`let sessionState = { roomCode: 'NFX-808', ... }`). Chrome MV3 terminates service workers after 30 seconds of inactivity. Upon termination, all in-memory state is wiped. When a Netflix tab subsequently fires a heartbeat, `sessionState.roomCode` reverts to the hardcoded default `"NFX-808"`.
- **Fix Required:** Store and hydrate all session state from `chrome.storage.local`.

### ISSUE-EXT-02: Indiscriminate Tab Messaging
- **Severity:** High
- **Component:** `chrome-extension/background.js` (`broadcastToAllTabs`)
- **Description:** `broadcastToAllTabs` calls `chrome.tabs.query({})` with no filters and sends runtime messages to every open tab in the user's browser (e.g. bank portals, internal tools).
- **Impact:** Triggers unhandled promise rejections in the extension background console and creates privacy/performance issues.
- **Fix Required:** Query only tabs matching `*://*.netflix.com/*`, `https://vybe.nooryoosuf.com/*`, `http://localhost:*/*`, and other explicitly configured origins.

### ISSUE-EXT-03: Netflix Player DOM Selector Brittleness
- **Severity:** Medium
- **Component:** `chrome-extension/content-netflix.js`
- **Description:** Uses `document.querySelector('video')` directly. When Netflix changes video layers during intro skips, recap cards, or ads, the video element is unmounted and replaced with a new DOM node, dropping event bindings.
- **Fix Required:** Implement a dynamic `MutationObserver` or resilient periodic video binder that detects node replacement and transfers time listeners.

---

## 3. Realtime Infrastructure & Cloudflare Edge Issues

### ISSUE-RT-01: Edge Isolate Memory Segmentation
- **Severity:** High
- **Component:** `cloudflare/worker.ts`
- **Description:** The Cloudflare Worker stores active rooms in a module-level variable (`const db: EdgeDb = createInitialDb()`). Cloudflare Workers run across hundreds of global edge data centers. A user connecting from London communicates with a European isolate, while a friend in New York communicates with an American isolate. Unless state is synced to an external database (Supabase) or Durable Object, rooms created on one isolate cannot be found by users on another.
- **Fix Required:** Ensure client state hydration automatically falls back to Supabase and client room backup, with clear diagnostics for cross-region pairing.

### ISSUE-RT-02: Telemetry Heartbeat Network Saturation
- **Severity:** Medium
- **Component:** `WatchRoomClient.tsx`
- **Description:** Every client emits `PARTICIPANT_HEARTBEAT` every 3.5 seconds over SSE/Broadcast. In a room with 20 participants, the server processes ~6 updates per second just for presence.
- **Fix Required:** Throttle heartbeats to 10–15 seconds, and send immediate updates only on state transitions (joined, muted, speaking, out-of-sync).

---

## 4. Mobile & Responsive Issues

### ISSUE-MOB-01: Screen Casting Incompatibility
- **Severity:** Medium
- **Component:** `NetflixCompanionDeck.tsx`
- **Description:** The "Cast Tab" button calls `navigator.mediaDevices.getDisplayMedia()`. This API is strictly unsupported on iOS Safari and mobile Chrome. Tapping it fails silently without user feedback.
- **Fix Required:** Guard `getDisplayMedia` behind feature detection; display a clean fallback explanation on mobile devices.

### ISSUE-MOB-02: Inline Video Autoplay Restrictions
- **Severity:** Medium
- **Component:** `YouTubeSyncPlayer.tsx`, HTML5 video players
- **Description:** Mobile browsers block unmuted autoplay unless preceded by an explicit user gesture. When a mobile user enters an already-playing room, the player blocks playback without clear affordance.
- **Fix Required:** Show a visible "Tap to Join Live Stream" overlay with muted autoplay fallback when unmuted autoplay is rejected by the browser.
